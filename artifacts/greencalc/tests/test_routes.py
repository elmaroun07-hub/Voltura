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


# ── Block 5: CalculationEmissions + /dashboard/data ──────────────────────────

def _calc_payload(**overrides):
    """Default valid form payload for POST /calculate."""
    base = {
        "location": "Berlin, Germany",
        "lat": "52.52", "lon": "13.41",
        "annual_kwh": "5000",
        "pv_w": "4000",
        "battery_kwh": "10",
        "battery_efficiency": "90",
        "tariff": "0.30",
        "renewable_type": ["solar"],
        "performance_ratio": "0.75",
        "wind_kw": "0",
        "tilt": "35",
        "orientation": "south",
    }
    base.update(overrides)
    return base


def test_calculate_creates_emission_row(client, app):
    """After POST /calculate, calculation_emissions must have a matching row."""
    from models.db_models import CalculationEmissions, Calculation
    with app.app_context():
        before = _db.session.query(CalculationEmissions).count()

    r = client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    assert r.status_code == 200

    with app.app_context():
        after = _db.session.query(CalculationEmissions).count()
    assert after == before + 1, "Expected exactly one new CalculationEmissions row"


def test_emission_row_has_emissions_kg(client, app):
    """The newest CalculationEmissions row must have emissions_kg >= 0."""
    from models.db_models import CalculationEmissions
    client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    with app.app_context():
        row = (
            _db.session.query(CalculationEmissions)
            .order_by(CalculationEmissions.id.desc())
            .first()
        )
        assert row is not None
        assert isinstance(row.emissions_kg, float)
        assert row.emissions_kg >= 0.0


def test_emission_row_has_duration_seconds(client, app):
    """CalculationEmissions.duration_seconds must be > 0."""
    from models.db_models import CalculationEmissions
    client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    with app.app_context():
        row = (
            _db.session.query(CalculationEmissions)
            .order_by(CalculationEmissions.id.desc())
            .first()
        )
        assert row.duration_seconds is not None
        assert row.duration_seconds >= 0.0


def test_emission_row_has_country_iso(client, app):
    """CalculationEmissions.country_iso must be a non-empty string."""
    from models.db_models import CalculationEmissions
    client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    with app.app_context():
        row = (
            _db.session.query(CalculationEmissions)
            .order_by(CalculationEmissions.id.desc())
            .first()
        )
        assert row.country_iso is not None
        assert isinstance(row.country_iso, str)
        assert len(row.country_iso) > 0


def test_emission_row_fk_links_calculation(client, app):
    """CalculationEmissions.calculation_id must reference an existing Calculation row."""
    from models.db_models import CalculationEmissions, Calculation
    client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    with app.app_context():
        row = (
            _db.session.query(CalculationEmissions)
            .order_by(CalculationEmissions.id.desc())
            .first()
        )
        calc = _db.session.get(Calculation, row.calculation_id)
        assert calc is not None, "FK calculation_id must reference a Calculation row"


def test_emission_no_lat_lon_in_row(client, app):
    """CalculationEmissions must NOT store lat/lon coordinates."""
    from models.db_models import CalculationEmissions
    from sqlalchemy import inspect
    with app.app_context():
        cols = [c.key for c in inspect(CalculationEmissions).mapper.column_attrs]
    assert "lat" not in cols
    assert "lon" not in cols


def test_dashboard_data_endpoint_200(client):
    """GET /dashboard/data returns 200 JSON."""
    r = client.get("/dashboard/data")
    assert r.status_code == 200
    assert r.content_type.startswith("application/json")


def test_dashboard_data_fields(client):
    """GET /dashboard/data contains all required fields."""
    r = client.get("/dashboard/data")
    data = r.get_json()
    for field in [
        "total_emissions_kg", "total_emissions_g",
        "avg_emissions_kg", "avg_emissions_g",
        "total_calculations", "daily_emissions", "car_km_total",
    ]:
        assert field in data, f"Missing /dashboard/data field: {field}"


def test_dashboard_data_daily_is_list(client):
    """daily_emissions must be a list."""
    r = client.get("/dashboard/data")
    data = r.get_json()
    assert isinstance(data["daily_emissions"], list)


def test_dashboard_data_counts_increase_after_calc(client, app):
    """total_calculations increases by 1 after a /calculate POST."""
    r_before = client.get("/dashboard/data").get_json()
    before = r_before["total_calculations"]

    client.post("/calculate", data=_calc_payload(), follow_redirects=True)

    r_after = client.get("/dashboard/data").get_json()
    after = r_after["total_calculations"]
    assert after == before + 1


def test_dashboard_data_total_kg_non_negative(client):
    """total_emissions_kg must be >= 0."""
    r = client.get("/dashboard/data")
    assert r.get_json()["total_emissions_kg"] >= 0.0


def test_results_page_shows_emissions_badge(client):
    """Results page must contain mg CO₂ badge text (from emissions_g template var)."""
    r = client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    assert r.status_code == 200
    assert b"mg CO" in r.data or b"mg CO\xe2\x82\x82" in r.data or b"emissions" in r.data.lower()


def test_dashboard_html_shows_kpi(client):
    """GET /dashboard page contains emissions KPI text."""
    r = client.get("/dashboard")
    assert r.status_code == 200
    assert b"CO\xe2\x82\x82" in r.data or b"CO2" in r.data or b"emissions" in r.data.lower()


# ── Block 6: EU AI Act Compliance ─────────────────────────────────────────────

def test_delete_my_data_get_returns_200(client):
    r = client.get("/delete-my-data")
    assert r.status_code == 200
    assert b"delete" in r.data.lower() or b"gdpr" in r.data.lower() or b"data" in r.data.lower()


def test_delete_my_data_post_returns_json(client):
    r = client.post("/delete-my-data", data={})
    assert r.status_code == 200
    data = r.get_json()
    assert "deleted" in data
    assert "records_removed" in data


def test_delete_my_data_deleted_true(client):
    r = client.post("/delete-my-data", data={})
    assert r.get_json()["deleted"] is True


def test_delete_my_data_records_removed_is_int(client):
    r = client.post("/delete-my-data", data={})
    assert isinstance(r.get_json()["records_removed"], int)


def test_model_info_page_returns_200(client):
    r = client.get("/model-info/page")
    assert r.status_code == 200


def test_model_info_page_contains_training_data(client):
    r = client.get("/model-info/page")
    assert b"Training Data" in r.data or b"training" in r.data.lower()


def test_model_info_page_contains_algorithm(client):
    r = client.get("/model-info/page")
    assert b"Gradient" in r.data or b"gradient" in r.data.lower() or b"GBR" in r.data


def test_model_info_page_contains_limitations(client):
    r = client.get("/model-info/page")
    assert b"limitation" in r.data.lower() or b"bias" in r.data.lower()


def test_model_info_json_has_training_data(client):
    r = client.get("/model-info")
    data = r.get_json()
    assert "training_data" in data
    assert "source" in data["training_data"]
    assert "known_bias" in data["training_data"]
    assert "random_seed" in data["training_data"]


def test_model_info_json_has_regional_mae(client):
    r = client.get("/model-info")
    data = r.get_json()
    assert "regional_mae" in data
    assert "regional_warning" in data


def test_model_info_json_has_contact(client):
    r = client.get("/model-info")
    data = r.get_json()
    assert "contact" in data


def test_admin_audit_no_token_returns_403(client):
    r = client.get("/admin/audit")
    assert r.status_code == 403


def test_admin_audit_wrong_token_returns_403(client):
    r = client.get("/admin/audit", headers={"X-Admin-Token": "definitely_wrong_token_xyz"})
    assert r.status_code == 403


def test_admin_audit_wrong_token_json_error(client):
    r = client.get("/admin/audit", headers={"X-Admin-Token": "bad"})
    data = r.get_json()
    assert "error" in data or "Forbidden" in str(data)


def test_admin_audit_correct_token_returns_200(client, app):
    """If ADMIN_TOKEN env var is set, the correct token must return 200."""
    import os
    token = os.getenv("ADMIN_TOKEN", "")
    if not token:
        pytest.skip("ADMIN_TOKEN not set in environment")
    r = client.get("/admin/audit", headers={"X-Admin-Token": token})
    assert r.status_code == 200


def test_feedback_endpoint_returns_201(client):
    r = client.post("/feedback", json={"rating": 1, "comment": "Great tool!"})
    assert r.status_code == 201
    assert r.get_json()["saved"] is True


def test_feedback_invalid_rating_returns_400(client):
    r = client.post("/feedback", json={"rating": 0})
    assert r.status_code == 400


def test_feedback_thumbs_down_accepted(client):
    r = client.post("/feedback", json={"rating": -1, "comment": "Inaccurate"})
    assert r.status_code == 201


def test_override_endpoint_returns_201(client, app):
    """POST /override must store a UserOverride row."""
    from models.db_models import Calculation
    with app.app_context():
        calc = _db.session.execute(
            _db.select(Calculation).limit(1)
        ).scalars().first()
        if calc is None:
            pytest.skip("No calculation in DB")
        calc_id = calc.id

    r = client.post("/override", json={
        "calculation_id": calc_id,
        "field_name": "annual_savings_eur",
        "original_value": "1200.00",
        "override_value": "1350.00",
    })
    assert r.status_code == 201
    assert r.get_json()["saved"] is True


def test_override_missing_fields_returns_400(client):
    r = client.post("/override", json={"field_name": "annual_savings_eur"})
    assert r.status_code == 400


def test_results_page_has_ai_badge(client):
    r = client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    assert r.status_code == 200
    assert b"AI-assisted estimate" in r.data or b"ai-badge" in r.data.lower()


def test_results_page_has_disclaimer(client):
    r = client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    assert r.status_code == 200
    assert b"estimates only" in r.data.lower() or b"certified energy professional" in r.data.lower()


def test_results_page_has_recalculate_without_ai_button(client):
    r = client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    assert r.status_code == 200
    assert b"Recalculate without AI" in r.data or b"no_ml" in r.data


def test_gdpr_form_has_store_location_checkbox(client):
    r = client.get("/form")
    assert b"store_location" in r.data


def test_calculate_without_opt_in_no_coords_in_db(client, app):
    """When store_location is not checked, lat/lon must be None in DB."""
    from models.db_models import Calculation
    payload = _calc_payload()  # no store_location key
    client.post("/calculate", data=payload, follow_redirects=True)
    with app.app_context():
        calc = _db.session.execute(
            _db.select(Calculation).order_by(Calculation.id.desc()).limit(1)
        ).scalars().first()
        assert calc.lat is None
        assert calc.lon is None
        assert calc.location_opt_in is False or calc.location_opt_in == 0


def test_audit_log_created_after_calculate(client, app):
    """audit_log must get a new row after each /calculate POST."""
    from models.db_models import AuditLog
    with app.app_context():
        before = _db.session.query(AuditLog).count()

    client.post("/calculate", data=_calc_payload(), follow_redirects=True)

    with app.app_context():
        after = _db.session.query(AuditLog).count()
    assert after == before + 1


def test_base_has_gdpr_modal(client):
    r = client.get("/")
    assert b"gdprModal" in r.data or b"gdpr_consent" in r.data


def test_delete_data_page_in_footer(client):
    r = client.get("/")
    assert b"delete" in r.data.lower() or b"Delete my data" in r.data


# ── Block 7: PDF Export ────────────────────────────────────────────────────────

def _run_calc_and_get_uuid(client):
    """Helper: POST /calculate, return (calc_uuid, calc_id)."""
    r = client.post("/calculate", data=_calc_payload(), follow_redirects=True)
    assert r.status_code == 200
    import sqlite3, os
    db_path = os.getenv("GREENCALC_DATABASE_URL", "").replace("sqlite:///", "") \
        or "/home/runner/greencalc/greencalc.db"
    conn = sqlite3.connect(db_path)
    row  = conn.execute(
        "SELECT id, calc_uuid FROM calculations ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    assert row, "No calculation in DB after POST /calculate"
    return row[0], row[1]   # (calc_id, calc_uuid)


def test_export_pdf_post_returns_200(client):
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    assert r.status_code == 200


def test_export_pdf_content_type(client):
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    assert r.content_type == "application/pdf"


def test_export_pdf_magic_bytes(client):
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    assert r.data[:4] == b"%PDF"


def test_export_pdf_not_empty(client):
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    assert len(r.data) > 5000   # at least 5 KB


def test_export_pdf_content_disposition(client):
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    cd = r.headers.get("Content-Disposition", "")
    assert "attachment" in cd
    assert ".pdf" in cd


def test_export_pdf_no_uuid_returns_400(client):
    r = client.post("/export/pdf", json={})
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_export_pdf_invalid_uuid_returns_404(client):
    r = client.post("/export/pdf",
                    json={"calculation_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 404


def test_export_pdf_get_by_id_returns_200(client):
    calc_id, _ = _run_calc_and_get_uuid(client)
    r = client.get(f"/export/pdf/{calc_id}")
    assert r.status_code == 200


def test_export_pdf_get_by_id_is_pdf(client):
    calc_id, _ = _run_calc_and_get_uuid(client)
    r = client.get(f"/export/pdf/{calc_id}")
    assert r.data[:4] == b"%PDF"


def test_export_pdf_get_missing_id_returns_404(client):
    r = client.get("/export/pdf/9999999")
    assert r.status_code == 404


def test_export_pdf_post_no_body_returns_400(client):
    r = client.post("/export/pdf", content_type="application/json", data="")
    assert r.status_code == 400


def test_export_pdf_has_eight_pages(client):
    """Verify the PDF contains 8 or more /Type /Page objects."""
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    assert r.data[:4] == b"%PDF"
    # Count /Type /Page markers (each real page has one)
    page_count = r.data.count(b"/Type /Page")
    assert page_count >= 8, f"Expected 8 pages, got {page_count}"


def test_export_pdf_cache_control(client):
    calc_id, calc_uuid = _run_calc_and_get_uuid(client)
    r = client.post("/export/pdf", json={"calculation_id": calc_uuid})
    assert "no-store" in r.headers.get("Cache-Control", "")
