// This function updates the annotation list UI to show 'AI polygon' for AI-generated polygons
window.updateAnnotationsList = function() {
    if (!window.labelMe || !window.labelMe.shapes) return;
    const list = document.getElementById('annotationsList');
    if (!list) return;
    list.innerHTML = '';
    window.labelMe.shapes.forEach((shape, idx) => {
        let typeLabel = shape.type;
        // If this is an AI-generated polygon, show 'AI polygon'
        if (shape.type === 'polygon' && shape.aiGenerated) {
            typeLabel = 'AI polygon';
        }
        const item = document.createElement('div');
        item.className = 'annotation-item';
        item.innerHTML = `<b>${shape.label}</b> <span style='float:right;'>(${typeLabel})</span>`;
        list.appendChild(item);
    });
};
