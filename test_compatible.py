# test_compatible.py
import sys
print(f"Python: {sys.version}")
print(f"Python path: {sys.executable}")

print("\n=== Testing Compatibility ===")

# Test 1: NumPy
try:
    import numpy as np
    print(f"✅ NumPy {np.__version__}")
    print(f"   NumPy < 2.0: {int(np.__version__.split('.')[0]) < 2}")
except Exception as e:
    print(f"❌ NumPy failed: {e}")

# Test 2: OpenCV
try:
    import cv2
    print(f"✅ OpenCV {cv2.__version__}")
except Exception as e:
    print(f"❌ OpenCV failed: {e}")

# Test 3: PyTorch
try:
    import torch
    print(f"✅ PyTorch {torch.__version__}")
    print(f"   CUDA available: {torch.cuda.is_available()}")
except Exception as e:
    print(f"❌ PyTorch failed: {e}")

# Test 4: YOLO
try:
    from ultralytics import YOLO
    print("✅ ultralytics imported")
    
    # Test model creation
    model = YOLO('yolov8n.pt')
    print("✅ YOLO model created successfully")
    
    # Quick test
    print("   Model test passed!")
except Exception as e:
    print(f"❌ YOLO failed: {e}")
    import traceback
    traceback.print_exc()

# Test 5: PIL
try:
    from PIL import Image
    print("✅ PIL imported")
except Exception as e:
    print(f"❌ PIL failed: {e}")

print("\n=== All Tests Complete ===")