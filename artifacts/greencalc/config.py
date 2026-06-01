import os
from dotenv import load_dotenv

load_dotenv()

# Persistent storage root — /home/runner/greencalc/ survives Replit restarts
# (never use /tmp — Replit wipes it on every restart)
# Note: in Replit the writable home is /home/runner (not /home/user)
_PERSIST_DIR = os.getenv("GREENCALC_DATA_DIR", "/home/runner/greencalc")
os.makedirs(_PERSIST_DIR, exist_ok=True)

SECRET_KEY = os.getenv(
    "GREENCALC_SECRET_KEY",
    os.getenv("SESSION_SECRET", "greencalc-dev-secret"),
)

# Default DB path inside the persistent directory
_default_db = f"sqlite:///{_PERSIST_DIR}/greencalc.db"
DATABASE_URL = os.getenv("GREENCALC_DATABASE_URL", _default_db)

NASA_POWER_BASE_URL = os.getenv(
    "NASA_POWER_BASE_URL",
    "https://power.larc.nasa.gov/api/temporal/monthly/point",
)

# Directory for saved ML model artifacts
MODEL_ARTIFACTS_DIR = os.path.join(
    os.path.dirname(__file__), "models", "artifacts"
)
os.makedirs(MODEL_ARTIFACTS_DIR, exist_ok=True)
