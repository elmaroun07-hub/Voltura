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
    wind_kwh = db.Column(db.Float, default=0.0)   # E_wind_annual
    energy_covered = db.Column(db.Float)      # min(solar+wind, consumption)
    cost_savings_eur = db.Column(db.Float)    # energy_covered * tariff
    co2_reduced_tonnes = db.Column(db.Float)  # tonnes CO₂/year
    payback_year = db.Column(db.Integer)      # first year cumulative >= cost
    npv_savings = db.Column(db.Float)         # net present value of 25yr savings
    installation_cost_eur = db.Column(db.Float)  # (pv_w/1000)*1200 spec formula
    cumulative_savings_json = db.Column(db.Text)  # JSON array [25 floats]

    # Legacy / compat fields (used by templates + PDF)
    annual_saved_kwh = db.Column(db.Float)    # = energy_covered
    annual_savings_eur = db.Column(db.Float)  # = cost_savings_eur
    co2_kg = db.Column(db.Float)              # co2_reduced_tonnes * 1000
    payback_years = db.Column(db.Float)       # float version of payback_year
    net_25yr = db.Column(db.Float)            # cumulative[-1] - install_cost

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
