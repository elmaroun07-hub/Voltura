from datetime import datetime
from extensions import db


class Calculation(db.Model):
    __tablename__ = "calculations"

    # Primary key + UUID (spec: id UUID)
    id = db.Column(db.Integer, primary_key=True)
    calc_uuid = db.Column(db.String(36), unique=True, index=True)

    # Session / audit
    session_id = db.Column(db.String(64))
    input_hash = db.Column(db.String(16), index=True)

    # Location
    location = db.Column(db.String(200), nullable=False)
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    country_iso = db.Column(db.String(3))

    # Inputs
    annual_kwh = db.Column(db.Float)
    renewable_type = db.Column(db.String(50))
    pv_w = db.Column(db.Float)
    wind_kw = db.Column(db.Float, default=0.0)
    battery_kwh = db.Column(db.Float)
    tariff = db.Column(db.Float)
    efficiency = db.Column(db.Float)          # battery round-trip %
    tilt = db.Column(db.Float)
    orientation = db.Column(db.String(20))
    performance_ratio = db.Column(db.Float, default=0.75)
    roof_area = db.Column(db.Float)
    num_occupants = db.Column(db.Integer)
    installation_cost = db.Column(db.Float)   # user-provided or auto-estimated

    # Block 3 spec output fields
    solar_kwh = db.Column(db.Float)           # E_solar_annual
    wind_kwh = db.Column(db.Float, default=0.0)
    energy_covered = db.Column(db.Float)
    cost_savings_eur = db.Column(db.Float)
    co2_reduced_tonnes = db.Column(db.Float)
    payback_year = db.Column(db.Integer)
    npv_savings = db.Column(db.Float)
    installation_cost_eur = db.Column(db.Float)
    cumulative_savings_json = db.Column(db.Text)

    # Legacy / template-compat fields
    annual_saved_kwh = db.Column(db.Float)
    annual_savings_eur = db.Column(db.Float)
    co2_kg = db.Column(db.Float)
    payback_years = db.Column(db.Float)
    net_25yr = db.Column(db.Float)

    # Energy mix
    solar_pct = db.Column(db.Float)
    wind_pct = db.Column(db.Float, default=0.0)
    battery_pct = db.Column(db.Float)
    grid_pct = db.Column(db.Float)

    # Metadata
    computation_co2_mg = db.Column(db.Float, default=0.0)
    boundary_violation = db.Column(db.Boolean, default=False)
    nasa_source = db.Column(db.String(20), default="nasa")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ModelMetrics(db.Model):
    """Block 4: records training metrics for each PVOptimizationModel run."""
    __tablename__ = "model_metrics"

    id               = db.Column(db.Integer, primary_key=True)
    timestamp        = db.Column(db.DateTime, default=datetime.utcnow)
    model_version    = db.Column(db.String(8), index=True)   # YYYYMMDD
    r2               = db.Column(db.Float)
    mae              = db.Column(db.Float)
    rmse             = db.Column(db.Float)
    training_samples = db.Column(db.Integer)
    seed             = db.Column(db.Integer)
    geographic_scope = db.Column(db.String(100))
    # Regional MAE breakdown
    mae_southern_eu  = db.Column(db.Float)   # lat < 42
    mae_northern_eu  = db.Column(db.Float)   # lat >= 42
    mae_north_africa = db.Column(db.Float)   # lat < 35
