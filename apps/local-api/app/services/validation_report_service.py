import json
import time

class ValidationReportService:
    @staticmethod
    def generate_report(device_info: dict, camera_config: dict, validation_results: dict) -> dict:
        """
        Creates a structured deployment validation report.
        """
        checklist = validation_results.get("checklist", {})
        camera_status = validation_results.get("camera_status", "Not Ready")
        face_metrics = validation_results.get("face_metrics", {})
        env_metrics = validation_results.get("env_metrics", {})

        report = {
            "report_timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "deployment_status": "Ready" if camera_status == "Ready" else "Not Ready",
            "camera_information": {
                "name": device_info.get("name", "Generic Webcam"),
                "driver": device_info.get("driver", "Unknown"),
                "device_path": device_info.get("device_path", "/dev/video0"),
                "resolution": device_info.get("resolution", "640x480"),
                "fps": device_info.get("fps", "30 FPS"),
                "pixel_format": device_info.get("pixel_format", "MJPG")
            },
            "camera_configuration": camera_config,
            "validation_results": {
                "checklist": checklist,
                "reasons": validation_results.get("reasons", []),
                "overall_brightness": env_metrics.get("avg_brightness", 0.0),
                "overall_sharpness": env_metrics.get("sharpness", 0.0),
                "measured_fps": env_metrics.get("fps", 0.0)
            },
            "face_quality": {
                "score": face_metrics.get("face_quality_score", 0.0),
                "classification": face_metrics.get("classification", "Poor"),
                "face_detected": face_metrics.get("face_detected", False),
                "face_size": face_metrics.get("face_size", 0.0),
                "face_centered": face_metrics.get("face_centered", False),
                "distance_estimate_m": face_metrics.get("distance_estimate", 0.0)
            }
        }
        return report
