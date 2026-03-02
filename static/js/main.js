// Add redo keyboard shortcut (Ctrl+Y)
document.addEventListener('keydown', function(e) {
    if (!window.labelMe) return;
    if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        window.redo();
    }
});
// Undo, redo, clear button handlers
function undo() {
    if (window.labelMe) window.labelMe.undo();
}
function redo() {
    if (window.labelMe) window.labelMe.redo();
}
function clearAll() {
    if (window.labelMe) window.labelMe.clear();
}
// Additional helper functions for the LabelMe interface
// Zoom and fit button handlers
function zoomIn() {
    if (window.labelMe) window.labelMe.zoomIn();
}
function zoomOut() {
    if (window.labelMe) window.labelMe.zoomOut();
}
function fitToScreen() {
    if (window.labelMe) window.labelMe.fitToScreen();
}

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (!window.labelMe) return;
    
    switch(e.key) {
        case 'z':
        case 'Z':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                window.undo();
            }
            break;
        case 'Delete':
        case 'Backspace':
            window.deleteSelected();
            break;
        case 'Escape':
            if (window.labelMe.currentShape) {
                window.labelMe.currentShape = null;
                window.labelMe.isDrawing = false;
                window.labelMe.draw();
            }
            break;
        case '1':
            window.setTool('polygon');
            break;
        case '2':
            window.setTool('rectangle');
            break;
        case '3':
            window.setTool('ai');
            break;
    }
});

// Periodically auto-save
let autoSaveInterval = setInterval(() => {
    if (window.labelMe && window.labelMe.shapes.length > 0) {
        const data = JSON.stringify(window.labelMe.shapes);
        localStorage.setItem('labelme_autosave', data);
    }
}, 30000);

// Load auto-saved data
window.addEventListener('load', function() {
    const saved = localStorage.getItem('labelme_autosave');
    if (saved && window.labelMe) {
        try {
            const shapes = JSON.parse(saved);
            window.labelMe.shapes = shapes;
            window.labelMe.draw();
            window.updateAnnotationsList();
            window.updateStatus('Auto-saved data restored');
        } catch (e) {
            console.warn('Failed to load auto-save:', e);
        }
    }
});

// Clean up on exit
window.addEventListener('beforeunload', function(e) {
    if (window.labelMe && window.labelMe.shapes.length > 0) {
        // Optional: ask user to save
        // e.preventDefault();
        // e.returnValue = '';
    }
});
