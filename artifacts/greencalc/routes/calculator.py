import json
import time
import uuid as uuid_mod
from flask import Blueprint, render_template, request, session, jsonify
from models.energy_model import (
    geocode, fetch_nasa_power, panel_efficiency_factor,
    calculate_energy, detect_carbon_intensity,
    country_from_latlon, TARIFF_BY_COUNTRY,
    validate_inputs, make_input_hash,
)
from models.ml_model import ml_model, pv_model
from models.carbon_tracker import track_calculation
from models.audit_utils import log_audit

calculator_bp = Blueprint("calculator", __name__)


def _parse_float(val, default):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _parse_int(val, default):
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _session_id() -> str:
    if "_sid" not in session:
        session["_sid"] = str(uuid_mod.uuid4())
    return session["_sid"]


@calculator_bp.route("/")
def index():
    return render_template("index.html")


@calculator_bp.route("/form")
def form():
    return render_template("form.html")


@calculator_bp.route("/calculate", methods=["POST"])
def calculate():
    from extensions import db
    from models.db_models import Calculation, CalculationEmissions

    # ── Block 6: no-ML override flag (Recalculate without AI) ───────────────
    noml = (
        request.args.get("no_ml") == "1"
        or request.form.get("no_ml") == "1"
    )

    # ── Parse inputs ─────────────────────────────────────────────────────────
    location = request.form.get("location", "").strip() or "Berlin, Germany"
    renewable_type = request.form.getlist("renewable_type")
    renewable_type_str = ",".join(sorted(set(renewable_type)))

    lat_raw = request.form.get("lat", "").strip()
    lon_raw = request.form.get("lon", "").strip()
    lat = _parse_float(lat_raw, None) if lat_raw else None
    lon = _parse_float(lon_raw, None) if lon_raw else None

    annual_kwh    = _parse_float(request.form.get("annual_kwh"), 5000.0)
    pv_w          = _parse_float(request.form.get("pv_w"), 4000.0)
    wind_kw_raw   = request.form.get("wind_kw", "").strip()
    wind_kw       = _parse_float(wind_kw_raw, 0.0) if wind_kw_raw else None
    battery_kwh   = _parse_float(request.form.get("battery_kwh"), 10.0)
    battery_eff   = _parse_float(request.form.get("battery_efficiency"), 90.0)
    tilt          = _parse_float(request.form.get("tilt"), 35.0)
    orientation   = request.form.get("orientation", "south")
    perf_ratio    = _parse_float(request.form.get("performance_ratio"), 0.75)
    roof_area_raw = request.form.get("roof_area", "").strip()
    roof_area     = _parse_float(roof_area_raw, None) if roof_area_raw else None
    num_occupants = _parse_int(request.form.get("num_occupants"), None)
    tariff_raw    = request.form.get("tariff", "").strip()
    tariff_input  = _parse_float(tariff_raw, None) if tariff_raw else None
    install_raw   = request.form.get("installation_cost", "").strip()

    # Block 6 GDPR: lat/lon only written to DB with explicit opt-in
    store_location = request.form.get("store_location") == "on"

    if lat is None or lon is None:
        lat, lon = geocode(location)

    country_iso = country_from_latlon(lat, lon)
    tariff = tariff_input if tariff_input is not None else TARIFF_BY_COUNTRY.get(
        country_iso, TARIFF_BY_COUNTRY["DEFAULT"]
    )

    # ── Validate ──────────────────────────────────────────────────────────────
    validation_data = {
        "lat": lat, "lon": lon,
        "annual_kwh": annual_kwh, "tariff": tariff,
        "renewable_type": renewable_type,
        "pv_w": pv_w, "wind_kw": wind_kw,
        "battery_kwh": battery_kwh, "battery_efficiency": battery_eff,
        "performance_ratio": perf_ratio, "tilt": tilt,
        "roof_area": roof_area,
    }
    errors, boundary_violation = validate_inputs(validation_data)
    if errors:
        return jsonify(errors[0]), 400

    effective_wind_kw = wind_kw if wind_kw is not None else 0.0

    # ── NASA POWER (session-cached) ───────────────────────────────────────────
    nasa_key = f"nasa_{lat:.3f}_{lon:.3f}"
    cached = session.get(nasa_key)
    if cached:
        nasa = cached
    else:
        nasa = fetch_nasa_power(lat, lon)
        session[nasa_key] = nasa
        session.modified = True

    irr_monthly  = nasa["irradiance"]
    temp_monthly = nasa["temperature"]
    nasa_source  = nasa.get("source", "nasa")

    hash_data = {
        "lat": round(lat, 3), "lon": round(lon, 3),
        "pv_w": pv_w, "wind_kw": effective_wind_kw,
        "battery_kwh": battery_kwh, "annual_kwh": annual_kwh,
        "performance_ratio": perf_ratio, "tariff": tariff,
        "battery_efficiency": battery_eff,
    }
    input_hash = make_input_hash(hash_data)
    sid = _session_id()

    carbon_intensity_g = detect_carbon_intensity(lat, lon)
    panel_efficiency_factor(tilt, orientation)

    # ── Block 5: Track ONLY the calculation engine call ───────────────────────
    t_start = time.time()
    result, emissions_kg = track_calculation(
        calculate_energy,
        irr_monthly=irr_monthly,
        pv_w=pv_w,
        battery_kwh=battery_kwh,
        battery_efficiency=battery_eff,
        performance_ratio=perf_ratio,
        annual_kwh=annual_kwh,
        tariff=tariff,
        lat=lat,
        wind_kw=effective_wind_kw,
        carbon_intensity_g_per_kwh=carbon_intensity_g,
    )
    duration_s = time.time() - t_start
    computation_co2_mg = round(emissions_kg * 1e6, 4)

    roi_curve    = result["roi_curve"]
    monthly_data = result["monthly_data"]

    install_cost_display = (
        float(install_raw) if install_raw else result["installation_cost_eur"]
    )

    # ── Legacy ML prediction + SHAP ───────────────────────────────────────────
    mid_month, mid_hour = 6, 12
    mid_irr  = irr_monthly[mid_month - 1]
    mid_temp = temp_monthly[mid_month - 1]
    if not noml:
        ml_pred   = ml_model.predict(mid_month, mid_hour, mid_irr, mid_temp)
        shap_vals = ml_model.explain(mid_month, mid_hour, mid_irr, mid_temp)
    else:
        ml_pred   = 0.0
        shap_vals = {}

    # ── Block 6: PV optimization CI (Article 50 transparency) ────────────────
    pv_recommended = pv_ci_lower = pv_ci_upper = None
    pv_explanation = ""
    pv_top_features = []
    pv_model_version = "n/a"
    regional_warning = False

    if not noml:
        try:
            pv_model.ensure_ready()
            avg_irr   = sum(irr_monthly) / 12
            avg_temp_c = max(-10.0, 25.0 - (lat - 28) * 0.5)
            (main_w, lower_w, upper_w), _em = track_calculation(
                pv_model.predict_pv,
                month=mid_month, latitude=lat, irradiance=avg_irr,
                avg_temp=avg_temp_c, household_size=(num_occupants or 3),
                consumption_kwh=annual_kwh,
            )
            pv_recommended = int(round(main_w))
            pv_ci_lower    = round(lower_w)
            pv_ci_upper    = round(upper_w)
            pv_top_features, pv_explanation = pv_model.explain_top3(
                month=mid_month, latitude=lat, irradiance=avg_irr,
                avg_temp=avg_temp_c, household_size=(num_occupants or 3),
                consumption_kwh=annual_kwh, tariff=tariff,
            )
            pv_model_version = pv_model.model_version

            # Regional MAE warning: flag if spread > 15%
            m = pv_model.metrics
            maes = [
                v for k, v in m.items()
                if k.startswith("mae_") and v and v > 0
            ]
            if len(maes) >= 2:
                regional_warning = (max(maes) - min(maes)) / min(maes) > 0.15

        except Exception:
            pv_explanation = "AI recommendation unavailable — physics estimate used."

    # ── Persist Calculation ───────────────────────────────────────────────────
    calc = Calculation(
        calc_uuid=str(uuid_mod.uuid4()),
        session_id=sid,
        input_hash=input_hash,
        location=location,
        # GDPR: only store coordinates if user opted in
        lat=lat if store_location else None,
        lon=lon if store_location else None,
        location_opt_in=store_location,
        country_iso=country_iso,
        annual_kwh=annual_kwh,
        renewable_type=renewable_type_str,
        pv_w=pv_w,
        wind_kw=effective_wind_kw,
        battery_kwh=battery_kwh,
        tariff=tariff,
        efficiency=battery_eff,
        tilt=tilt,
        orientation=orientation,
        performance_ratio=perf_ratio,
        roof_area=roof_area,
        num_occupants=num_occupants,
        installation_cost=install_cost_display,
        solar_kwh=result["solar_kwh"],
        wind_kwh=result["wind_kwh"],
        energy_covered=result["energy_covered"],
        cost_savings_eur=result["cost_savings_eur"],
        co2_reduced_tonnes=result["co2_reduced_tonnes"],
        payback_year=result["payback_year"],
        npv_savings=result["npv_savings"],
        installation_cost_eur=result["installation_cost_eur"],
        cumulative_savings_json=json.dumps(result["cumulative_savings"]),
        annual_saved_kwh=result["total_saved_kwh"],
        annual_savings_eur=result["annual_savings_eur"],
        co2_kg=result["co2_kg"],
        payback_years=result["payback_years"],
        net_25yr=result["net_25yr"],
        solar_pct=result["solar_pct"],
        wind_pct=result["wind_pct"],
        battery_pct=result["battery_pct"],
        grid_pct=result["grid_pct"],
        computation_co2_mg=computation_co2_mg,
        boundary_violation=boundary_violation,
        nasa_source=nasa_source,
    )
    db.session.add(calc)
    db.session.flush()

    # Block 5: Persist CalculationEmissions
    energy_kwh = duration_s * 10.0 / 3_600_000.0
    emission_row = CalculationEmissions(
        calculation_id=calc.id,
        emissions_kg=emissions_kg,
        duration_seconds=round(duration_s, 3),
        energy_consumed_kwh=round(energy_kwh, 9),
        country_iso=country_iso,
    )
    db.session.add(emission_row)
    db.session.commit()

    # Block 6 Article 73: Audit log
    log_audit(
        session_id=sid,
        endpoint="/calculate",
        input_hash=input_hash,
        output_summary={
            "calc_id": calc.id,
            "annual_savings_eur": result["annual_savings_eur"],
            "pv_w": pv_w,
            "payback_year": result["payback_year"],
            "noml": noml,
        },
        model_version=pv_model_version,
        fallback_used=noml,
        boundary_violation=boundary_violation,
        emissions_kg=emissions_kg,
    )

    emissions_g = round(emissions_kg * 1000, 6)
    car_km      = round(emissions_kg / 0.00021, 4)

    return render_template(
        "results.html",
        calc=calc,
        monthly_data=monthly_data,
        roi_curve=roi_curve,
        shap_vals=shap_vals,
        ml_pred=round(ml_pred, 3),
        irr_monthly=irr_monthly,
        nasa_source=nasa_source,
        country_iso=country_iso,
        boundary_violation=boundary_violation,
        npv_savings=result["npv_savings"],
        payback_year=result["payback_year"],
        self_consumption_rate=result["self_consumption_rate"],
        grid_export_kwh=result["grid_export_kwh"],
        monthly_data_json=json.dumps(monthly_data),
        roi_curve_json=json.dumps(roi_curve),
        shap_vals_json=json.dumps(shap_vals),
        calculation_id=calc.id,
        emissions_g=emissions_g,
        car_km=car_km,
        emissions_kg=emissions_kg,
        # Block 6 transparency
        noml=noml,
        pv_recommended=pv_recommended,
        pv_ci_lower=pv_ci_lower,
        pv_ci_upper=pv_ci_upper,
        pv_explanation=pv_explanation,
        pv_top_features=pv_top_features,
        pv_model_version=pv_model_version,
        regional_warning=regional_warning,
    )
