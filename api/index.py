import os
import sys

# Make the backend package importable from this entry point
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from mangum import Mangum
from app.main import app  # noqa: E402

handler = Mangum(app, lifespan="auto")
