// static/js/ai.js - Frontend AI handler

class AIHandler {
    constructor() {
        this.aiMode = false;
        this.aiActive = false;
        this.detectedPolygons = [];
        this.checkStatus();
    }
    async checkStatus() {
        try {
            const response = await fetch('/api/ai/status');
            const data = await response.json();
            
            if (data.enabled) {
                console.log('✅ AI is ready:', data.model);
                this.enableButtons();
                return true;
            } else {
                console.warn('AI is not available');
                this.disableButtons();
                return false;
            }
        } catch (error) {
            console.error('Failed to check AI status:', error);
            this.disableButtons();
            return false;
        }
    }
    
    enableButtons() {
        // Enable AI buttons
        const buttons = document.querySelectorAll('[data-ai-button]');
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.classList.remove('disabled');
        });
    }

    disableButtons() {
        // Disable AI buttons
        const buttons = document.querySelectorAll('[data-ai-button]');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.classList.add('disabled');
        });
    }
    
    async autoDetect() {
        alert('autoDetect called!');
        console.log('autoDetect called!');
        try {
            // Get canvas or image element
            const canvas = this.getCanvas();
            if (!canvas) {
                alert('Could not find canvas element');
                return;
            }
            
            // Show loading
            this.showLoading('AI is detecting objects...');
            
            // Get image data
            const imageData = canvas.toDataURL('image/jpeg', 0.9);
            
            // Get confidence value
            const confidence = this.getConfidenceValue();
            
            // Send to backend
            const response = await fetch('/api/ai/auto-detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData,
                    confidence: confidence
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`AI detected ${result.count} objects`);
                console.log(`AI detected ${result.count} objects`, result.annotations);
                this.detectedPolygons = result.annotations;
                // Mark these as AI polygons
                const aiAnnotations = result.annotations.map(ann => ({
                    ...ann,
                    shape_type: 'AI polygon',
                    aiGenerated: true
                }));
                // Add annotations to interface
                this.addAnnotations(aiAnnotations);
                // Show success message
                this.showMessage(`✅ Detected ${result.count} objects`, 'success');
            } else {
                throw new Error(result.error || 'Detection failed');
            }
            
        } catch (error) {
            console.error('Auto-detect failed:', error);
            this.showMessage(`❌ AI Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Ray-casting algorithm for point-in-polygon
    pointInPolygon(point, vs) {
        const x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i][0], yi = vs[i][1];
            const xj = vs[j][0], yj = vs[j][1];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
    
    toggleAIMode() {
        this.aiMode = !this.aiMode;
        const canvas = this.getCanvas();
        if (this.aiMode) {
            console.log('AI Mode activated');
            this.showMessage('🤖 AI Mode: Click on objects to detect', 'info');
            if (canvas) {
                canvas.style.cursor = 'crosshair';
                // Remove any previous handler to avoid duplicates
                canvas.removeEventListener('click', this._boundAIClick);
                this._boundAIClick = this.handleAIClick.bind(this);
                canvas.addEventListener('click', this._boundAIClick);
            }
            const btn = document.querySelector('[data-ai-mode]');
            if (btn) {
                btn.textContent = 'AI Mode (ON)';
                btn.classList.add('active');
            }
        } else {
            console.log('AI Mode deactivated');
            if (canvas) {
                canvas.style.cursor = 'default';
                if (this._boundAIClick) {
                    canvas.removeEventListener('click', this._boundAIClick);
                }
            }
            const btn = document.querySelector('[data-ai-mode]');
            if (btn) {
                btn.textContent = 'AI Mode';
                btn.classList.remove('active');
            }
        }
    }
    
    async handleAIClick(event) {
            // Debug: Log all detected polygons
            console.log('[AIHandler] Detected polygons:', this.detectedPolygons);
                    // Debug: Log click coordinates
                    console.log('[AIHandler] Click at:', x, y);
                    let found = null;
                    for (let i = 0; i < this.detectedPolygons.length; i++) {
                        const ann = this.detectedPolygons[i];
                        console.log(`[AIHandler] Checking polygon ${i + 1}:`, ann.points);
                        if (this.pointInPolygon([x, y], ann.points)) {
                            console.log(`[AIHandler] Click is inside polygon ${i + 1}`);
                            found = ann;
                            break;
                        }
                    }
        if (!this.aiMode || this.aiActive) return;
        this.aiActive = true;
        try {
            // If no polygons detected yet, run detection first
            if (!this.detectedPolygons || this.detectedPolygons.length === 0) {
                await this.autoDetect();
                if (!this.detectedPolygons || this.detectedPolygons.length === 0) {
                    this.showMessage('❌ No objects detected by AI.', 'error');
                    return;
                }
            }
            // Get click coordinates relative to canvas
            const canvas = this.getCanvas();
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            // Find the polygon that contains the click point
            let found = null;
            for (let ann of this.detectedPolygons) {
                if (this.pointInPolygon([x, y], ann.points)) {
                    found = ann;
                    break;
                }
            }
            if (found) {
                this.addAnnotations([found]);
                this.showMessage(`✅ Labeled: ${found.label}`, 'success');
            } else {
                this.showMessage('❌ Click inside an object to label it.', 'error');
            }
        } finally {
            this.aiActive = false;
        }
    }
    
    // Helper methods
    getCanvas() {
        // Always return the annotation-canvas
        return document.getElementById('annotation-canvas');
    }
    
    getConfidenceValue() {
        const select = document.querySelector('[data-ai-confidence]');
        return select ? parseFloat(select.value) : 0.5;
    }
    
    addAnnotations(annotations) {
        // This function should add annotations to your labeling interface
        // You need to adapt this to work with your existing code
        
        console.log('Adding annotations:', annotations);
        
        // If you have a global function to add annotations, call it
        if (typeof window.addAnnotation === 'function') {
            annotations.forEach(ann => {
                window.addAnnotation(ann.label, ann.points, ann.shape_type, ann);
            });
        } else if (typeof window.LABELIFY !== 'undefined' && window.LABELIFY.addAnnotation) {
            // If you have a LABELIFY object
            annotations.forEach(ann => {
                window.LABELIFY.addAnnotation(ann);
            });
        } else {
            // Fallback: alert and log
            alert(`AI detected ${annotations.length} objects. Check console for details.`);
            annotations.forEach(ann => {
                console.log(`Add ${ann.label} at ${JSON.stringify(ann.points)}`);
            });
        }
    }
    
    showLoading(message) {
        let loader = document.getElementById('ai-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'ai-loader';
            loader.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px;
                background: #333;
                color: white;
                border-radius: 10px;
                z-index: 9999;
                text-align: center;
                font-family: Arial, sans-serif;
            `;
            loader.innerHTML = `<div style="border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div><p>${message}</p>`;
            document.body.appendChild(loader);
        } else {
            loader.style.display = 'block';
            loader.querySelector('p').textContent = message;
        }
    }
    hideLoading() {
        const loader = document.getElementById('ai-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }
    
    showMessage(text, type = 'info') {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
            color: white;
            border-radius: 5px;
            z-index: 9998;
            animation: fadeInOut 3s forwards;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(message);
        
        // Add CSS for animation if not already present
        if (!document.querySelector('#ai-animation-style')) {
            const style = document.createElement('style');
            style.id = 'ai-animation-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-20px); }
                    10% { opacity: 1; transform: translateY(0); }
                    90% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-20px); }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .ai-button.active {
                    background-color: #4CAF50 !important;
                    color: white !important;
                    box-shadow: 0 0 10px #4CAF50;
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
    }
}

// Create global instance
window.AIHandler = new AIHandler();