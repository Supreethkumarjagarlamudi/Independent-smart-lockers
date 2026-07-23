import cv2
import numpy as np

class ImageQualityAnalyzer:
    @staticmethod
    def analyze_frame(img: np.ndarray) -> dict:
        """
        Analyzes pixel data of the BGR image.
        """
        if img is None:
            return {}

        # 1. Convert to grayscale for standard quality metrics
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # 2. Average Image Brightness
        avg_brightness = float(np.mean(gray))

        # 3. Brightness Histogram (16 bins)
        hist = cv2.calcHist([gray], [0], None, [16], [0, 256])
        hist = [float(x[0]) for x in hist]
        # Normalize histogram values to percentage of total pixels
        total_pixels = h * w
        hist_pct = [round((val / total_pixels) * 100, 2) for val in hist]

        # 4. Sharpness (Laplacian Variance)
        # Higher is sharper. Typically, values < 100 indicate blurry/out-of-focus images.
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # 5. Noise Estimation
        # Quick estimate of noise standard deviation using standard deviation of differences in neighborhood
        # A simple method is to compute local differences
        diff_horizontal = np.diff(gray, axis=1)
        noise_est = float(np.std(diff_horizontal))

        # 6. Exposure Status
        # We classify exposure based on average brightness
        if avg_brightness < 60:
            exposure_status = "Under-exposed"
        elif avg_brightness > 200:
            exposure_status = "Over-exposed"
        else:
            exposure_status = "Correctly exposed"

        return {
            "avg_brightness": round(avg_brightness, 2),
            "brightness_histogram": hist_pct,
            "sharpness": round(laplacian_var, 2),
            "noise_level": round(noise_est, 2),
            "exposure_status": exposure_status
        }
