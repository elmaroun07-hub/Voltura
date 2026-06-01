import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest
from models.ml_model import GreenMLModel, FEATURE_NAMES, _generate_synthetic_data


@pytest.fixture(scope="module")
def trained_model():
    m = GreenMLModel()
    m.ensure_ready()
    return m


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
    months = X[:, 0]
    hours = X[:, 1]
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
    """Prediction should be a physically plausible consumption value."""
    result = trained_model.predict(6, 12, 5.0, 20.0)
    assert 0.0 < result < 5.0


def test_predict_different_inputs(trained_model):
    """Predictions vary with input — model is not constant."""
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
        assert isinstance(v, float), f"{k} SHAP value is not a float"


def test_model_persistence(tmp_path):
    """Train, save to tmp path, load back — predictions should match."""
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
