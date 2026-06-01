import json
import time
from flask import Blueprint, render_template, request, session, jsonify, current_app
from models.energy_model import (
    geocode, fetch_nasa_power, panel_efficiency_factor, simulate_8760,
    compute_roi_curve, compute_payback_years, detect_carbon_intensity,
    estimate_installation_cost, country_from_latlon, TARIFF_BY_COUNTRY,
    validate_inputs,
)
from models.ml_model import ml_model

calculator_bp = Blueprint("calculator", __name__)


def _parse_float(val, default: float) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _parse_int(val, default: int) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


@calculator_bp.route("/")
def index():
    return render_template("index.html")


@calculator_bp.route("/form")
def form():
    return render_template("form.html")


@calculator_bp.route("/calculate", methods=["POST"])
def calculate():
    from extensions import db
    from models.db_models import Calculation

    # ── Parse inputs ────────────────────────────────────────────────────────
    location = request.form.get("location", "").strip() or "Berlin, Germany"
    renewable_type = request.form.getlist("renewable_type")  # empty = validation error
    renewable_type_str = ",".join(sorted(set(renewable_type)))

    # Coordinates — prefer explicit lat/lon from map picker
    lat_raw = request.form.get("lat", "").strip()
    lon_raw = request.form.get("lon", "").strip()
    if lat_raw and lon_raw:
        lat = _parse_float(lat_raw, None)
        lon = _parse_float(lon_raw, None)
    else:
        lat, lon = None, None

    annual_kwh = _parse_float(request.form.get("annual_kwh"), 5000.0)
    pv_w = _parse_float(request.form.get("pv_w"), 4000.0)
    wind_kw_raw = request.form.get("wind_kw", "").strip()
    wind_kw = _parse_float(wind_kw_raw, 0.0) if wind_kw_raw else None
    battery_kwh = _parse_float(request.form.get("battery_kwh"), 10.0)
    battery_efficiency = _parse_float(request.form.get("battery_efficiency"), 90.0)
    tilt = _parse_float(request.form.get("tilt"), 35.0)
    orientation = request.form.get("orientation", "south")
    performance_ratio = _parse_float(request.form.get("performance_ratio"), 0.75)
    roof_area_raw = request.form.get("roof_area", "").strip()
    roof_area = _parse_float(roof_area_raw, None) if roof_area_raw else None
    num_occupants = _parse_int(request.form.get("num_occupants"), None)
    tariff_raw = request.form.get("tariff", "").strip()
    tariff_input = _parse_float(tariff_raw, None) if tariff_raw else None
    installation_cost_input = request.form.get("installation_cost", "").strip()

    # ── Geocode if no explicit coordinates ─────────────────────────────────
    if lat is None or lon is None:
        lat, lon = geocode(location)

    # ── Country + tariff fallback ───────────────────────────────────────────
    country_iso = country_from_latlon(lat, lon)
    if tariff_input is not None:
        tariff = tariff_input
    else:
        tariff = TARIFF_BY_COUNTRY.get(country_iso, TARIFF_BY_COUNTRY["DEFAULT"])

    # ── Validate ────────────────────────────────────────────────────────────
    validation_data = {
        "lat": lat,
        "lon": lon,
        "annual_kwh": annual_kwh,
        "tariff": tariff,
        "renewable_type": renewable_type,
        "pv_w": pv_w,
        "wind_kw": wind_kw,
        "battery_kwh": battery_kwh,
        "battery_efficiency": battery_efficiency,
        "performance_ratio": performance_ratio,
        "tilt": tilt,
        "roof_area": roof_area,
    }
    errors, boundary_violation = validate_inputs(validation_data)
    if errors:
        return jsonify(errors[0]), 400

    effective_wind_kw = wind_kw if wind_kw is not None else 0.0

    # ── NASA POWER data (cached in session by lat/lon key) ──────────────────
    nasa_cache_key = f"nasa_{lat:.3f}_{lon:.3f}"
    cached = session.get(nasa_cache_key)
    if cached:
        nasa = cached
        current_app.logger.info("NASA data served from session cache for %.3f, %.3f", lat, lon)
    else:
        nasa = fetch_nasa_power(lat, lon)
        session[nasa_cache_key] = nasa
        session.modified = True

    irr_monthly = nasa["irradiance"]
    temp_monthly = nasa["temperature"]
    nasa_source = nasa.get("source", "nasa")

    # ── Simulation ──────────────────────────────────────────────────────────
    panel_factor = panel_efficiency_factor(tilt, orientation)

    t0 = time.time()
    sim = simulate_8760(
        annual_kwh, pv_w, battery_kwh, battery_efficiency,
        panel_factor, irr_monthly, temp_monthly,
        performance_ratio=performance_ratio,
        wind_kw=effective_wind_kw,
    )
    compute_time_s = time.time() - t0

    # ── Financial + carbon ──────────────────────────────────────────────────
    annual_savings_eur = round(sim["total_saved_kwh"] * tariff, 2)
    carbon_intensity = detect_carbon_intensity(lat, lon)
    co2_kg = round(sim["total_saved_kwh"] * carbon_intensity / 1000, 1)

    installation_cost = (
        float(installation_cost_input)
        if installation_cost_input
        else estimate_installation_cost(pv_w, battery_kwh, effective_wind_kw)
    )
    payback = compute_payback_years(annual_savings_eur, installation_cost)
    roi_curve = compute_roi_curve(annual_savings_eur, installation_cost)

    # ── ML prediction + SHAP ────────────────────────────────────────────────
    mid_month, mid_hour = 6, 12
    mid_irr = irr_monthly[mid_month - 1]
    mid_temp = temp_monthly[mid_month - 1]
    ml_pred = ml_model.predict(mid_month, mid_hour, mid_irr, mid_temp)
    shap_vals = ml_model.explain(mid_month, mid_hour, mid_irr, mid_temp)

    # ── CodeCarbon tracking ─────────────────────────────────────────────────
    try:
        from codecarbon import EmissionsTracker
        tracker = EmissionsTracker(log_level="error", save_to_file=False)
        tracker.start()
        time.sleep(0.01)
        emissions = tracker.stop()
        computation_co2_mg = round((emissions or 0) * 1e9, 4)
    except Exception:
        computation_co2_mg = round(compute_time_s * 0.4, 4)

    net_25yr = roi_curve[-1]["net_position"] if roi_curve else 0

    # ── Persist ─────────────────────────────────────────────────────────────
    calc = Calculation(
        location=location,
        lat=lat,
        lon=lon,
        country_iso=country_iso,
        annual_kwh=annual_kwh,
        renewable_type=renewable_type_str,
        pv_w=pv_w,
        wind_kw=effective_wind_kw,
        battery_kwh=battery_kwh,
        tariff=tariff,
        efficiency=battery_efficiency,
        tilt=tilt,
        orientation=orientation,
        performance_ratio=performance_ratio,
        roof_area=roof_area,
        num_occupants=num_occupants,
        installation_cost=installation_cost,
        annual_saved_kwh=sim["total_saved_kwh"],
        annual_savings_eur=annual_savings_eur,
        co2_kg=co2_kg,
        payback_years=payback,
        net_25yr=net_25yr,
        solar_pct=sim["solar_pct"],
        wind_pct=sim.get("wind_pct", 0.0),
        battery_pct=sim["battery_pct"],
        grid_pct=sim["grid_pct"],
        computation_co2_mg=computation_co2_mg,
        boundary_violation=boundary_violation,
        nasa_source=nasa_source,
    )
    db.session.add(calc)
    db.session.commit()

    return render_template(
        "results.html",
        calc=calc,
        monthly_data=sim["monthly_data"],
        roi_curve=roi_curve,
        shap_vals=shap_vals,
        ml_pred=round(ml_pred, 3),
        irr_monthly=irr_monthly,
        nasa_source=nasa_source,
        country_iso=country_iso,
        boundary_violation=boundary_violation,
        monthly_data_json=json.dumps(sim["monthly_data"]),
        roi_curve_json=json.dumps(roi_curve),
        shap_vals_json=json.dumps(shap_vals),
    )
