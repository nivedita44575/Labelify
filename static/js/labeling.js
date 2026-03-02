// ============================================
// LABELING.JS - FLASK INTEGRATION
// ============================================

let currentImageFilename = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get filename from ?image=... query param, and remove any path
    const params = new URLSearchParams(window.location.search);
    let filename = params.get('image');
    if (filename) {
        filename = filename.split('/').pop(); // get just the file name
    }
    currentImageFilename = filename;

    // Set image name
    const imageNameInput = document.getElementById('imageName');
    if (imageNameInput) {
        imageNameInput.value = filename;
    }

    // Load image from Flask server
    const imgElement = document.getElementById('uploadedImage');
    if (imgElement) {
        const serverUrl = imgElement.dataset.imageUrl;
        imgElement.src = serverUrl && serverUrl.length > 0 ? serverUrl : `/static/uploads/${filename}`;

        // Trigger canvas initialization after image loads
        imgElement.onload = function() {
            console.log('Image loaded in labeling.js');
            // canvas-drawing.js will initialize automatically
        };

        imgElement.onerror = function() {
            console.error('Failed to load image');
            alert('Failed to load image. Please try uploading again.');
        };
    }
});

// ============================================
// INITIALIZE LABELING PAGE (FLASK)
// ============================================

function initializeLabelingPage() {
    // Get filename from URL
    const filename = window.location.pathname.split('/').pop();
    currentImageFilename = filename;
    
    // Set image name
    const imageNameInput = document.getElementById('imageName');
    if (imageNameInput) {
        imageNameInput.value = filename;
    }
    
    // Load image from Flask server
    const imgElement = document.getElementById('uploadedImage');
    if (imgElement) {
        const serverUrl = imgElement.dataset.imageUrl;
        imgElement.src = serverUrl && serverUrl.length > 0 ? serverUrl : `/static/uploads/${filename}`;
        
        // Trigger canvas initialization after image loads
        imgElement.onload = function() {
            console.log('Image loaded in labeling.js');
            // canvas-drawing.js will initialize automatically
        };
        
        imgElement.onerror = function() {
            console.error('Failed to load image');
            alert('Failed to load image. Please try uploading again.');
        };
    }
}

// ============================================
// SUBMIT LABELS AND SAVE TO FLASK
// ============================================

function submitLabels() {
    if (!currentImageFilename) {
        alert('No image selected for labeling');
        return;
    }
    
    const annotations = getAnnotations();
    
    if (annotations.length === 0) {
        alert('Please add at least one label before submitting');
        return;
    }
    
    // Get image dimensions
    const imgElement = document.getElementById('uploadedImage');
    const imageWidth = imgElement.naturalWidth;
    const imageHeight = imgElement.naturalHeight;
    
    // Convert annotations to format expected by Flask, including customLabel
    const labels = annotations.map(ann => ({
        type: ann.type,
        classId: ann.plasticType,
        customLabel: ann.customLabel || null,
        points: convertAnnotationToPoints(ann)
    }));

    // Prepare data for Flask backend
    const labelData = {
        filename: currentImageFilename,
        labels: labels,
        imageWidth: imageWidth,
        imageHeight: imageHeight
    };

    console.log('Sending label data:', labelData);

    // Send to Flask backend
    fetch('/save-labels', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(labelData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Show labeling completed popup
            showLabelingCompletedPopup(data);
        } else {
            showErrorMessage('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorMessage('Failed to save labels');
    });
}

// ============================================
// CONVERT ANNOTATION TO POINTS
// ============================================

function convertAnnotationToPoints(annotation) {
    const points = [];
    
    switch(annotation.type) {
        case 'rectangle':
            points.push({x: annotation.x, y: annotation.y});
            points.push({x: annotation.x + annotation.width, y: annotation.y + annotation.height});
            break;
        case 'circle':
            points.push({x: annotation.cx, y: annotation.cy, r: annotation.radius});
            break;
        case 'polygon':
            return annotation.points;
        case 'freehand':
            return annotation.points;
    }
    
    return points;
}

// ============================================
// SHOW SUCCESS MESSAGE
// ============================================

function showSuccessMessage(message) {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message success-message';
        statusDiv.style.display = 'block';
    }
}

// ============================================
// SHOW ERROR MESSAGE
// ============================================

function showErrorMessage(message) {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.textContent = ' ' + message;
        statusDiv.className = 'status-message error-message';
        statusDiv.style.display = 'block';
    }
}

// ============================================
// SHOW LABELING COMPLETED POPUP
// ============================================

function showLabelingCompletedPopup(data) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        text-align: center;
        max-width: 400px;
    `;
    
    const fileName = currentImageFilename.replace(/\.[^/.]+$/, '') + '.txt';
    // Show all folders/classes saved
    let folderMsg = '';
    if (data.categories && data.categories.length > 0) {
        folderMsg = `<ul style='text-align:left;'>` + data.categories.map(cat => `<li>Saved in <strong>${cat.replace(/_/g, ' ')}</strong> folder</li>`).join('') + `</ul>`;
    }
    popup.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
        <h2 style="color: #28a745; margin-bottom: 15px;">Labeling Completed!</h2>
        <p style="color: #333; margin-bottom: 20px;">
            <strong>${fileName}</strong> has been saved.<br>
            ${folderMsg}
        </p>
        <button onclick="closePopupAndRedirect()" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(102, 126, 234, 0.3)'" 
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            OK
        </button>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Close function - redirects to home page
    window.closePopupAndRedirect = function() {
        overlay.remove();
        window.location.href = '/home';
    };
    
    // Auto redirect after 5 seconds
    setTimeout(() => {
        if (document.body.contains(overlay)) {
            overlay.remove();
            window.location.href = '/home';
        }
    }, 5000);
}

// ============================================
// GO BACK
// ============================================

function goBack() {
    window.location.href = '/';
}

function handleCategoryChange() {
    const customInput = document.getElementById('customCategory');
    // Always hide and clear custom input for all types
    customInput.style.display = 'none';
    customInput.value = '';
}
