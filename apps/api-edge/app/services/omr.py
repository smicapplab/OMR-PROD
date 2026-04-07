import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import hashlib
from pathlib import Path
import json

class OMRService:
    """
    Production OMR Processing Service.
    Handles image normalization, anchor-point alignment, bubble detection, and scoring.
    """
    
    def __init__(self):
        # Configuration thresholds
        self.FILL_THRESHOLD = 0.55
        self.REVIEW_THRESHOLD = 0.70
        self.DOMINANCE_GAP = 0.07
        self.ROI_SIZE = (14, 14)
        
        # Ideal Anchor Coordinates
        self.IDEAL_CORNERS = np.array([[100, 100], [2400, 100], [100, 3400], [2400, 3400]], dtype="float32")

        # Constants
        self.ROWS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","Ñ","-"]
        self.MONTH_ROWS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
        self.SUBJECTS = ["math", "english", "science", "filipino", "ap"]
        
        self.REGION_ROWS = ["REGION I", "REGION II", "REGION III", "REGION IV-A", "REGION V", "REGION VI", "REGION VII", "REGION VIII", "REGION IX", "REGION X", "REGION XI", "REGION XII", "NCR", "CAR", "BARMM", "CARAGA", "NIR"]
        self.SCHOOL_TYPE_ROWS = ["National Barangay/Community HS", "National Comprehensive HS", "Integrated School", "Public Science HS", "Public Vocational HS", "State College/University", "Private Non-Sectarian HS", "Private Sectarian HS", "Private Vocational HS", "Private Science HS"]
        self.SPECIAL_CLASSES = ["Special science class", "Special educational class", "Class under MISOSA", "Class in a BRAC", "ALIVE / Madrasah class"]

    def calculate_sha256(self, file_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def preprocess_image(self, img: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        return thresh

    def find_anchors(self, thresh: np.ndarray) -> Optional[np.ndarray]:
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []
        for cnt in contours:
            approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = w / float(h)
                if 0.8 <= aspect_ratio <= 1.2 and 40 < w < 150:
                    area = cv2.contourArea(cnt)
                    if area > 1000: candidates.append(approx)
        if len(candidates) < 4: return None
        points = np.array([c.reshape(4, 2).mean(axis=0) for c in candidates])
        rect = np.zeros((4, 2), dtype="float32")
        s = points.sum(axis=1)
        rect[0] = points[np.argmin(s)]
        rect[3] = points[np.argmax(s)]
        diff = np.diff(points, axis=1)
        rect[1] = points[np.argmin(diff)]
        rect[2] = points[np.argmax(diff)]
        return rect

    def align_image(self, img: np.ndarray, detected_corners: np.ndarray) -> np.ndarray:
        M = cv2.getPerspectiveTransform(detected_corners, self.IDEAL_CORNERS)
        return cv2.warpPerspective(img, M, (2500, 3500))

    def detect_single_bubble(self, thresh: np.ndarray, x: int, y: int) -> float:
        x1, x2, y1, y2 = int(x-7), int(x+7), int(y-7), int(y+7)
        roi = thresh[y1:y2, x1:x2]
        if roi.size == 0: return 0.0
        mask = np.zeros(roi.shape, dtype=np.uint8)
        cv2.circle(mask, (7, 7), 7, 255, -1)
        dark_pixels = cv2.countNonZero(cv2.bitwise_and(roi, mask))
        return round(dark_pixels / float(roi.size), 2)

    def detect_grid(self, thresh: np.ndarray, grid: Dict[int, Dict[str, Tuple[int, int]]]) -> Dict[int, Dict[str, Any]]:
        detailed = {}
        for col in sorted(grid.keys()):
            scores = {label: self.detect_single_bubble(thresh, x, y) for label, (x, y) in grid[col].items()}
            sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            if not sorted_scores:
                detailed[col] = {"selected": None, "confidence": 0.0, "status": "blank", "scores": scores}
                continue
            top_label, top_score = sorted_scores[0]
            second_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0
            if top_score < self.FILL_THRESHOLD: status, selected = "blank", None
            elif (top_score - second_score) >= self.DOMINANCE_GAP: status, selected = "single", top_label
            else: status, selected = "multi", None
            detailed[col] = {"selected": selected, "confidence": top_score, "status": status, "scores": scores}
        return detailed

    def aggregate_text_field(self, details: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
        selected_chars, confidences = [], []
        has_multi, last_selected_col = False, -1
        for col in sorted(details.keys()):
            if details[col]["selected"] is not None: last_selected_col = col
        for col in sorted(details.keys()):
            if col > last_selected_col: continue
            d = details[col]
            if d["status"] == "multi": has_multi = True
            selected_chars.append(str(d["selected"]) if d["selected"] is not None else " ")
            if d["selected"] is not None: confidences.append(d["confidence"])
        answer = "".join(selected_chars).strip()
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        review_required = has_multi or (avg_conf < self.REVIEW_THRESHOLD) or (not answer)
        return {"answer": answer, "confidence": round(avg_conf, 2), "review_required": review_required, "details": details}

    # --- GRID BUILDERS ---
    def build_last_name_grid(self):
        X_POINTS = [307, 356, 403, 451, 501, 549, 598, 646, 695, 744, 793, 841, 890, 939, 987]
        return {i: {self.ROWS[r]: (x, int(596.26 + r * 48.55)) for r in range(len(self.ROWS))} for i, x in enumerate(X_POINTS)}

    def build_first_name_grid(self):
        X_POINTS = [1085, 1133, 1181, 1230, 1279, 1328, 1376, 1424, 1474, 1523, 1571, 1620, 1668, 1717, 1764, 1813, 1862, 1910, 1959]
        return {i: {self.ROWS[r]: (x, int(596.21 + r * 48.55)) for r in range(len(self.ROWS))} for i, x in enumerate(X_POINTS)}

    def build_mi_grid(self):
        X_POINTS = [2058, 2106]
        return {i: {self.ROWS[r]: (x, int(596.21 + r * 48.55)) for r in range(len(self.ROWS))} for i, x in enumerate(X_POINTS)}

    def build_lrn_grid(self):
        X_POINTS = [1715, 1764, 1813, 1862, 1910, 1958, 2006, 2056, 2105, 2153, 2203, 2251]
        return {i: {str(r): (x, int(2103 + r * 48.55)) for r in range(10)} for i, x in enumerate(X_POINTS)}

    def build_birthdate_month_grid(self):
        return {0: {self.MONTH_ROWS[r]: (1910, int(2783 + r * 48.63)) for r in range(12)}}

    def build_birthdate_day_grid(self):
        return {0: {str(r): (2105, int(2880 + r * 49.0)) for r in range(4)}, 1: {str(r): (2154, int(2879 + r * 49.0)) for r in range(10)}}

    def build_birthdate_year_grid(self):
        return {0: {str(r): (2202, int(2879 + r * 48.88)) for r in range(10)}, 1: {str(r): (2251, int(2880 + r * 48.88)) for r in range(10)}}

    def build_ssc_grid(self):
        return {0: {"SELECTED": (1958, 3462)}}

    def build_curr_region_grid(self):
        return {0: {self.REGION_ROWS[r]: (793, int(2104 + r * 48.43)) for r in range(len(self.REGION_ROWS))}}

    def build_curr_division_grid(self):
        return {i: {str(r): (x, int(2150 + r * 48.66)) for r in range(10)} for i, x in enumerate([841, 890])}

    def build_curr_school_id_grid(self):
        return {i: {str(r): (x, int(2150 + r * 48.77)) for r in range(10)} for i, x in enumerate([939, 986, 1035, 1084, 1132, 1182])}

    def build_curr_school_type_grid(self):
        POINTS = [(159, 2734), (159, 2831), (159, 2881), (159, 2930), (159, 2976), (159, 3025), (159, 3122), (159, 3173), (159, 3220), (159, 3267)]
        return {0: {self.SCHOOL_TYPE_ROWS[i]: pt for i, pt in enumerate(POINTS)}}

    def build_prev_school_id_grid(self):
        return {i: {str(r): (x, int(2151 + r * 48.66)) for r in range(10)} for i, x in enumerate([1327, 1376, 1426, 1473, 1522, 1571])}

    def build_prev_final_grade_grid(self):
        COL_X = [938, 987, 1084, 1134, 1230, 1279, 1375, 1425, 1522, 1570]
        TENS_Y = [int(2879 + i * 49.0) for i in range(4)]
        ONES_Y = [int(2879 + i * 48.77) for i in range(10)]
        return {sub: {0: {str(r+6): (COL_X[i*2], TENS_Y[r]) for r in range(4)}, 1: {str(r): (COL_X[i*2+1], ONES_Y[r]) for r in range(10)}} for i, sub in enumerate(self.SUBJECTS)}

    def build_prev_school_year_grid(self):
        return {0: {"SY 2015-2016": (646, 3173), "Before SY 2015-2016": (646, 3221)}}

    def build_prev_class_size_grid(self):
        return {0: {str(r): (1716, int(2881 + r * 48.66)) for r in range(10)}, 1: {str(r): (1764, int(2880 + r * 48.55)) for r in range(10)}}

    def build_gender_grid(self):
        return {0: {"Male": (2172, 3951), "Female": (2173, 3999)}}

    def build_4ps_grid(self):
        return {0: {"Yes": (178, 3951), "No": (373, 3950), "I don't know": (568, 3952)}}

    def build_special_class_grid(self):
        return {0: {self.SPECIAL_CLASSES[i]: pt for i, pt in enumerate([(859, 3949), (859, 3999), (1297, 3950), (1296, 3998), (1685, 3950)])}}

    def build_subject_grid(self, subject_idx: int):
        all_subject_clicks = [(714,4391), (715,4731), (1055,4390), (1394,4391), (1736,4391), (2076,4390), (714,4830), (713,5169), (1054,4828), (1395,4829), (1735,4828), (2077,4828), (714,5265), (714,5607), (1056,5265), (1396,5265), (1736,5265), (2076,5265), (715,5703), (715,6044), (1056,5703), (1394,5703), (1735,5703), (2076,5703), (714,6140), (713,6481), (1055,6140), (1395,6141), (1736,6142), (2076,6141)]
        clicks = all_subject_clicks[subject_idx*6 : (subject_idx+1)*6]
        q1A, q8A = clicks[0], clicks[1]
        base_y, row_spacing = q1A[1], (q8A[1] - q1A[1]) / 7.0
        grid = {}
        for block_idx, x_origin in enumerate([clicks[0][0], clicks[2][0], clicks[3][0], clicks[4][0], clicks[5][0]]):
            for i in range(8):
                q_num = block_idx * 8 + 1 + i
                grid[q_num] = {chr(ord('A') + j): (int(x_origin + j * 48), int(base_y + i * row_spacing)) for j in range(4)}
        return grid

    def process_scan(self, image_path: Path) -> Dict[str, Any]:
        img = cv2.imread(str(image_path))
        if img is None: raise ValueError(f"Could not load image at {image_path}")
        sha256 = self.calculate_sha256(image_path)
        thresh_initial = self.preprocess_image(img)
        corners = self.find_anchors(thresh_initial)
        if corners is not None:
            img = self.align_image(img, corners)
            thresh = self.preprocess_image(img)
            cv2.imwrite(str(image_path), img)
        else: thresh = thresh_initial

        info = {
            "last_name": self.aggregate_text_field(self.detect_grid(thresh, self.build_last_name_grid())),
            "first_name": self.aggregate_text_field(self.detect_grid(thresh, self.build_first_name_grid())),
            "middle_initial": self.aggregate_text_field(self.detect_grid(thresh, self.build_mi_grid())),
            "lrn": self.aggregate_text_field(self.detect_grid(thresh, self.build_lrn_grid())),
            "birth_month": self.aggregate_text_field(self.detect_grid(thresh, self.build_birthdate_month_grid())),
            "birth_day": self.aggregate_text_field(self.detect_grid(thresh, self.build_birthdate_day_grid())),
            "birth_year": self.aggregate_text_field(self.detect_grid(thresh, self.build_birthdate_year_grid())),
            "ssc": self.aggregate_text_field(self.detect_grid(thresh, self.build_ssc_grid())),
            "gender": self.aggregate_text_field(self.detect_grid(thresh, self.build_gender_grid())),
            "four_ps": self.aggregate_text_field(self.detect_grid(thresh, self.build_4ps_grid())),
            "special_classes": self.aggregate_text_field(self.detect_grid(thresh, self.build_special_class_grid()))
        }
        
        info["current_school"] = {
            "region": self.aggregate_text_field(self.detect_grid(thresh, self.build_curr_region_grid())),
            "division": self.aggregate_text_field(self.detect_grid(thresh, self.build_curr_division_grid())),
            "school_id": self.aggregate_text_field(self.detect_grid(thresh, self.build_curr_school_id_grid())),
            "school_type": self.aggregate_text_field(self.detect_grid(thresh, self.build_curr_school_type_grid()))
        }
        
        prev_grades = {}
        prev_grade_grids = self.build_prev_final_grade_grid()
        for sub in self.SUBJECTS:
            prev_grades[sub] = self.aggregate_text_field(self.detect_grid(thresh, prev_grade_grids[sub]))
            
        info["previous_school"] = {
            "school_id": self.aggregate_text_field(self.detect_grid(thresh, self.build_prev_school_id_grid())),
            "school_year": self.aggregate_text_field(self.detect_grid(thresh, self.build_prev_school_year_grid())),
            "class_size": self.aggregate_text_field(self.detect_grid(thresh, self.build_prev_class_size_grid())),
            "grades": prev_grades
        }
        
        answers = {}
        for i, sub in enumerate(self.SUBJECTS):
            grid = self.build_subject_grid(i)
            sub_res = {}
            for q_num, choices in grid.items():
                scores = {c: self.detect_single_bubble(thresh, x, y) for c, (x, y) in choices.items()}
                sorted_q = sorted(scores.items(), key=lambda x: x[1], reverse=True)
                top_c, top_s = sorted_q[0] if sorted_q else (None, 0.0)
                sec_s = sorted_q[1][1] if len(sorted_q) > 1 else 0.0
                rev = (top_s < 0.20) or ((top_s - sec_s) < self.DOMINANCE_GAP)
                sub_res[str(q_num)] = {"answer": top_c if top_s >= 0.20 else None, "confidence": top_s, "review_required": rev, "scores": scores}
            answers[sub] = sub_res

        def check_review(d):
            if isinstance(d, dict) and "review_required" in d and d["review_required"]: return True
            if isinstance(d, dict):
                for v in d.values():
                    if check_review(v): return True
            return False

        overall_rev = check_review(info)
        
        # --- ERRORED SHEET DETECTION (Plan Step 2) ---
        total_fields = 0
        confident_fields = 0
        
        # 1. Count personal info fields
        def count_info_fields(d):
            nonlocal total_fields, confident_fields
            if isinstance(d, dict) and "confidence" in d and "review_required" in d:
                total_fields += 1
                if not d["review_required"] and d["confidence"] >= self.REVIEW_THRESHOLD:
                    confident_fields += 1
                return
            if isinstance(d, dict):
                for v in d.values():
                    count_info_fields(v)

        count_info_fields(info)
        
        # 2. Count answers
        for sub in self.SUBJECTS:
            for q_num, res in answers[sub].items():
                total_fields += 1
                if not res["review_required"] and res["confidence"] >= self.REVIEW_THRESHOLD:
                    confident_fields += 1
                    
        recognized_ratio = round(confident_fields / total_fields, 4) if total_fields > 0 else 0.0

        return {
            "original_sha": sha256, 
            "status": "success", 
            "confidence": info["last_name"]["confidence"], 
            "review_required": overall_rev,
            "recognized_ratio": recognized_ratio,
            "data": {"student_info": info, "answers": answers}
        }

omr_service = OMRService()
