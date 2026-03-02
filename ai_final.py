import base64
import cv2
import numpy as np
from ultralytics import YOLO


class AIDetector:
    def __init__(self):
        self.model = YOLO("yolov8n-seg.pt")
        print("✅ YOLOv8 segmentation model loaded")

    def _decode_base64_to_img(self, image_base64: str):
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        missing_padding = len(image_base64) % 4
        if missing_padding:
            image_base64 += "=" * (4 - missing_padding)

        img_bytes = base64.b64decode(image_base64)
        img_np = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        return img

    def _mask_to_polygon(self, mask_u8: np.ndarray):
        """mask_u8: uint8 binary (0/255) in image resolution."""
        contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < 20:  # ignore tiny noise
            return None
        polygon = [[int(p[0][0]), int(p[0][1])] for p in largest]
        if len(polygon) >= 3:
            return polygon
        return None

    def _resize_mask_to_image(self, mask_u8: np.ndarray, img_w: int, img_h: int):
        if mask_u8.shape[0] != img_h or mask_u8.shape[1] != img_w:
            mask_u8 = cv2.resize(mask_u8, (img_w, img_h), interpolation=cv2.INTER_NEAREST)
        return mask_u8

    def _distance_to_mask(self, mask_u8: np.ndarray, cx: int, cy: int):
        """
        If click isn't inside any mask, pick nearest mask.
        We compute distance from click to nearest white pixel using distance transform.
        """
        # Need a binary image where background=1 and mask=0 for distanceTransform on background
        inv = (mask_u8 == 0).astype(np.uint8)
        dist = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
        return float(dist[cy, cx])

    def segment_from_click(self, image_b64, x, y, conf=0.35):
        """
        "Always outline" click-based segmentation:
        1) Run YOLO segmentation.
        2) Resize masks to image resolution.
        3) If click is inside a mask -> return that polygon.
        4) Else -> return polygon of nearest mask (fallback).
        5) Also auto-try lower confidence if nothing found.
        """
        img = self._decode_base64_to_img(image_b64)
        if img is None:
            return None

        img_h, img_w = img.shape[:2]
        cx, cy = int(x), int(y)

        if cx < 0 or cy < 0 or cx >= img_w or cy >= img_h:
            return None

        # Auto fallback confidence levels (more robust)
        conf_levels = [float(conf), 0.25, 0.15]

        for c in conf_levels:
            results = self.model(img, conf=c, task="segment", verbose=False)
            if not results:
                continue

            r = results[0]
            if r.masks is None or r.masks.data is None or len(r.masks.data) == 0:
                continue

            best_inside_poly = None

            # For fallback-nearest selection:
            best_nearest_poly = None
            best_nearest_dist = 1e18

            for mask_tensor in r.masks.data:
                mask = mask_tensor.cpu().numpy()
                mask_u8 = (mask > 0.5).astype(np.uint8) * 255
                mask_u8 = self._resize_mask_to_image(mask_u8, img_w, img_h)

                # If click is inside this mask -> return it immediately
                if mask_u8[cy, cx] > 0:
                    poly = self._mask_to_polygon(mask_u8)
                    if poly:
                        best_inside_poly = poly
                        break

                # Otherwise compute nearest distance (fallback candidate)
                dist = self._distance_to_mask(mask_u8, cx, cy)
                if dist < best_nearest_dist:
                    poly = self._mask_to_polygon(mask_u8)
                    if poly:
                        best_nearest_dist = dist
                        best_nearest_poly = poly

            if best_inside_poly:
                return best_inside_poly

            # If no inside match, use nearest mask but only if not too far
            # (avoid outlining random object far away from click)
            if best_nearest_poly and best_nearest_dist <= 35:  # pixels; tune if needed
                return best_nearest_poly

        return None