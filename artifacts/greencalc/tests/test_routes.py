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


# ── Validation: HTTP 400 + JSON error response ────────────────────────────────

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
    """Results page must contain data for all 12 calendar months."""
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
    r = _post_calc(client, {"pv_w": "4000", "roof_area": "10"})  # max=10*180=1800 W
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
    """Wind selected but no wind_kw provided → 400."""
    r = _post_calc(client, {"renewable_type": "wind", "wind_kw": ""})
    assert r.status_code == 400
