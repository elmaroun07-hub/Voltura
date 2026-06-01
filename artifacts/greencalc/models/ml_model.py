import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor

# Model artifact stored under models/artifacts/ (committed path, not /tmp)
_ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
os.makedirs(_ARTIFACTS_DIR, exist_ok=True)
MODEL_PATH = os.path.join(_ARTIFACTS_DIR, "rf_model.pkl")

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
    base_load = 0.25
    consumption = (base_load + 0.8 * morning_peak + 1.0 * evening_peak) * (
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
