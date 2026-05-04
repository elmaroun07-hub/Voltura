import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("GREENCALC_SECRET_KEY", os.getenv("SESSION_SECRET", "greencalc-dev-secret"))
DATABASE_URL = os.getenv("GREENCALC_DATABASE_URL", "sqlite:///greencalc.db")
NASA_POWER_BASE_URL = os.getenv(
    "NASA_POWER_BASE_URL",
    "https://power.larc.nasa.gov/api/temporal/monthly/point"
)
