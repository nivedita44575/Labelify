class LabelMeCanvas {
  // Return LabelMe-style JSON
  toLabelMeJSON(imagePath) {
    return {
      version: "5.1.1",
      flags: {},
      shapes: this.shapes || [],
      imagePath: imagePath || "",
      imageData: "",
      imageHeight: this.image ? this.image.naturalHeight : 0,
      imageWidth: this.image ? this.image.naturalWidth : 0,
    };
  }

  showLoading(show, message = "Processing...") {
    let loader = document.getElementById("ai-loader");
    if (show) {
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "ai-loader";
        loader.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 20px;
          border-radius: 10px;
          z-index: 1000;
          font-family: Arial, sans-serif;
        `;
        document.body.appendChild(loader);
      }
      loader.innerHTML = `
        <div style="text-align:center;">
          <div class="spinner"></div>
          <p>${message}</p>
        </div>
      `;
      loader.style.display = "block";

      if (!document.getElementById("labelme-ai-style")) {
        const style = document.createElement("style");
        style.id = "labelme-ai-style";
        style.textContent = `
          .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
          }
        `;
        document.head.appendChild(style);
      }
    } else if (loader) {
      loader.style.display = "none";
    }
  }

  showMessage(text, type = "info") {
    const message = document.createElement("div");
    message.textContent = text;
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: ${type === "error" ? "#ff4444" : type === "success" ? "#44ff44" : "#4444ff"};
      color: white;
      border-radius: 5px;
      z-index: 1000;
      animation: fadeInOut 3s;
      font-family: Arial, sans-serif;
    `;
    document.body.appendChild(message);
    setTimeout(() => {
      if (message.parentNode) message.parentNode.removeChild(message);
    }, 3000);
  }

  undo() {
    if (!this.shapes || this.shapes.length === 0) return;
    if (!this._undoStack) this._undoStack = [];
    this._undoStack.push(this.shapes.pop());
    this.draw();
    if (window.updateAnnotationsList) window.updateAnnotationsList();
  }

  redo() {
    if (!this._undoStack || this._undoStack.length === 0) return;
    const shape = this._undoStack.pop();
    this.shapes.push(shape);
    this.draw();
    if (window.updateAnnotationsList) window.updateAnnotationsList();
  }

  clear() {
    if (!this.shapes || this.shapes.length === 0) return;
    if (!this._undoStack) this._undoStack = [];
    while (this.shapes.length > 0) {
      this._undoStack.push(this.shapes.pop());
    }
    this.draw();
    if (window.updateAnnotationsList) window.updateAnnotationsList();
  }

  setTool(tool) {
    this.currentTool = tool;
    this.isDrawing = false;
    this.currentShape = null;
    this.updateCursor();
    this.draw();
    this.showToolPopup(tool);
  }

  setLabel(label) {
    this.currentLabel = label;
  }

  showToolPopup(tool) {
    this.removePopup();
    const overlay = document.createElement("div");
    overlay.className = "labelme-popup-overlay";
    const popup = document.createElement("div");
    popup.className = "labelme-popup";
    const toolName = tool.charAt(0).toUpperCase() + tool.slice(1);
    popup.textContent = `You selected the ${toolName} shape`;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    overlay.onclick = () => this.removePopup();
    setTimeout(() => this.removePopup(), 1500);
  }

  showClassNamePopup(onSubmit) {
    this.removePopup();
    const overlay = document.createElement("div");
    overlay.className = "labelme-popup-overlay";
    const popup = document.createElement("div");
    popup.className = "labelme-popup";
    popup.innerHTML = `
      <div style='margin-bottom:12px;'>Enter class name:</div>
      <input type="text" id="classNameInput" placeholder="Class name" autofocus
        style="width:80%;padding:8px 12px;border-radius:4px;border:1px solid #444;background:#333;color:#fff;font-size:1rem;">
      <br>
      <button id="classNameOkBtn"
        style="margin-top:16px;padding:8px 24px;background:#0e639c;color:#fff;border:none;border-radius:4px;font-size:1rem;cursor:pointer;">
        OK
      </button>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    const input = popup.querySelector("#classNameInput");
    const okBtn = popup.querySelector("#classNameOkBtn");
    okBtn.onclick = () => {
      const val = input.value.trim();
      if (val) {
        this.removePopup();
        onSubmit(val);
      } else {
        input.focus();
      }
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") okBtn.click();
    };
    input.focus();
  }

  zoomIn() {
    this.setScale(this.scale * 1.15);
  }

  zoomOut() {
    this.setScale(this.scale / 1.15);
  }

  fitToScreen() {
    this.fitCanvasToImage();
    this.draw();
  }

  setScale(newScale) {
    newScale = Math.max(0.1, Math.min(newScale, 10));
    this.scale = newScale;

    this.canvas.width = this.image.naturalWidth * this.scale;
    this.canvas.height = this.image.naturalHeight * this.scale;

    this.canvas.style.width = this.canvas.width + "px";
    this.canvas.style.height = this.canvas.height + "px";

    this.draw();
  }

  removePopup() {
    document.querySelectorAll(".labelme-popup-overlay").forEach((el) => el.remove());
  }

  updateCursor() {
    if (["polygon", "rectangle", "circle", "freehand", "ai-polygon"].includes(this.currentTool)) {
      this.canvas.classList.add("drawing-cursor");
    } else {
      this.canvas.classList.remove("drawing-cursor");
    }
  }

  constructor(canvasId, imageOrUrl) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    if (typeof imageOrUrl === "string") {
      this.image = new Image();
      this.image.src = imageOrUrl;
    } else {
      this.image = imageOrUrl;
    }

    this.shapes = [];
    this._undoStack = [];
    this.currentTool = "polygon";
    this.isDrawing = false;
    this.currentLabel = "object";
    this.scale = 1;

    this.image.onload = () => {
      this.fitCanvasToImage();
      this.draw();
      this.initEvents();
    };

    if (this.image.complete && this.image.naturalWidth > 0) {
      this.image.onload();
    }
  }

  fitCanvasToImage() {
    const maxW = window.innerWidth * 0.95 - 500;
    const maxH = window.innerHeight * 0.8;

    const imgW = this.image.naturalWidth;
    const imgH = this.image.naturalHeight;

    this.scale = Math.min(maxW / imgW, maxH / imgH);

    this.canvas.width = imgW * this.scale;
    this.canvas.height = imgH * this.scale;

    this.canvas.style.width = this.canvas.width + "px";
    this.canvas.style.height = this.canvas.height + "px";
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.drawImage(
      this.image,
      0,
      0,
      this.image.naturalWidth,
      this.image.naturalHeight,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    for (const shape of this.shapes) {
      this.drawShape(shape);
    }

    if (this.currentShape) {
      this.drawShape(this.currentShape, true);
    }
  }

  drawShape(shape, isCurrent = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = isCurrent ? "#ff9800" : "#00bcd4";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(0,188,212,0.1)";

    const scale = this.scale;
    const pts = (shape.points || []).map(([x, y]) => [x * scale, y * scale]);

    if (shape.type === "polygon") {
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    } else if (shape.type === "rectangle") {
      if (pts.length === 2) {
        let [x0, y0] = pts[0],
          [x1, y1] = pts[1];
        const left = Math.min(x0, x1);
        const top = Math.min(y0, y1);
        const width = Math.abs(x1 - x0);
        const height = Math.abs(y1 - y0);
        ctx.strokeRect(left, top, width, height);
        ctx.fillRect(left, top, width, height);
      }
    } else if (shape.type === "circle") {
      if (pts.length === 2) {
        const [x0, y0] = pts[0],
          [x1, y1] = pts[1];
        const r = Math.hypot(x1 - x0, y1 - y0);
        ctx.beginPath();
        ctx.arc(x0, y0, r, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
      }
    } else if (shape.type === "freehand") {
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  initEvents() {
    let down = false;

    this.canvas.onmousedown = async (e) => {
      const [x, y] = this.getMouse(e);
      down = true;

      // ✅ AI POLYGON MODE (CLICK BASED)
      if (this.currentTool === "ai-polygon") {
        this.showLoading(true, "AI is generating polygon...");

        try {
          // make image base64
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = this.image.naturalWidth;
          tempCanvas.height = this.image.naturalHeight;
          tempCanvas.getContext("2d").drawImage(this.image, 0, 0);
          const imageData = tempCanvas.toDataURL("image/jpeg", 0.95);

          const response = await fetch("/api/ai/polygon-click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: imageData,
              x: x,
              y: y,
              conf: 0.4,
            }),
          });

          const result = await response.json();
          console.log("AI polygon-click result:", result);

          if (result.success && Array.isArray(result.points) && result.points.length > 2) {
            this.showClassNamePopup((className) => {
              const shape = {
                type: "polygon",
                label: className,
                points: result.points,
                aiGenerated: true,
              };
              this.shapes.push(shape);
              this._undoStack = [];
              this.draw();
              if (window.updateAnnotationsList) window.updateAnnotationsList();
            });
          } else {
            this.showMessage(result.error || "AI did not return a valid polygon", "error");
          }
        } catch (err) {
          console.error("AI Polygon failed:", err);
          this.showMessage("AI Polygon error: " + err.message, "error");
        } finally {
          this.showLoading(false);
        }
        return;
      }

      // manual tools
      if (this.currentTool === "polygon") {
        if (!this.currentShape) {
          this.currentShape = { type: "polygon", label: this.currentLabel, points: [[x, y]] };
        } else {
          this.currentShape.points.push([x, y]);
        }
      } else if (this.currentTool === "rectangle") {
        this.currentShape = { type: "rectangle", label: this.currentLabel, points: [[x, y], [x, y]] };
      } else if (this.currentTool === "circle") {
        this.currentShape = { type: "circle", label: this.currentLabel, points: [[x, y], [x, y]] };
      } else if (this.currentTool === "freehand") {
        this.currentShape = { type: "freehand", label: this.currentLabel, points: [[x, y]] };
      }

      this.draw();
    };

    this.canvas.onmousemove = (e) => {
      if (!down || !this.currentShape) return;
      const [x, y] = this.getMouse(e);

      if (this.currentTool === "rectangle" || this.currentTool === "circle") {
        this.currentShape.points[1] = [x, y];
      } else if (this.currentTool === "freehand") {
        this.currentShape.points.push([x, y]);
      }

      this.draw();
    };

    this.canvas.onmouseup = () => {
      down = false;
      if (!this.currentShape) return;

      if (this.currentTool === "rectangle" || this.currentTool === "circle" || this.currentTool === "freehand") {
        const finishedShape = this.currentShape;
        this.currentShape = null;

        this.showClassNamePopup((className) => {
          finishedShape.label = className;
          this.shapes.push(finishedShape);
          this._undoStack = [];
          this.draw();
          if (window.updateAnnotationsList) window.updateAnnotationsList();
        });
      }
      this.draw();
    };

    this.canvas.ondblclick = () => {
      if (this.currentTool === "polygon" && this.currentShape && this.currentShape.points.length > 2) {
        const finishedShape = this.currentShape;
        this.currentShape = null;

        this.showClassNamePopup((className) => {
          finishedShape.label = className;
          this.shapes.push(finishedShape);
          this._undoStack = [];
          this.draw();
          if (window.updateAnnotationsList) window.updateAnnotationsList();
        });
      }
    };
  }

  getMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / this.scale, (e.clientY - rect.top) / this.scale];
  }
}