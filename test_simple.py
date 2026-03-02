# test_simple.py
import sys
print(f"Python: {sys.version}")
print(f"Executable: {sys.executable}")

print("\n1. Testing numpy...")
try:
    import numpy as np
    print(f"✅ numpy {np.__version__}")
except Exception as e:
    print(f"❌ numpy failed: {e}")

print("\n2. Testing PyTorch...")
try:
    import torch
    print(f"✅ torch {torch.__version__}")
    print(f"   CUDA available: {torch.cuda.is_available()}")
except Exception as e:
    print(f"❌ torch failed: {e}")
    import traceback
    traceback.print_exc()

print("\n3. Testing YOLO...")
try:
    from ultralytics import YOLO
    print("✅ ultralytics imported")
    
    # Just test import, don't load model yet
    print("   YOLO import successful")
except Exception as e:
    print(f"❌ ultralytics failed: {e}")

print("\n4. Testing OpenCV...")
try:
    import cv2
    print(f"✅ OpenCV {cv2.__version__}")
except Exception as e:
    print(f"❌ OpenCV failed: {e}")