from datetime import datetime
from extensions import db


class Calculation(db.Model):
    __tablename__ = "calculations"

    id = db.Column(db.Integer, primary_key=True)
    calc_uuid = db.Column(db.String(36), unique=True, index=True)

    session_id = db.Column(db.String(64))
    input_hash = db.Column(db.String(16), index=True)

    location = db.Column(db.String(200), nullable=False)
    # Block 6 GDPR: lat/lon only written when user opts in
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    location_opt_in = db.Column(db.Boolean, default=False)

    country_iso = db.Column(db.String(3))

    annual_kwh = db.Column(db.Float)
    renewable_type = db.Column(db.String(50))
    pv_w = db.Column(db.Float)
    wind_kw = db.Column(db.Float, default=0.0)
    battery_kwh = db.Column(db.Float)
    tariff = db.Column(db.Float)
    efficiency = db.Column(db.Float)
    tilt = db.Column(db.Float)
    orientation = db.Column(db.String(20))
    performance_ratio = db.Column(db.Float, default=0.75)
    roof_area = db.Column(db.Float)
    num_occupants = db.Column(db.Integer)
    installation_cost = db.Column(db.Float)

    # Block 3 spec fields
    solar_kwh = db.Column(db.Float)
    wind_kwh = db.Column(db.Float, default=0.0)
    energy_covered = db.Column(db.Float)
    cost_savings_eur = db.Column(db.Float)
    co2_reduced_tonnes = db.Column(db.Float)
    payback_year = db.Column(db.Integer)
    npv_savings = db.Column(db.Float)
    installation_cost_eur = db.Column(db.Float)
    cumulative_savings_json = db.Column(db.Text)

    # Template-compat aliases
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
    boundary_violation = db.Column(db.Boolean, default=False)
    nasa_source = db.Column(db.String(20), default="nasa")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    emissions = db.relationship(
        "CalculationEmissions", back_populates="calculation",
        uselist=False, cascade="all, delete-orphan",
    )
    feedback = db.relationship(
        "UserFeedback", back_populates="calculation",
        uselist=False, cascade="all, delete-orphan",
    )
    overrides = db.relationship(
        "UserOverride", back_populates="calculation",
        cascade="all, delete-orphan",
    )


class CalculationEmissions(db.Model):
    """Block 5: per-calculation CodeCarbon emissions record.
    Location coordinates are NOT stored here — only country_iso.
    """
    __tablename__ = "calculation_emissions"

    id = db.Column(db.Integer, primary_key=True)
    calculation_id = db.Column(
        db.Integer, db.ForeignKey("calculations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    emissions_kg = db.Column(db.Float, nullable=False, default=0.0)
    duration_seconds = db.Column(db.Float, default=0.0)
    energy_consumed_kwh = db.Column(db.Float, default=0.0)
    country_iso = db.Column(db.String(3))

    calculation = db.relationship("Calculation", back_populates="emissions")


class ModelMetrics(db.Model):
    """Block 4: training metrics for each PVOptimizationModel run."""
    __tablename__ = "model_metrics"

    id               = db.Column(db.Integer, primary_key=True)
    timestamp        = db.Column(db.DateTime, default=datetime.utcnow)
    model_version    = db.Column(db.String(8), index=True)
    r2               = db.Column(db.Float)
    mae              = db.Column(db.Float)
    rmse             = db.Column(db.Float)
    training_samples = db.Column(db.Integer)
    seed             = db.Column(db.Integer)
    geographic_scope = db.Column(db.String(100))
    mae_southern_eu  = db.Column(db.Float)
    mae_northern_eu  = db.Column(db.Float)
    mae_north_africa = db.Column(db.Float)


class UserFeedback(db.Model):
    """Block 6 Article 14: human oversight feedback (thumbs up/down)."""
    __tablename__ = "user_feedback"

    id             = db.Column(db.Integer, primary_key=True)
    calculation_id = db.Column(
        db.Integer, db.ForeignKey("calculations.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    session_id  = db.Column(db.String(64), index=True)
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow)
    rating      = db.Column(db.Integer)   # 1 = thumbs up, -1 = thumbs down
    comment     = db.Column(db.Text)

    calculation = db.relationship("Calculation", back_populates="feedback")


class UserOverride(db.Model):
    """Block 6 Article 14: manual override of any numeric output field."""
    __tablename__ = "user_overrides"

    id             = db.Column(db.Integer, primary_key=True)
    calculation_id = db.Column(
        db.Integer, db.ForeignKey("calculations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    session_id      = db.Column(db.String(64), index=True)
    timestamp       = db.Column(db.DateTime, default=datetime.utcnow)
    field_name      = db.Column(db.String(64))
    original_value  = db.Column(db.String(64))
    override_value  = db.Column(db.String(64))

    calculation = db.relationship("Calculation", back_populates="overrides")


class AuditLog(db.Model):
    """Block 6 Article 73: audit log, minimum 3-year retention."""
    __tablename__ = "audit_log"

    id                 = db.Column(db.Integer, primary_key=True)
    timestamp          = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    session_id         = db.Column(db.String(64), index=True)
    endpoint           = db.Column(db.String(128))
    input_hash         = db.Column(db.String(64))   # full SHA-256 hex
    output_summary     = db.Column(db.Text)          # JSON blob
    model_version      = db.Column(db.String(16))
    fallback_used      = db.Column(db.Boolean, default=False)
    boundary_violation = db.Column(db.Boolean, default=False)
    emissions_kg       = db.Column(db.Float, default=0.0)
    user_feedback_id   = db.Column(
        db.Integer, db.ForeignKey("user_feedback.id", ondelete="SET NULL"),
        nullable=True,
    )
