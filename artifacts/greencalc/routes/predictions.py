"""
Block 4: ML Optimization predictions endpoint + legacy predict page.
"""
import logging
from flask import Blueprint, render_template, request, jsonify
from models.ml_model import ml_model, pv_model, PV_FEATURE_NAMES
from models.energy_model import (
    calculate_energy, fallback_irradiance,
    country_from_latlon, TARIFF_BY_COUNTRY,
    validate_inputs,
)

logger = logging.getLogger(__name__)

predictions_bp = Blueprint("predictions", __name__)

# ── Legacy HTML predict page (Block 1 compat) ────────────────────────────────

@predictions_bp.route("/predict", methods=["GET"])
def predict():
    return render_template("predict.html", result=None, shap_vals=None)


# ── POST /predict — Block 4 JSON API ─────────────────────────────────────────

@predictions_bp.route("/predict", methods=["POST"])
def predict_api():
    """
    Input JSON (all Block 2 user inputs):
      lat, lon, annual_kwh, pv_w, battery_kwh, battery_efficiency,
      tariff, performance_ratio, renewable_type, wind_kw,
      household_size (optional, default 3),
      month (optional, default 6),
      calculation_id (optional UUID from Block 3)

    Output JSON (Block 4 spec):
      calculation_id, recommended_pv_wattage, predicted_annual_savings_kwh,
      predicted_cost_savings_eur, confidence_interval [lo, hi],
      top_features, explanation, model_version, fallback_used, boundary_violation
    """
    data = request.get_json(silent=True) or {}

    # ── Parse inputs ─────────────────────────────────────────────────────────
    def _f(key, default): return float(data.get(key, default) or default)
    def _i(key, default): return int(data.get(key, default) or default)

    lat             = _f("lat", 52.52)
    lon             = _f("lon", 13.41)
    annual_kwh      = _f("annual_kwh", 5000.0)
    pv_w            = _f("pv_w", 4000.0)
    battery_kwh     = _f("battery_kwh", 10.0)
    battery_eff     = _f("battery_efficiency", 90.0)
    perf_ratio      = _f("performance_ratio", 0.75)
    wind_kw         = _f("wind_kw", 0.0)
    household_size  = _i("household_size", 3)
    month           = _i("month", 6)
    calculation_id  = data.get("calculation_id")

    renewable_type = data.get("renewable_type", ["solar"])
    if isinstance(renewable_type, str):
        renewable_type = [renewable_type]

    # Tariff: user-supplied or country fallback
    tariff_raw = data.get("tariff")
    if tariff_raw is not None:
        tariff = float(tariff_raw)
    else:
        iso = country_from_latlon(lat, lon)
        tariff = TARIFF_BY_COUNTRY.get(iso, TARIFF_BY_COUNTRY["DEFAULT"])

    # ── Validate inputs (boundary_violation flag) ─────────────────────────────
    validation_data = {
        "lat": lat, "lon": lon,
        "annual_kwh": annual_kwh, "tariff": tariff,
        "renewable_type": renewable_type,
        "pv_w": pv_w, "wind_kw": wind_kw if wind_kw else None,
        "battery_kwh": battery_kwh, "battery_efficiency": battery_eff,
        "performance_ratio": perf_ratio, "tilt": 35.0, "roof_area": None,
    }
    errors, boundary_violation = validate_inputs(validation_data)
    fallback_used = False

    # ── Irradiance for savings calculation ────────────────────────────────────
    irr_monthly = fallback_irradiance(lat)

    # Average irradiance for the requested month
    avg_irradiance = irr_monthly[month - 1] if 1 <= month <= 12 else sum(irr_monthly) / 12
    # Rough avg temperature from latitude
    avg_temp = max(-10.0, 25.0 - (lat - 28) * 0.5)

    # ── ML prediction or fallback ─────────────────────────────────────────────
    try:
        if boundary_violation:
            raise ValueError("boundary_violation — using physics fallback")

        pv_model.ensure_ready()
        main_w, lower_w, upper_w = pv_model.predict_pv(
            month=month,
            latitude=lat,
            irradiance=avg_irradiance,
            avg_temp=avg_temp,
            household_size=household_size,
            consumption_kwh=annual_kwh,
        )
        recommended_pv_w = main_w
        confidence_interval = [lower_w, upper_w]

        top_features, explanation = pv_model.explain_top3(
            month=month, latitude=lat, irradiance=avg_irradiance,
            avg_temp=avg_temp, household_size=household_size,
            consumption_kwh=annual_kwh, tariff=tariff,
        )
        model_version = pv_model.model_version

    except Exception as exc:
        logger.warning(
            "PV model prediction failed (fallback_used=True): %s | "
            "lat=%.2f lon=%.2f annual_kwh=%.0f boundary_violation=%s",
            exc, lat, lon, annual_kwh, boundary_violation,
        )
        fallback_used = True
        # Physics fallback: use Block 3 engine optimal sizing estimate
        recommended_pv_w = round((annual_kwh / 1200) * 1000, 0)
        confidence_interval = [
            round(recommended_pv_w * 0.80, 0),
            round(recommended_pv_w * 1.20, 0),
        ]
        top_features = []
        explanation = (
            "Physics-based fallback applied. "
            "Your inputs are outside our calibrated range."
        )
        model_version = "fallback"

    # ── Annual savings for recommended PV wattage ─────────────────────────────
    try:
        from models.energy_model import detect_carbon_intensity
        ci_g = detect_carbon_intensity(lat, lon)
        savings_result = calculate_energy(
            irr_monthly=irr_monthly,
            pv_w=recommended_pv_w,
            battery_kwh=battery_kwh,
            battery_efficiency=battery_eff,
            performance_ratio=perf_ratio,
            annual_kwh=annual_kwh,
            tariff=tariff,
            lat=lat,
            wind_kw=wind_kw,
            carbon_intensity_g_per_kwh=ci_g,
        )
        predicted_annual_savings_kwh = savings_result["energy_covered"]
        predicted_cost_savings_eur   = savings_result["cost_savings_eur"]
    except Exception as exc:
        logger.warning("Savings calculation failed: %s", exc)
        predicted_annual_savings_kwh = 0.0
        predicted_cost_savings_eur   = 0.0

    return jsonify({
        "calculation_id":              calculation_id,
        "recommended_pv_wattage":      int(round(recommended_pv_w)),
        "predicted_annual_savings_kwh": round(predicted_annual_savings_kwh, 1),
        "predicted_cost_savings_eur":   round(predicted_cost_savings_eur, 2),
        "confidence_interval":          confidence_interval,
        "top_features":                 top_features,
        "explanation":                  explanation,
        "model_version":                model_version,
        "fallback_used":                fallback_used,
        "boundary_violation":           boundary_violation,
    }), 200


# ── GET /model-info — model metadata & metrics ────────────────────────────────

@predictions_bp.route("/model-info")
def model_info():
    """Returns PV model version, training seed, geographic scope, and metrics."""
    pv_model.ensure_ready()
    return jsonify({
        "model_version":    pv_model.model_version,
        "seed":             pv_model.SEED,
        "geographic_scope": pv_model.GEO_SCOPE,
        "training_samples": 2000,
        "features":         PV_FEATURE_NAMES,
        "notes": (
            "Synthetic training data, NumPy seed 42. "
            "Three GradientBoostingRegressor models: main (MSE), "
            "lower (quantile α=0.1), upper (quantile α=0.9)."
        ),
        "metrics": pv_model.metrics,
    })


# ── SHAP values (legacy JSON endpoint) ───────────────────────────────────────

@predictions_bp.route("/shap-values", methods=["GET", "POST"])
def shap_values():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = request.args

    try:
        month       = int(data.get("month", 6))
        hour        = int(data.get("hour", 12))
        irradiance  = float(data.get("irradiance", 5.0))
        temperature = float(data.get("temperature", 20.0))
        shap_vals   = ml_model.explain(month, hour, irradiance, temperature)
        prediction  = round(ml_model.predict(month, hour, irradiance, temperature), 4)
        return jsonify({
            "inputs":             {"month": month, "hour": hour,
                                   "irradiance": irradiance, "temperature": temperature},
            "prediction_kwh":     prediction,
            "shap_values":        shap_vals,
            "feature_importance": ml_model.feature_importance(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ── Dashboard ─────────────────────────────────────────────────────────────────

@predictions_bp.route("/dashboard")
def dashboard():
    from extensions import db
    from models.db_models import Calculation
    calcs = db.session.execute(
        db.select(Calculation).order_by(Calculation.created_at.desc()).limit(50)
    ).scalars().all()
    return render_template("dashboard.html", calcs=calcs)
