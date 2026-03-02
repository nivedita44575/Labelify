# test_torch.py
import sys
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")

try:
    import torch
    print(f"PyTorch version: {torch.__version__}")
    print(f"PyTorch CUDA available: {torch.cuda.is_available()}")
    print(f"PyTorch CUDA version: {torch.version.cuda if torch.cuda.is_available() else 'N/A'}")
    print("✅ PyTorch imported successfully!")
except Exception as e:
    print(f"❌ PyTorch import failed: {e}")