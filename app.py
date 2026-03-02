from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
import os
import json
from werkzeug.utils import secure_filename

from ai_final import AIDetector

AI_ENABLED = True

app = Flask(__name__)
BASE_DIR = os.path.dirname(__file__)
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['LABELS_FOLDER'] = os.path.join(BASE_DIR, 'labels')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['UPLOAD_CATEGORY_FOLDER'] = os.path.join(os.path.dirname(__file__), 'upload')
os.makedirs(app.config['UPLOAD_CATEGORY_FOLDER'], exist_ok=True)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['LABELS_FOLDER'], exist_ok=True)

# --- AI Detector Initialization ---
detector = AIDetector()
# --- End AI Detector Initialization ---


@app.route('/')
def index():
    return render_template('login.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return render_template('dashboard.html')
    return render_template('login.html')


@app.route('/labelme')
def labelme():
    filename = request.args.get('image')
    return render_template('labelme.html', filename=filename)


@app.route('/uploads/<path:filename>')
def serve_upload_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/labels/<filename>')
def get_label(filename):
    json_path = os.path.join(app.config['LABELS_FOLDER'], filename)
    if os.path.exists(json_path):
        # guess mimetype
        if filename.endswith(".json"):
            return send_file(json_path, mimetype='application/json')
        return send_file(json_path)
    return jsonify({'error': 'File not found'}), 404


@app.route('/list_labels')
def list_labels():
    labels = os.listdir(app.config['LABELS_FOLDER'])
    return jsonify({'labels': labels})


@app.route("/api/ai/status")
def ai_status():
    return jsonify({
        "enabled": bool(AI_ENABLED),
        "model": "yolov8n-seg",
        "device": "cpu"
    })


# ---------------------------------------------------------
# ✅ CLICK-BASED AI POLYGON ENDPOINT (IMPORTANT)
# ---------------------------------------------------------
@app.route('/api/ai/polygon-click', methods=['POST'])
def ai_polygon_click():
    """
    AI polygon from click:
    frontend sends base64 image + click x,y (image coordinates from canvas)
    backend returns polygon of the mask that contains that click.
    """
    if not AI_ENABLED:
        return jsonify({'success': False, 'error': 'AI module not available'}), 400

    try:
        data = request.get_json() or {}
        image_b64 = data.get('image')
        x = data.get('x')
        y = data.get('y')
        conf = float(data.get('conf', 0.4))

        if image_b64 is None or x is None or y is None:
            return jsonify({'success': False, 'error': 'image, x, y required'}), 400

        poly = detector.segment_from_click(image_b64, x, y, conf=conf)
        if poly and len(poly) > 2:
            return jsonify({'success': True, 'points': poly})

        return jsonify({'success': False, 'error': 'No polygon found at click'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------------------------------------
# ✅ IMAGE UPLOAD
# ---------------------------------------------------------
@app.route('/upload', methods=['POST'])
def upload_image():
    if 'images' not in request.files:
        return jsonify({'error': 'No image files'}), 400

    files = request.files.getlist('images')
    upload_folder = app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)

    filenames = []
    for file in files:
        if not file or file.filename == '':
            continue
        filename = secure_filename(file.filename)
        image_path = os.path.join(upload_folder, filename)
        file.save(image_path)
        filenames.append(filename)

    if filenames:
        return jsonify({'success': True, 'filenames': filenames})

    return jsonify({'error': 'No valid images uploaded'}), 400


# ---------------------------------------------------------
# ✅ SAVE LABELS: JSON + YOLO TXT (normalized)
# ---------------------------------------------------------
def load_classes(classes_path):
    if os.path.exists(classes_path):
        with open(classes_path, "r", encoding="utf-8") as f:
            return [line.strip() for line in f.readlines() if line.strip()]
    return []


def save_classes(classes_path, classes_list):
    with open(classes_path, "w", encoding="utf-8") as f:
        f.write("\n".join(classes_list))


def shape_to_bbox(points):
    """points: [[x,y], [x,y], ...] polygon or rectangle points"""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x1, x2 = min(xs), max(xs)
    y1, y2 = min(ys), max(ys)
    return x1, y1, x2, y2


@app.route('/save_label', methods=['POST'])
def save_label():
    """
    After Save:
      - Copy image into:  Labelify/upload/<label>/<image>
      - Save labels into: Labelify/labels/<label>/<image>.txt and .json

    If folder exists -> reuse
    If folder not exists -> create
    Works for:
      - 1 image 1 object
      - 1 image multiple objects
      - multiple labels in same image (stores into each label folder)
    """
    try:
        data = request.get_json() or {}
        all_annotations = data.get('all_annotations', [])

        if not all_annotations or not isinstance(all_annotations, list):
            return jsonify({'success': False, 'error': 'No annotations provided'}), 400

        saved = []

        def safe_label_name(name: str) -> str:
            """Make label folder safe for Windows."""
            name = (name or "object").strip()
            if not name:
                name = "object"
            # replace unsafe characters
            for ch in r'\/:*?"<>|':
                name = name.replace(ch, "_")
            return name

        def shape_to_bbox(points):
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            return min(xs), min(ys), max(xs), max(ys)

        for ann_entry in all_annotations:
            image_name = ann_entry.get('image')  # ex: "img1.jpg"
            shapes = ann_entry.get('shapes', [])

            img_w = int(ann_entry.get('imageWidth', 0) or 0)
            img_h = int(ann_entry.get('imageHeight', 0) or 0)
            if img_w <= 0: img_w = 1
            if img_h <= 0: img_h = 1

            if not image_name:
                continue

            base_name, ext = os.path.splitext(image_name)

            # Original uploaded image location (where upload route stored it)
            image_src = os.path.join(app.config['UPLOAD_FOLDER'], image_name)

            # Collect all labels that exist in this image
            labels_in_image = set()
            for s in shapes:
                lbl = safe_label_name(s.get('label'))
                labels_in_image.add(lbl)
            if not labels_in_image:
                labels_in_image.add("object")

            # For each label -> create folders & save files
            for label_name in labels_in_image:
                label_name = safe_label_name(label_name)

                # ✅ Required by you
                upload_label_folder = os.path.join(app.config['UPLOAD_CATEGORY_FOLDER'], label_name)
                labels_label_folder = os.path.join(app.config['LABELS_FOLDER'], label_name)

                os.makedirs(upload_label_folder, exist_ok=True)
                os.makedirs(labels_label_folder, exist_ok=True)

                # --- Copy image into upload/<label>/ ---
                if os.path.exists(image_src):
                    import shutil
                    dst_img = os.path.join(upload_label_folder, image_name)
                    shutil.copy(image_src, dst_img)

                # --- Filter only shapes of this label (so each folder contains its own labels) ---
                shapes_for_label = []
                for s in shapes:
                    lbl = safe_label_name(s.get('label'))
                    if lbl == label_name:
                        shapes_for_label.append(s)

                # --- Save JSON into labels/<label>/<image>.json ---
                json_filename = base_name + ".json"
                json_path = os.path.join(labels_label_folder, json_filename)

                annotation_json = {
                    "version": "5.1.1",
                    "flags": {},
                    "shapes": shapes_for_label,
                    "imagePath": image_name,
                    "imageData": "",
                    "imageHeight": img_h,
                    "imageWidth": img_w
                }
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(annotation_json, f, indent=2)

                # --- Save TXT into labels/<label>/<image>.txt ---
                # YOLO bbox normalized (multiple lines if multiple objects of same label)
                txt_filename = base_name + ".txt"
                txt_path = os.path.join(labels_label_folder, txt_filename)

                txt_lines = []
                for s in shapes_for_label:
                    pts = s.get("points", [])
                    if not pts or len(pts) < 2:
                        continue

                    x1, y1, x2, y2 = shape_to_bbox(pts)

                    # normalize 0..1
                    x_center = ((x1 + x2) / 2.0) / img_w
                    y_center = ((y1 + y2) / 2.0) / img_h
                    w = (x2 - x1) / img_w
                    h = (y2 - y1) / img_h

                    # format you asked: label then values
                    txt_lines.append(f"{label_name} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}")

                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(txt_lines))

                saved.append({
                    "label": label_name,
                    "upload_image": os.path.join(upload_label_folder, image_name),
                    "txt": txt_path,
                    "json": json_path,
                    "objects_in_label": len(txt_lines)
                })

        return jsonify({"success": True, "saved": saved})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)