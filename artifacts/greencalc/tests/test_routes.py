import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app import create_app
from extensions import db


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        yield app.test_client()


def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"GreenCalc" in resp.data or b"Solar" in resp.data


def test_form_get_returns_200(client):
    resp = client.get("/form")
    assert resp.status_code == 200
    assert b"form" in resp.data.lower() or b"calculator" in resp.data.lower()


def test_dashboard_returns_200(client):
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert b"Dashboard" in resp.data or b"dashboard" in resp.data


def test_compliance_returns_200(client):
    resp = client.get("/compliance")
    assert resp.status_code == 200
    assert b"AI" in resp.data or b"compliance" in resp.data.lower()


def test_predict_get_returns_200(client):
    resp = client.get("/predict")
    assert resp.status_code == 200


def test_calculate_post_returns_200_or_redirect(client):
    form_data = {
        "location": "Berlin, Germany",
        "annual_kwh": "5000",
        "pv_w": "4000",
        "battery_kwh": "10",
        "tariff": "0.30",
        "efficiency": "90",
        "tilt": "35",
        "orientation": "south",
        "installation_cost": "8000",
    }
    resp = client.post("/calculate", data=form_data)
    assert resp.status_code in (200, 302), f"Expected 200 or 302, got {resp.status_code}"
    if resp.status_code == 200:
        assert b"kWh" in resp.data or b"Saved" in resp.data or b"results" in resp.data.lower()
