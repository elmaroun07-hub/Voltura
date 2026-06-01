from datetime import datetime
from extensions import db


class Calculation(db.Model):
    __tablename__ = "calculations"

    id = db.Column(db.Integer, primary_key=True)

    # Location
    location = db.Column(db.String(200), nullable=False)
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    country_iso = db.Column(db.String(3))

    # Inputs
    annual_kwh = db.Column(db.Float)
    renewable_type = db.Column(db.String(50))       # "solar", "wind", "hybrid"
    pv_w = db.Column(db.Float)
    wind_kw = db.Column(db.Float, default=0.0)
    battery_kwh = db.Column(db.Float)
    tariff = db.Column(db.Float)
    efficiency = db.Column(db.Float)                # battery round-trip %
    tilt = db.Column(db.Float)
    orientation = db.Column(db.String(20))
    performance_ratio = db.Column(db.Float, default=0.75)
    roof_area = db.Column(db.Float)
    num_occupants = db.Column(db.Integer)
    installation_cost = db.Column(db.Float)

    # Results
    annual_saved_kwh = db.Column(db.Float)
    annual_savings_eur = db.Column(db.Float)
    co2_kg = db.Column(db.Float)
    payback_years = db.Column(db.Float)
    net_25yr = db.Column(db.Float)
    solar_pct = db.Column(db.Float)
    wind_pct = db.Column(db.Float, default=0.0)
    battery_pct = db.Column(db.Float)
    grid_pct = db.Column(db.Float)
    computation_co2_mg = db.Column(db.Float, default=0.0)

    # Flags
    boundary_violation = db.Column(db.Boolean, default=False)
    nasa_source = db.Column(db.String(20), default="nasa")  # "nasa" or "fallback"

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
