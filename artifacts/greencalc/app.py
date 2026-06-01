import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask
from extensions import db
from config import SECRET_KEY, DATABASE_URL


def _migrate_db(app):
    """Add any new columns to existing SQLite tables without data loss."""
    new_columns = [
        # Block 2
        ("calculations", "country_iso",            "VARCHAR(3)"),
        ("calculations", "renewable_type",          "VARCHAR(50)"),
        ("calculations", "wind_kw",                 "FLOAT DEFAULT 0.0"),
        ("calculations", "performance_ratio",       "FLOAT DEFAULT 0.75"),
        ("calculations", "roof_area",               "FLOAT"),
        ("calculations", "num_occupants",           "INTEGER"),
        ("calculations", "wind_pct",                "FLOAT DEFAULT 0.0"),
        ("calculations", "boundary_violation",      "BOOLEAN DEFAULT 0"),
        ("calculations", "nasa_source",             "VARCHAR(20) DEFAULT 'nasa'"),
        # Block 3
        ("calculations", "calc_uuid",               "VARCHAR(36)"),
        ("calculations", "session_id",              "VARCHAR(64)"),
        ("calculations", "input_hash",              "VARCHAR(16)"),
        ("calculations", "solar_kwh",               "FLOAT"),
        ("calculations", "wind_kwh",                "FLOAT DEFAULT 0.0"),
        ("calculations", "energy_covered",          "FLOAT"),
        ("calculations", "cost_savings_eur",        "FLOAT"),
        ("calculations", "co2_reduced_tonnes",      "FLOAT"),
        ("calculations", "payback_year",            "INTEGER"),
        ("calculations", "npv_savings",             "FLOAT"),
        ("calculations", "installation_cost_eur",   "FLOAT"),
        ("calculations", "cumulative_savings_json", "TEXT"),
    ]
    with app.app_context():
        engine = db.engine
        with engine.connect() as conn:
            from sqlalchemy import text
            for table, col_name, col_type in new_columns:
                try:
                    conn.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                    ))
                    conn.commit()
                except Exception:
                    pass  # already exists — safe to skip


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    from models.db_models import Calculation, CalculationEmissions, ModelMetrics  # noqa: F401

    from routes.calculator import calculator_bp
    from routes.predictions import predictions_bp
    from routes.compliance import compliance_bp
    from routes.export import export_bp

    app.register_blueprint(calculator_bp)
    app.register_blueprint(predictions_bp)
    app.register_blueprint(compliance_bp)
    app.register_blueprint(export_bp)

    with app.app_context():
        db.create_all()  # creates calculation_emissions if not present

    _migrate_db(app)

    from models.ml_model import ml_model, pv_model
    ml_model.ensure_ready()
    pv_model.ensure_ready()

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
