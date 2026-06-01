import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app import create_app
from extensions import db as _db


@pytest.fixture(scope="module")
def app():
    application = create_app()
    application.config["TESTING"] = True
    application.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    application.config["WTF_CSRF_ENABLED"] = False
    with application.app_context():
        _db.create_all()
    return application


@pytest.fixture(scope="module")
def client(app):
    return app.test_client()


# ── Page availability ────────────────────────────────────────────────────────

def test_index_returns_200(client):
    r = client.get("/")
    assert r.status_code == 200
    assert b"GreenCalc" in r.data or b"Solar" in r.data


def test_form_get_returns_200(client):
    r = client.get("/form")
    assert r.status_code == 200
    assert b"form" in r.data.lower() or b"calculator" in r.data.lower()


def test_form_contains_leaflet(client):
    r = client.get("/form")
    assert b"leaflet" in r.data.lower()


def test_form_contains_renewable_checkboxes(client):
    r = client.get("/form")
    assert b"renewable_type" in r.data


def test_form_contains_wind_field(client):
    r = client.get("/form")
    assert b"wind_kw" in r.data


def test_form_contains_performance_ratio(client):
    r = client.get("/form")
    assert b"performance_ratio" in r.data


def test_form_contains_roof_area(client):
    r = client.get("/form")
    assert b"roof_area" in r.data


def test_dashboard_returns_200(client):
    r = client.get("/dashboard")
    assert r.status_code == 200


def test_compliance_returns_200(client):
    r = client.get("/compliance")
    assert r.status_code == 200


def test_predict_get_returns_200(client):
    r = client.get("/predict")
    assert r.status_code == 200


def test_shap_values_returns_json(client):
    r = client.get("/shap-values")
    assert r.status_code == 200
    data = r.get_json()
    assert data is not None


def test_model_info_returns_json(client):
    r = client.get("/model-info")
    assert r.status_code == 200
    data = r.get_json()
    assert data is not None
    assert "model_version" in data


# ── /calculate form validation ────────────────────────────────────────────────

def _post_calc(client, overrides=None):
    defaults = {
        "location": "Berlin, Germany",
        "lat": "52.52", "lon": "13.405",
        "annual_kwh": "5000",
        "renewable_type": "solar",
        "pv_w": "4000",
        "battery_kwh": "10",
        "battery_efficiency": "90",
        "tilt": "35",
        "orientation": "south",
        "performance_ratio": "0.75",
        "tariff": "0.30",
    }
    if overrides:
        defaults.update(overrides)
    return client.post("/calculate", data=defaults)


def test_calculate_valid_solar_post(client):
    r = _post_calc(client)
    assert r.status_code in (200, 302)
    if r.status_code == 200:
        assert b"kWh" in r.data or b"Saved" in r.data


def test_calculate_valid_solar_contains_12_months(client):
    r = _post_calc(client)
    if r.status_code == 200:
        for month in [b"Jan", b"Feb", b"Mar", b"Apr", b"May", b"Jun",
                      b"Jul", b"Aug", b"Sep", b"Oct", b"Nov", b"Dec"]:
            assert month in r.data, f"Month {month} missing from results"


def test_calculate_validation_pv_too_low(client):
    r = _post_calc(client, {"pv_w": "50"})
    assert r.status_code == 400
    data = r.get_json()
    assert data is not None and "error" in data and "field" in data


def test_calculate_validation_pv_too_high(client):
    r = _post_calc(client, {"pv_w": "25000"})
    assert r.status_code == 400
    data = r.get_json()
    assert data is not None and "error" in data


def test_calculate_validation_pv_exceeds_roof(client):
    r = _post_calc(client, {"pv_w": "4000", "roof_area": "10"})
    assert r.status_code == 400
    data = r.get_json()
    assert data is not None and "pv_w" == data.get("field")


def test_calculate_validation_bad_lat(client):
    r = _post_calc(client, {"lat": "999", "lon": "0"})
    assert r.status_code == 400
    data = r.get_json()
    assert data is not None and "field" in data


def test_calculate_validation_no_renewable_type(client):
    defaults = {
        "location": "Madrid", "lat": "40.4", "lon": "-3.7",
        "annual_kwh": "5000", "pv_w": "4000",
        "battery_kwh": "10", "battery_efficiency": "90",
        "tilt": "35", "orientation": "south", "performance_ratio": "0.75",
    }
    r = client.post("/calculate", data=defaults)
    assert r.status_code == 400


def test_calculate_validation_battery_too_large(client):
    r = _post_calc(client, {"battery_kwh": "200"})
    assert r.status_code == 400


def test_calculate_validation_bad_performance_ratio(client):
    r = _post_calc(client, {"performance_ratio": "0.95"})
    assert r.status_code == 400


def test_calculate_validation_bad_efficiency(client):
    r = _post_calc(client, {"battery_efficiency": "30"})
    assert r.status_code == 400


def test_calculate_validation_annual_kwh_too_low(client):
    r = _post_calc(client, {"annual_kwh": "100"})
    assert r.status_code == 400


def test_calculate_validation_tariff_too_high(client):
    r = _post_calc(client, {"tariff": "5.00"})
    assert r.status_code == 400


def test_calculate_wind_only_missing_wind_kw(client):
    r = _post_calc(client, {"renewable_type": "wind", "wind_kw": ""})
    assert r.status_code == 400


# ── Block 4: POST /predict JSON API ──────────────────────────────────────────

def _predict_payload(**kw):
    defaults = {
        "lat": 40.4, "lon": -3.7,
        "annual_kwh": 5000, "pv_w": 4000,
        "battery_kwh": 10, "battery_efficiency": 90,
        "tariff": 0.30, "renewable_type": ["solar"],
        "performance_ratio": 0.75, "wind_kw": 0,
        "household_size": 3, "month": 6,
    }
    defaults.update(kw)
    return defaults


def test_predict_post_returns_200(client):
    r = client.post("/predict", json=_predict_payload())
    assert r.status_code == 200


def test_predict_post_returns_json(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    assert data is not None


def test_predict_returns_main_lower_upper(client):
    """All three model outputs present: recommended + confidence_interval [lo, hi]."""
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    assert "recommended_pv_wattage" in data
    ci = data["confidence_interval"]
    assert isinstance(ci, list) and len(ci) == 2
    assert ci[0] <= ci[1], "lower bound must be ≤ upper bound"


def test_predict_spec_fields_present(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    for field in [
        "recommended_pv_wattage", "predicted_annual_savings_kwh",
        "predicted_cost_savings_eur", "confidence_interval",
        "top_features", "explanation", "model_version",
        "fallback_used", "boundary_violation",
    ]:
        assert field in data, f"Missing spec field: {field}"


def test_predict_pv_wattage_is_int(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    assert isinstance(data["recommended_pv_wattage"], int)


def test_predict_savings_positive(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    assert data["predicted_annual_savings_kwh"] >= 0
    assert data["predicted_cost_savings_eur"] >= 0


def test_predict_top_features_length(client):
    """top_features has 3 entries when ML model is used."""
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    if not data["fallback_used"]:
        assert len(data["top_features"]) == 3


def test_predict_top_features_schema(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    if not data["fallback_used"]:
        for f in data["top_features"]:
            assert "feature" in f and "impact" in f and "direction" in f


def test_predict_explanation_is_string(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    assert isinstance(data["explanation"], str) and len(data["explanation"]) > 5


def test_predict_fallback_on_boundary_violation(client):
    """pv_w=25000 exceeds ML training bound (max 20000) → boundary_violation=True → fallback."""
    r = client.post("/predict", json=_predict_payload(pv_w=25000))
    assert r.status_code == 200
    data = r.get_json()
    assert data["fallback_used"] is True or data["boundary_violation"] is True


def test_predict_model_version_string(client):
    r = client.post("/predict", json=_predict_payload())
    data = r.get_json()
    assert isinstance(data["model_version"], str)


def test_predict_higher_consumption_more_pv(client):
    """Directional test: more consumption → more recommended PV."""
    r_low  = client.post("/predict", json=_predict_payload(annual_kwh=3000))
    r_high = client.post("/predict", json=_predict_payload(annual_kwh=10000))
    pv_low  = r_low.get_json()["recommended_pv_wattage"]
    pv_high = r_high.get_json()["recommended_pv_wattage"]
    assert pv_high >= pv_low


# ── GET /model-info ───────────────────────────────────────────────────────────

def test_model_info_fields(client):
    r = client.get("/model-info")
    data = r.get_json()
    for field in ["model_version", "seed", "geographic_scope",
                  "training_samples", "features", "metrics"]:
        assert field in data, f"Missing /model-info field: {field}"


def test_model_info_seed_is_42(client):
    r = client.get("/model-info")
    assert r.get_json()["seed"] == 42


def test_model_info_features_list(client):
    r = client.get("/model-info")
    assert r.get_json()["features"] == [
        "month", "latitude", "irradiance_kwh_m2_day",
        "avg_temp_c", "household_size", "current_consumption_kwh",
    ]
