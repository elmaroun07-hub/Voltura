from datetime import datetime
from extensions import db


class Calculation(db.Model):
    __tablename__ = "calculations"

    id = db.Column(db.Integer, primary_key=True)
    location = db.Column(db.String(200), nullable=False)
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    annual_kwh = db.Column(db.Float)
    pv_w = db.Column(db.Float)
    battery_kwh = db.Column(db.Float)
    tariff = db.Column(db.Float)
    efficiency = db.Column(db.Float)
    tilt = db.Column(db.Float)
    orientation = db.Column(db.String(20))
    installation_cost = db.Column(db.Float)
    annual_saved_kwh = db.Column(db.Float)
    annual_savings_eur = db.Column(db.Float)
    co2_kg = db.Column(db.Float)
    payback_years = db.Column(db.Float)
    net_25yr = db.Column(db.Float)
    solar_pct = db.Column(db.Float)
    battery_pct = db.Column(db.Float)
    grid_pct = db.Column(db.Float)
    computation_co2_mg = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
