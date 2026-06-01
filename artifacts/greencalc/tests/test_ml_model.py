"""
ML model tests — Block 1 GreenMLModel (legacy RF) + Block 4 PVOptimizationModel.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest
from models.ml_model import (
    GreenMLModel, FEATURE_NAMES, _generate_synthetic_data,
    PVOptimizationModel, PV_FEATURE_NAMES, _generate_pv_training_data,
)


# ── Legacy GreenMLModel fixtures ─────────────────────────────────────────────

@pytest.fixture(scope="module")
def trained_model():
    m = GreenMLModel()
    m.ensure_ready()
    return m


# ── Legacy GreenMLModel tests ────────────────────────────────────────────────

def test_feature_names_count():
    assert len(FEATURE_NAMES) == 4


def test_feature_names_values():
    assert FEATURE_NAMES == ["month", "hour", "irradiance", "temperature"]


def test_synthetic_data_shape():
    X, y = _generate_synthetic_data(n_samples=8760)
    assert X.shape == (8760, 4)
    assert y.shape == (8760,)


def test_synthetic_data_ranges():
    X, y = _generate_synthetic_data(n_samples=8760)
    months     = X[:, 0]
    hours      = X[:, 1]
    irradiance = X[:, 2]
    assert months.min() >= 1 and months.max() <= 12
    assert hours.min() >= 0 and hours.max() <= 23
    assert irradiance.min() >= 0
    assert y.min() >= 0


def test_predict_returns_float(trained_model):
    result = trained_model.predict(6, 12, 5.0, 20.0)
    assert isinstance(result, float)
    assert result > 0


def test_predict_range(trained_model):
    result = trained_model.predict(6, 12, 5.0, 20.0)
    assert 0.0 < result < 5.0


def test_predict_different_inputs(trained_model):
    p1 = trained_model.predict(1, 2, 1.0, -5.0)
    p2 = trained_model.predict(7, 14, 6.0, 30.0)
    assert p1 != p2


def test_feature_importance_keys(trained_model):
    imp = trained_model.feature_importance()
    assert set(imp.keys()) == set(FEATURE_NAMES)


def test_feature_importance_sums_to_one(trained_model):
    imp = trained_model.feature_importance()
    total = sum(imp.values())
    assert abs(total - 1.0) < 0.01


def test_explain_returns_all_features(trained_model):
    shap_vals = trained_model.explain(6, 12, 5.0, 20.0)
    assert set(shap_vals.keys()) == set(FEATURE_NAMES)


def test_explain_values_are_floats(trained_model):
    shap_vals = trained_model.explain(6, 12, 5.0, 20.0)
    for k, v in shap_vals.items():
        assert isinstance(v, float), f"{k} SHAP value is not float"


def test_model_persistence(tmp_path):
    import joblib
    m1 = GreenMLModel()
    m1.train()
    tmp_pkl = str(tmp_path / "test_rf.pkl")
    joblib.dump(m1.model, tmp_pkl)

    m2 = GreenMLModel()
    m2.model = joblib.load(tmp_pkl)
    p1 = float(m1.model.predict([[6, 12, 5.0, 20.0]])[0])
    p2 = float(m2.model.predict([[6, 12, 5.0, 20.0]])[0])
    assert p1 == pytest.approx(p2, rel=1e-9)


# ── Block 4: PV training data ────────────────────────────────────────────────

def test_pv_feature_names_count():
    assert len(PV_FEATURE_NAMES) == 6


def test_pv_feature_names_values():
    assert PV_FEATURE_NAMES == [
        "month", "latitude", "irradiance_kwh_m2_day",
        "avg_temp_c", "household_size", "current_consumption_kwh",
    ]


def test_pv_synthetic_data_shape():
    X, y, lat = _generate_pv_training_data(2000)
    assert X.shape == (2000, 6)
    assert y.shape == (2000,)
    assert lat.shape == (2000,)


def test_pv_synthetic_data_seed_deterministic():
    """Same seed → same first sample."""
    X1, y1, _ = _generate_pv_training_data(2000)
    X2, y2, _ = _generate_pv_training_data(2000)
    assert np.allclose(X1, X2) and np.allclose(y1, y2)


def test_pv_latitude_range():
    _, _, lat = _generate_pv_training_data(2000)
    assert lat.min() >= 28.0 and lat.max() <= 60.0


def test_pv_consumption_range():
    X, y, _ = _generate_pv_training_data(2000)
    consumption = X[:, 5]
    assert consumption.min() >= 500.0
    assert consumption.max() <= 50000.0


def test_pv_irradiance_positive():
    X, _, _ = _generate_pv_training_data(2000)
    irradiance = X[:, 2]
    assert irradiance.min() >= 1.0


def test_pv_optimal_wattage_range():
    _, y, _ = _generate_pv_training_data(2000)
    assert y.min() >= 100.0
    assert y.max() <= 20000.0


def test_pv_month_range():
    X, _, _ = _generate_pv_training_data(2000)
    months = X[:, 0]
    assert months.min() >= 1 and months.max() <= 12


# ── Block 4: PVOptimizationModel training ─────────────────────────────────────

@pytest.fixture(scope="module")
def pv_trained():
    m = PVOptimizationModel()
    m.train()
    return m


def test_pv_model_has_three_models(pv_trained):
    assert pv_trained.model_main  is not None
    assert pv_trained.model_lower is not None
    assert pv_trained.model_upper is not None


def test_pv_model_version_format(pv_trained):
    """model_version is YYYYMMDD (8 digits)."""
    assert len(pv_trained.model_version) == 8
    assert pv_trained.model_version.isdigit()


def test_pv_metrics_keys(pv_trained):
    for key in ["r2", "mae", "rmse", "training_samples", "seed", "geographic_scope"]:
        assert key in pv_trained.metrics, f"Missing metric: {key}"


def test_pv_metrics_r2_reasonable(pv_trained):
    """Synthetic data → R² should be > 0.9"""
    assert pv_trained.metrics["r2"] > 0.90


def test_pv_metrics_training_samples(pv_trained):
    assert pv_trained.metrics["training_samples"] == 2000


def test_pv_metrics_seed(pv_trained):
    assert pv_trained.metrics["seed"] == 42


def test_pv_regional_mae_keys(pv_trained):
    for key in ["mae_southern_eu", "mae_northern_eu", "mae_north_africa"]:
        assert key in pv_trained.metrics


def test_pv_regional_mae_positive(pv_trained):
    for key in ["mae_southern_eu", "mae_northern_eu", "mae_north_africa"]:
        val = pv_trained.metrics[key]
        if val is not None:
            assert val > 0


# ── Block 4: predict_pv ───────────────────────────────────────────────────────

def test_pv_predict_returns_three_values(pv_trained):
    main, lo, hi = pv_trained.predict_pv(
        month=6, latitude=40.0, irradiance=5.5,
        avg_temp=22.0, household_size=3, consumption_kwh=5000,
    )
    assert isinstance(main, float)
    assert isinstance(lo, float)
    assert isinstance(hi, float)


def test_pv_predict_lower_le_upper(pv_trained):
    """Lower quantile ≤ upper quantile."""
    _, lo, hi = pv_trained.predict_pv(6, 40.0, 5.5, 22.0, 3, 5000)
    assert lo <= hi


def test_pv_predict_main_in_range(pv_trained):
    """Main prediction within [100, 20000] W."""
    main, _, _ = pv_trained.predict_pv(6, 40.0, 5.5, 22.0, 3, 5000)
    assert 100 <= main <= 20000


def test_pv_predict_higher_consumption_higher_pv(pv_trained):
    """More consumption → model recommends more PV (directional test)."""
    main_low, _, _  = pv_trained.predict_pv(6, 40.0, 5.5, 22.0, 3, 3000)
    main_high, _, _ = pv_trained.predict_pv(6, 40.0, 5.5, 22.0, 3, 10000)
    assert main_high > main_low


def test_pv_predict_different_latitudes(pv_trained):
    """Prediction varies with latitude (model is not constant)."""
    m_south, _, _ = pv_trained.predict_pv(6, 35.0, 6.0, 25.0, 3, 5000)
    m_north, _, _ = pv_trained.predict_pv(6, 58.0, 3.0, 10.0, 3, 5000)
    assert m_south != m_north


# ── Block 4: explain_top3 ────────────────────────────────────────────────────

def test_pv_explain_returns_top3(pv_trained):
    features, explanation = pv_trained.explain_top3(6, 40.0, 5.5, 22.0, 3, 5000)
    assert len(features) == 3


def test_pv_explain_feature_keys(pv_trained):
    features, _ = pv_trained.explain_top3(6, 40.0, 5.5, 22.0, 3, 5000)
    for f in features:
        assert "feature" in f and "impact" in f and "direction" in f


def test_pv_explain_direction_values(pv_trained):
    features, _ = pv_trained.explain_top3(6, 40.0, 5.5, 22.0, 3, 5000)
    for f in features:
        assert f["direction"] in ("positive", "negative")


def test_pv_explain_explanation_is_string(pv_trained):
    _, explanation = pv_trained.explain_top3(6, 40.0, 5.5, 22.0, 3, 5000)
    assert isinstance(explanation, str) and len(explanation) > 10


# ── Block 4: model persistence ───────────────────────────────────────────────

def test_pv_model_persistence(tmp_path):
    import joblib
    m1 = PVOptimizationModel()
    m1.train()

    # Save manually to tmp_path
    path = str(tmp_path / "model_v20240101.pkl")
    payload = {
        "main": m1.model_main, "lower": m1.model_lower, "upper": m1.model_upper,
        "version": m1.model_version, "metrics": m1.metrics,
    }
    joblib.dump(payload, path)

    # Load into fresh instance (patch _latest_artifact)
    m2 = PVOptimizationModel()
    loaded = joblib.load(path)
    m2.model_main  = loaded["main"]
    m2.model_lower = loaded["lower"]
    m2.model_upper = loaded["upper"]
    m2.model_version = loaded["version"]

    p1 = m1.predict_pv(6, 40.0, 5.5, 22.0, 3, 5000)
    p2 = m2.predict_pv(6, 40.0, 5.5, 22.0, 3, 5000)
    assert p1[0] == pytest.approx(p2[0], rel=1e-9)
