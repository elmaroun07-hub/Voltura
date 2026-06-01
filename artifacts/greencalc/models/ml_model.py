"""
GreenCalc ML models — two independent models:

1. GreenMLModel  — RandomForest on hourly features (month, hour, irradiance, temp)
                   Target: hourly consumption kWh  (used by results page / SHAP chart)

2. PVOptimizationModel — GradientBoosting trio (main, lower α=0.1, upper α=0.9)
                         Features: [month, latitude, irradiance, avg_temp,
                                    household_size, current_consumption_kwh]
                         Target: optimal_pv_wattage  (used by /predict API)
                         Training: 2000 synthetic samples, NumPy seed 42
"""
import logging
import os
import glob
import joblib
import numpy as np
from datetime import date
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────

_LOCAL_ARTIFACTS = os.path.join(os.path.dirname(__file__), "artifacts")
_RUNNER_ARTIFACTS = "/home/runner/greencalc/models/artifacts"
_ARTIFACTS_DIR = _RUNNER_ARTIFACTS if os.access("/home/runner", os.W_OK) else _LOCAL_ARTIFACTS
os.makedirs(_ARTIFACTS_DIR, exist_ok=True)
os.makedirs(_LOCAL_ARTIFACTS, exist_ok=True)

# ── Legacy model (GreenMLModel) ───────────────────────────────────────────────
MODEL_PATH = os.path.join(_LOCAL_ARTIFACTS, "rf_model.pkl")
FEATURE_NAMES = ["month", "hour", "irradiance", "temperature"]


def _generate_synthetic_data(n_samples: int = 8760) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    hours = np.arange(n_samples) % 24
    days = np.arange(n_samples) // 24
    months = (days % 365 * 12 // 365) + 1

    irr_base = np.array([2.8, 3.2, 4.0, 4.8, 5.5, 6.0, 5.9, 5.4, 4.5, 3.5, 2.9, 2.5])
    irradiance = irr_base[months - 1] * np.clip(
        np.sin(np.pi * (hours - 6) / 12), 0, 1
    ) + rng.normal(0, 0.2, n_samples)
    irradiance = np.clip(irradiance, 0, None)

    temp_base = np.array([2, 3, 7, 12, 17, 21, 23, 22, 18, 13, 7, 3])
    temperature = temp_base[months - 1] + rng.normal(0, 2, n_samples)

    morning_peak = np.exp(-0.5 * ((hours - 7.5) / 1.5) ** 2)
    evening_peak = np.exp(-0.5 * ((hours - 19.0) / 2.0) ** 2)
    consumption = (0.25 + 0.8 * morning_peak + 1.0 * evening_peak) * (
        1 + 0.1 * rng.standard_normal(n_samples)
    )
    consumption = np.clip(consumption, 0.05, 3.0)

    X = np.column_stack([months, hours, irradiance, temperature])
    return X, consumption


class GreenMLModel:
    def __init__(self):
        self.model = None

    def train(self):
        X, y = _generate_synthetic_data()
        self.model = RandomForestRegressor(
            n_estimators=50, max_depth=10, random_state=42, n_jobs=-1
        )
        self.model.fit(X, y)
        joblib.dump(self.model, MODEL_PATH)

    def load(self) -> bool:
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
            return True
        return False

    def ensure_ready(self):
        if self.model is None:
            if not self.load():
                self.train()

    def predict(self, month: int, hour: int, irradiance: float, temperature: float) -> float:
        self.ensure_ready()
        X = np.array([[month, hour, irradiance, temperature]])
        return float(self.model.predict(X)[0])

    def explain(self, month: int, hour: int, irradiance: float, temperature: float) -> dict:
        self.ensure_ready()
        try:
            import shap
            explainer = shap.TreeExplainer(self.model)
            X = np.array([[month, hour, irradiance, temperature]])
            shap_values = explainer.shap_values(X)
            vals = shap_values[0] if shap_values.ndim > 1 else shap_values
            return {name: round(float(v), 4) for name, v in zip(FEATURE_NAMES, vals)}
        except Exception:
            return {name: 0.0 for name in FEATURE_NAMES}

    def feature_importance(self) -> dict:
        self.ensure_ready()
        imp = self.model.feature_importances_
        return {name: round(float(v), 4) for name, v in zip(FEATURE_NAMES, imp)}


ml_model = GreenMLModel()


# ── PV Optimization model (Block 4) ──────────────────────────────────────────

PV_FEATURE_NAMES = [
    "month", "latitude", "irradiance_kwh_m2_day",
    "avg_temp_c", "household_size", "current_consumption_kwh",
]

_PLAIN_LANG = {
    "irradiance_kwh_m2_day":   "your location receives {val:.1f} kWh/m²/day of solar irradiance",
    "current_consumption_kwh": "your household uses {val:.0f} kWh/year",
    "latitude":                "your latitude ({val:.1f}°) determines seasonal solar hours",
    "avg_temp_c":              "the local temperature ({val:.1f}°C) affects panel efficiency",
    "household_size":          "a household of {val:.0f} drives daily energy demand",
    "month":                   "planning for month {val:.0f} captures seasonal variation",
}


def _generate_pv_training_data(n_samples: int = 2000) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """2000-sample synthetic dataset. NumPy seed 42 (documented at /model-info)."""
    rng = np.random.default_rng(42)

    latitude         = rng.uniform(28, 60, n_samples)
    irradiance       = 4.5 - (latitude - 28) * 0.05 + rng.normal(0, 0.3, n_samples)
    irradiance       = np.clip(irradiance, 1.0, 8.0)
    consumption      = rng.normal(4500, 1500, n_samples)
    consumption      = np.clip(consumption, 500, 50000)
    month            = rng.integers(1, 13, n_samples).astype(float)
    avg_temp         = 15.0 + (45.0 - latitude) * 0.5 + rng.normal(0, 3, n_samples)
    household_size   = rng.integers(1, 7, n_samples).astype(float)
    optimal_wattage  = (consumption / 1200) * 1000 + rng.normal(0, 200, n_samples)
    optimal_wattage  = np.clip(optimal_wattage, 100, 20000)

    X = np.column_stack([month, latitude, irradiance, avg_temp, household_size, consumption])
    return X, optimal_wattage, latitude  # latitude returned for regional MAE split


class PVOptimizationModel:
    """Three GradientBoosting models: main + lower/upper quantile (α=0.1/0.9)."""

    SEED = 42
    GEO_SCOPE = "Spain + Morocco + EU (lat 28–60)"

    def __init__(self):
        self.model_main  = None
        self.model_lower = None
        self.model_upper = None
        self.model_version: str = ""
        self.metrics: dict = {}

    # ── Persistence ───────────────────────────────────────────────────────────

    def _artifact_path(self) -> str:
        today = date.today().strftime("%Y%m%d")
        return os.path.join(_ARTIFACTS_DIR, f"model_v{today}.pkl")

    def _latest_artifact(self) -> str | None:
        pattern = os.path.join(_ARTIFACTS_DIR, "model_v*.pkl")
        files = sorted(glob.glob(pattern), reverse=True)  # date-desc sort
        return files[0] if files else None

    def save(self):
        path = self._artifact_path()
        payload = {
            "main": self.model_main,
            "lower": self.model_lower,
            "upper": self.model_upper,
            "version": self.model_version,
            "metrics": self.metrics,
        }
        joblib.dump(payload, path)
        logger.info("PVOptimizationModel saved → %s", path)

    def load(self) -> bool:
        path = self._latest_artifact()
        if path is None:
            return False
        try:
            payload = joblib.load(path)
            self.model_main  = payload["main"]
            self.model_lower = payload["lower"]
            self.model_upper = payload["upper"]
            self.model_version = payload.get("version", os.path.basename(path)[8:16])
            self.metrics     = payload.get("metrics", {})
            logger.info("PVOptimizationModel loaded ← %s", path)
            return True
        except Exception as exc:
            logger.warning("Failed to load PV model artifact %s: %s", path, exc)
            return False

    # ── Training ──────────────────────────────────────────────────────────────

    def train(self):
        logger.info("Training PVOptimizationModel (seed=%d, n=2000)…", self.SEED)
        X, y, latitude = _generate_pv_training_data(2000)
        X_train, X_test, y_train, y_test, lat_train, lat_test = train_test_split(
            X, y, latitude, test_size=0.2, random_state=self.SEED
        )

        self.model_main  = GradientBoostingRegressor(
            n_estimators=100, max_depth=4, random_state=self.SEED
        )
        self.model_lower = GradientBoostingRegressor(
            loss="quantile", alpha=0.1, n_estimators=100, max_depth=4, random_state=self.SEED
        )
        self.model_upper = GradientBoostingRegressor(
            loss="quantile", alpha=0.9, n_estimators=100, max_depth=4, random_state=self.SEED
        )

        self.model_main.fit(X_train, y_train)
        self.model_lower.fit(X_train, y_train)
        self.model_upper.fit(X_train, y_train)

        y_pred = self.model_main.predict(X_test)
        r2   = float(r2_score(y_test, y_pred))
        mae  = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

        # Regional MAE
        def _regional_mae(mask):
            if mask.sum() == 0:
                return None
            return float(mean_absolute_error(y_test[mask], y_pred[mask]))

        mae_southern = _regional_mae(lat_test < 42)
        mae_northern = _regional_mae(lat_test >= 42)
        mae_africa   = _regional_mae(lat_test < 35)

        self.model_version = date.today().strftime("%Y%m%d")
        self.metrics = {
            "r2": round(r2, 4), "mae": round(mae, 2), "rmse": round(rmse, 2),
            "training_samples": 2000, "seed": self.SEED,
            "geographic_scope": self.GEO_SCOPE,
            "mae_southern_eu":  round(mae_southern, 2) if mae_southern else None,
            "mae_northern_eu":  round(mae_northern, 2) if mae_northern else None,
            "mae_north_africa": round(mae_africa, 2)   if mae_africa   else None,
        }
        logger.info(
            "PVOptimizationModel trained: R²=%.4f MAE=%.1f RMSE=%.1f", r2, mae, rmse
        )
        self._persist_metrics_to_db()
        self.save()

    def _persist_metrics_to_db(self):
        """Write training metrics to model_metrics table (best-effort)."""
        try:
            from extensions import db
            from models.db_models import ModelMetrics
            from flask import current_app
            with current_app.app_context():
                row = ModelMetrics(
                    model_version    = self.model_version,
                    r2               = self.metrics["r2"],
                    mae              = self.metrics["mae"],
                    rmse             = self.metrics["rmse"],
                    training_samples = self.metrics["training_samples"],
                    seed             = self.metrics["seed"],
                    geographic_scope = self.metrics["geographic_scope"],
                    mae_southern_eu  = self.metrics.get("mae_southern_eu"),
                    mae_northern_eu  = self.metrics.get("mae_northern_eu"),
                    mae_north_africa = self.metrics.get("mae_north_africa"),
                )
                db.session.add(row)
                db.session.commit()
        except Exception as exc:
            logger.warning("Could not persist model metrics to DB: %s", exc)

    def ensure_ready(self):
        if self.model_main is None:
            if not self.load():
                self.train()

    # ── Prediction ────────────────────────────────────────────────────────────

    def predict_pv(
        self,
        month: int,
        latitude: float,
        irradiance: float,
        avg_temp: float,
        household_size: int,
        consumption_kwh: float,
    ) -> tuple[float, float, float]:
        """Returns (main, lower, upper) recommended PV wattage."""
        self.ensure_ready()
        X = np.array([[month, latitude, irradiance, avg_temp, household_size, consumption_kwh]])
        main  = float(self.model_main.predict(X)[0])
        lower = float(self.model_lower.predict(X)[0])
        upper = float(self.model_upper.predict(X)[0])
        # Ensure lower ≤ main ≤ upper in output (model may produce crossing quantiles)
        lo, hi = min(lower, main, upper), max(lower, main, upper)
        return round(main, 1), round(lo, 1), round(hi, 1)

    # ── SHAP explainability ───────────────────────────────────────────────────

    def explain_top3(
        self,
        month: int,
        latitude: float,
        irradiance: float,
        avg_temp: float,
        household_size: int,
        consumption_kwh: float,
        tariff: float = 0.20,
    ) -> tuple[list[dict], str]:
        """Return (top_features list, plain-language explanation string).

        top_features items: {"feature": str, "impact": str, "direction": str}
        """
        self.ensure_ready()
        X = np.array([[month, latitude, irradiance, avg_temp, household_size, consumption_kwh]])
        input_vals = dict(zip(PV_FEATURE_NAMES, X[0]))

        try:
            import shap
            explainer  = shap.TreeExplainer(self.model_main)
            shap_arr   = explainer.shap_values(X)
            sv         = shap_arr[0] if hasattr(shap_arr, "__len__") else shap_arr
            # Top-3 by absolute SHAP value
            sorted_idx = np.argsort(np.abs(sv))[::-1][:3]
            impact_kwh_per_w = tariff * 25  # rough 25yr impact scale for display
            top_features = []
            for i in sorted_idx:
                name   = PV_FEATURE_NAMES[i]
                impact = float(sv[i])
                impact_kwh = round(impact * impact_kwh_per_w, 1)
                direction  = "positive" if impact >= 0 else "negative"
                top_features.append({
                    "feature":   name,
                    "impact":    f"{'+' if impact >= 0 else ''}{impact_kwh} kWh/year",
                    "direction": direction,
                    "shap_val":  round(impact, 3),
                })
            # Plain-language from most impactful feature
            top_name = PV_FEATURE_NAMES[sorted_idx[0]]
            top_val  = input_vals[top_name]
            top_shap = float(sv[sorted_idx[0]])
            top_kwh  = round(top_shap * impact_kwh_per_w, 0)
            phrase   = _PLAIN_LANG.get(top_name, "the input {val}").format(val=top_val)
            sign     = "+" if top_shap >= 0 else ""
            explanation = (
                f"Solar output is {'high' if top_shap >= 0 else 'lower'} because "
                f"{phrase} (impact: {sign}{top_kwh:.0f} kWh/year)."
            )
        except Exception as exc:
            logger.warning("SHAP explain failed: %s", exc)
            top_features = [
                {"feature": n, "impact": "n/a", "direction": "unknown", "shap_val": 0.0}
                for n in PV_FEATURE_NAMES[:3]
            ]
            explanation = "Physics-based calculation used — SHAP explanation unavailable."

        return top_features, explanation


pv_model = PVOptimizationModel()
