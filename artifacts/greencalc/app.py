import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask
from extensions import db
from config import SECRET_KEY, DATABASE_URL


def _migrate_db(app):
    """Add any new columns to existing SQLite tables without losing data."""
    new_columns = [
        ("country_iso",       "VARCHAR(3)"),
        ("renewable_type",    "VARCHAR(50)"),
        ("wind_kw",           "FLOAT DEFAULT 0.0"),
        ("performance_ratio", "FLOAT DEFAULT 0.75"),
        ("roof_area",         "FLOAT"),
        ("num_occupants",     "INTEGER"),
        ("wind_pct",          "FLOAT DEFAULT 0.0"),
        ("boundary_violation","BOOLEAN DEFAULT 0"),
        ("nasa_source",       "VARCHAR(20) DEFAULT 'nasa'"),
    ]
    with app.app_context():
        engine = db.engine
        with engine.connect() as conn:
            from sqlalchemy import text
            for col_name, col_type in new_columns:
                try:
                    conn.execute(text(f"ALTER TABLE calculations ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass  # Column already exists — safe to ignore


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    from models.db_models import Calculation  # noqa: F401 — register model before create_all

    from routes.calculator import calculator_bp
    from routes.predictions import predictions_bp
    from routes.compliance import compliance_bp
    from routes.export import export_bp

    app.register_blueprint(calculator_bp)
    app.register_blueprint(predictions_bp)
    app.register_blueprint(compliance_bp)
    app.register_blueprint(export_bp)

    with app.app_context():
        db.create_all()

    _migrate_db(app)

    from models.ml_model import ml_model
    ml_model.ensure_ready()

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
