class RecommendationEngine:
    @staticmethod
    def evaluate(image_metrics: dict, face_metrics: dict) -> dict:
        """
        Synthesizes raw image and face metrics into a quality score, checks, and recommendations.
        """
        score = 100
        checks = []
        recommendations = []

        # 1. Evaluate general image metrics first
        avg_brightness = image_metrics.get("avg_brightness", 120)
        sharpness = image_metrics.get("sharpness", 200)
        noise = image_metrics.get("noise_level", 5)

        # Brightness Checks
        if avg_brightness < 60:
            score -= 15
            checks.append({"status": "PROBLEM", "message": "Lighting too dark"})
            recommendations.append({
                "action": "Increase Gain or Exposure", 
                "why": "Overall frame brightness is low. Increasing exposure allows more light into the sensor."
            })
        elif avg_brightness > 210:
            score -= 15
            checks.append({"status": "PROBLEM", "message": "Lighting too bright"})
            recommendations.append({
                "action": "Reduce Exposure or Gain",
                "why": "Overall frame is overexposed. Reducing gain prevents washed-out features."
            })
        else:
            checks.append({"status": "EXCELLENT", "message": "Exposure is correct"})

        # Sharpness Checks
        if sharpness < 50:
            score -= 20
            checks.append({"status": "PROBLEM", "message": "Image is very blurry"})
            recommendations.append({
                "action": "Increase Sharpness or Fix Focus",
                "why": "High blur detected. Ensure clean lens and increase hardware sharpening parameter."
            })
        elif sharpness < 120:
            score -= 8
            checks.append({"status": "WARNING", "message": "Image is slightly soft"})
        else:
            checks.append({"status": "EXCELLENT", "message": "Sharpness is excellent"})

        # 2. Evaluate Face Metrics (if detected)
        face_detected = face_metrics.get("face_detected", False)
        if not face_detected:
            score = 30 # Default low score if no face
            checks.append({"status": "WARNING", "message": "No face detected"})
            recommendations.append({
                "action": "Position Face in Center Guide",
                "why": "Biometric analysis requires a visible face inside the scanner box."
            })
        else:
            # Face Centered
            if not face_metrics.get("face_centered", False):
                score -= 12
                checks.append({"status": "WARNING", "message": "Face not centered"})
                recommendations.append({
                    "action": "Move Face towards Center Marker",
                    "why": "Centering ensures full facial geometry is captured without camera edge clipping."
                })
            else:
                checks.append({"status": "EXCELLENT", "message": "Face is centered"})

            # Face Size
            face_size = face_metrics.get("face_size", 0)
            if face_size < 18:
                score -= 15
                checks.append({"status": "WARNING", "message": "Face too small"})
                recommendations.append({
                    "action": "Move Closer to Camera",
                    "why": "Moving closer increases resolution of facial details for SFace encoding."
                })
            elif face_size > 65:
                score -= 10
                checks.append({"status": "WARNING", "message": "Face too close"})
                recommendations.append({
                    "action": "Move Back Slightly",
                    "why": "Too close can cause geometric distortion and lens warping."
                })
            else:
                checks.append({"status": "EXCELLENT", "message": "Face size is ideal"})

            # Face Brightness compared to Background (Backlight issue)
            face_brightness = face_metrics.get("face_brightness", 120)
            diff_brightness = avg_brightness - face_brightness
            if diff_brightness > 45:
                score -= 15
                checks.append({"status": "PROBLEM", "message": "Background is much brighter than face"})
                recommendations.append({
                    "action": "Increase Backlight Compensation",
                    "why": "The background light source is causing silhouette effect. BLC compensates for backlighting."
                })
            
            if face_brightness < 65:
                score -= 10
                checks.append({"status": "WARNING", "message": "Face too dark"})
                recommendations.append({
                    "action": "Improve front-facing lighting",
                    "why": "Low face lighting causes degradation in facial landmarks detection."
                })

            # Face Rotation / Pose
            pose = face_metrics.get("pose", {"yaw": 0, "pitch": 0, "roll": 0})
            yaw = abs(pose.get("yaw", 0))
            pitch = abs(pose.get("pitch", 0))
            roll = abs(pose.get("roll", 0))

            if yaw > 15 or pitch > 15 or roll > 15:
                score -= 15
                checks.append({"status": "PROBLEM", "message": "Face rotated too much"})
                recommendations.append({
                    "action": "Look straight at the camera",
                    "why": "Angles beyond 15 degrees degrade facial matching success rates."
                })
            else:
                checks.append({"status": "EXCELLENT", "message": "Face pose is straight"})

            # Glare / Reflections
            if face_metrics.get("glare_detected", False):
                score -= 10
                checks.append({"status": "WARNING", "message": "Excessive glare detected"})
                recommendations.append({
                    "action": "Reduce Brightness / Adjust Screen Angle",
                    "why": "Glasses reflection blocks eye geometry, interfering with recognition."
                })

            # Check multiple faces
            if face_metrics.get("num_faces", 1) > 1:
                score -= 15
                checks.append({"status": "WARNING", "message": "Multiple faces detected"})
                recommendations.append({
                    "action": "Ensure only one user is in view",
                    "why": "Presence of multiple faces confuses the authentication engine."
                })

        # Ensure score bounds
        score = max(0, min(100, score))
        
        # Classification
        if score >= 90:
            rating = "Excellent"
        elif score >= 75:
            rating = "Good"
        elif score >= 55:
            rating = "Acceptable"
        elif score >= 35:
            rating = "Needs Adjustment"
        else:
            rating = "Poor"

        return {
            "score": score,
            "rating": rating,
            "checks": checks,
            "recommendations": recommendations
        }

    @staticmethod
    def suggest_auto_tune(current_controls: list, avg_brightness: float, face_brightness: float, sharpness: float) -> list:
        """
        Runs heuristics to suggest ideal delta settings for camera controls.
        """
        suggestions = []
        for ctrl in current_controls:
            name = ctrl["name"]
            val = ctrl["value"]
            min_val = ctrl["min"]
            max_val = ctrl["max"]
            default = ctrl["default"]
            
            suggestion = {
                "name": name,
                "current": val,
                "suggested": val,
                "difference": 0
            }

            # Heuristics for Brightness & Gain
            if name == "brightness":
                # target overall brightness around 125
                if avg_brightness < 90:
                    suggestion["suggested"] = min(max_val, val + int((max_val - min_val) * 0.15))
                elif avg_brightness > 160:
                    suggestion["suggested"] = max(min_val, val - int((max_val - min_val) * 0.15))
            
            elif name == "gain":
                # Increase gain if face is dark
                if face_brightness < 80:
                    suggestion["suggested"] = min(max_val, val + int((max_val - min_val) * 0.20))
                elif face_brightness > 180:
                    suggestion["suggested"] = max(min_val, val - int((max_val - min_val) * 0.10))

            elif name == "sharpness":
                # Target sharp focus
                if sharpness < 100:
                    suggestion["suggested"] = min(max_val, val + 2)
            
            elif name == "backlight_compensation":
                # If face is much darker than background, suggest increasing BLC
                if avg_brightness - face_brightness > 35:
                    suggestion["suggested"] = min(max_val, val + 1)
                elif avg_brightness - face_brightness < 10 and val > 0:
                    suggestion["suggested"] = max(min_val, val - 1)

            # Compute difference
            suggestion["difference"] = suggestion["suggested"] - val
            
            # Only add to suggestion if there is a suggested change
            if suggestion["difference"] != 0:
                suggestions.append(suggestion)

        return suggestions
