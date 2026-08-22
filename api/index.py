import sys
import os

# Add root directory to python path for Vercel imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.main import app
