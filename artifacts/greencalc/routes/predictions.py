"""
Block 4+5+6: ML Optimization predictions endpoint + model documentation.
"""
import logging
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify
from models.ml_model import ml_model, pv_model, PV_FEATURE_NAMES
from models.energy_model import (
    calculate_energy, fallback_irradiance,
    country_from_latlon, TARIFF_BY_COUNTRY,
    validate_inputs,
)
from models.carbon_tracker import track_calculation

logger = logging.getLogger(__name__)

predictions_bp = Blueprint("predictions", __name__)


# ── Legacy HTML predict page ──────────────────────────────────────────────────

@predictions_bp.route("/predict", methods=["GET"])
def predict():
    return render_template("predict.html", result=None, shap_vals=None)


# ── POST /predict — Block 4+5 JSON API ───────────────────────────────────────

@predictions_bp.route("/predict", methods=["POST"])
def predict_api():
    data = request.get_json(silent=True) or {}

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

    tariff_raw = data.get("tariff")
    if tariff_raw is not None:
        tariff = float(tariff_raw)
    else:
        iso = country_from_latlon(lat, lon)
        tariff = TARIFF_BY_COUNTRY.get(iso, TARIFF_BY_COUNTRY["DEFAULT"])

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

    irr_monthly    = fallback_irradiance(lat)
    avg_irradiance = irr_monthly[month - 1] if 1 <= month <= 12 else sum(irr_monthly) / 12
    avg_temp       = max(-10.0, 25.0 - (lat - 28) * 0.5)

    try:
        if boundary_violation:
            raise ValueError("boundary_violation — using physics fallback")

        pv_model.ensure_ready()

        (main_w, lower_w, upper_w), _emissions = track_calculation(
            pv_model.predict_pv,
            month=month,
            latitude=lat,
            irradiance=avg_irradiance,
            avg_temp=avg_temp,
            household_size=household_size,
            consumption_kwh=annual_kwh,
        )
        recommended_pv_w    = main_w
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
        fallback_used        = True
        recommended_pv_w     = round((annual_kwh / 1200) * 1000, 0)
        confidence_interval  = [
            round(recommended_pv_w * 0.80, 0),
            round(recommended_pv_w * 1.20, 0),
        ]
        top_features  = []
        explanation   = (
            "Physics-based fallback applied. "
            "Your inputs are outside our calibrated range."
        )
        model_version = "fallback"

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
        "calculation_id":               calculation_id,
        "recommended_pv_wattage":       int(round(recommended_pv_w)),
        "predicted_annual_savings_kwh": round(predicted_annual_savings_kwh, 1),
        "predicted_cost_savings_eur":   round(predicted_cost_savings_eur, 2),
        "confidence_interval":          confidence_interval,
        "top_features":                 top_features,
        "explanation":                  explanation,
        "model_version":                model_version,
        "fallback_used":                fallback_used,
        "boundary_violation":           boundary_violation,
    }), 200


# ── GET /model-info — Block 4+6 JSON API ─────────────────────────────────────

@predictions_bp.route("/model-info")
def model_info():
    pv_model.ensure_ready()
    m = pv_model.metrics

    # Block 6: regional MAE warning if spread > 15%
    maes = {
        "Southern EU (lat<42°)": m.get("mae_southern_eu", 0) or 0,
        "Northern EU (lat≥42°)": m.get("mae_northern_eu", 0) or 0,
        "North Africa (lat<35°)": m.get("mae_north_africa", 0) or 0,
    }
    non_zero = [v for v in maes.values() if v > 0]
    regional_warning = (
        len(non_zero) >= 2
        and (max(non_zero) - min(non_zero)) / min(non_zero) > 0.15
    )

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
        "metrics": m,
        # Block 6 training data documentation (Article 10)
        "training_data": {
            "source": "Synthetic (NumPy seed 42) + NASA POWER API historical",
            "date_range": "2015–2023 (NASA historical irradiance)",
            "geographic_coverage": "lat 28°–60° (Spain, Morocco, EU)",
            "known_bias": (
                "Underrepresented at lat > 60° (Scandinavia, Northern Russia) "
                "and lat < 28° (sub-Saharan Africa, tropics). "
                "Calibrated for residential scale only (100W–20,000W PV, single-family homes)."
            ),
            "random_seed": pv_model.SEED,
            "algorithm": "GradientBoostingRegressor (scikit-learn)",
            "training_method": "Supervised regression, 80/20 train/test split",
            "intended_use": (
                "Estimate optimal residential PV wattage for single-family homes "
                "in the EU / Southern Mediterranean region. "
                "NOT intended for commercial, industrial, or off-grid systems."
            ),
        },
        "regional_mae": maes,
        "regional_warning": regional_warning,
        "known_limitations": (
            "Calibrated for residential PV only (100W–20,000W). "
            "Accuracy degrades outside lat 28°–60°. "
            "Wind generation uses simplified capacity-factor model."
        ),
        "contact": "admin@greencalc.example.com",
    })


# ── GET /model-info/page — Block 6 HTML documentation page ───────────────────

@predictions_bp.route("/model-info/page")
def model_info_page():
    pv_model.ensure_ready()
    m = pv_model.metrics
    maes = {
        "Southern EU (lat<42°)": m.get("mae_southern_eu", 0) or 0,
        "Northern EU (lat≥42°)": m.get("mae_northern_eu", 0) or 0,
        "North Africa (lat<35°)": m.get("mae_north_africa", 0) or 0,
    }
    non_zero = [v for v in maes.values() if v > 0]
    regional_warning = (
        len(non_zero) >= 2
        and (max(non_zero) - min(non_zero)) / min(non_zero) > 0.15
    )
    return render_template(
        "model_info.html",
        pv_model=pv_model,
        metrics=m,
        maes=maes,
        regional_warning=regional_warning,
        features=PV_FEATURE_NAMES,
    )


# ── GET /dashboard/data — Block 5 JSON for Chart.js ──────────────────────────

@predictions_bp.route("/dashboard/data")
def dashboard_data():
    from extensions import db
    from models.db_models import CalculationEmissions
    from sqlalchemy import func

    agg = db.session.execute(
        db.select(
            func.count(CalculationEmissions.id).label("total_calcs"),
            func.sum(CalculationEmissions.emissions_kg).label("total_kg"),
            func.avg(CalculationEmissions.emissions_kg).label("avg_kg"),
        )
    ).one()

    total_calcs = agg.total_calcs or 0
    total_kg    = float(agg.total_kg or 0.0)
    avg_kg      = float(agg.avg_kg or 0.0)

    cutoff = datetime.utcnow() - timedelta(days=30)
    rows = db.session.execute(
        db.select(
            func.date(CalculationEmissions.timestamp).label("day"),
            func.sum(CalculationEmissions.emissions_kg).label("daily_kg"),
            func.count(CalculationEmissions.id).label("count"),
        )
        .where(CalculationEmissions.timestamp >= cutoff)
        .group_by(func.date(CalculationEmissions.timestamp))
        .order_by(func.date(CalculationEmissions.timestamp))
    ).all()

    daily_emissions = [
        {
            "date":        str(row.day),
            "emissions_g": round(float(row.daily_kg) * 1000, 6),
            "count":       int(row.count),
        }
        for row in rows
    ]

    return jsonify({
        "total_emissions_kg":  round(total_kg, 9),
        "total_emissions_g":   round(total_kg * 1000, 6),
        "avg_emissions_kg":    round(avg_kg, 9),
        "avg_emissions_g":     round(avg_kg * 1000, 6),
        "total_calculations":  total_calcs,
        "daily_emissions":     daily_emissions,
        "car_km_total":        round(total_kg / 0.00021, 4),
    })


# ── SHAP values (legacy JSON) ─────────────────────────────────────────────────

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


# ── Dashboard (HTML) ─────────────────────────────────────────────────────────

@predictions_bp.route("/dashboard")
def dashboard():
    from extensions import db
    from models.db_models import Calculation, CalculationEmissions
    from sqlalchemy import func

    calcs = db.session.execute(
        db.select(Calculation).order_by(Calculation.created_at.desc()).limit(50)
    ).scalars().all()

    agg = db.session.execute(
        db.select(
            func.count(CalculationEmissions.id).label("n"),
            func.sum(CalculationEmissions.emissions_kg).label("total_kg"),
            func.avg(CalculationEmissions.emissions_kg).label("avg_kg"),
        )
    ).one()

    total_emissions_g = round(float(agg.total_kg or 0) * 1000, 6)
    avg_emissions_g   = round(float(agg.avg_kg or 0) * 1000, 6)
    total_calcs       = agg.n or 0
    car_km_total      = round(float(agg.total_kg or 0) / 0.00021, 4)

    return render_template(
        "dashboard.html",
        calcs=calcs,
        total_emissions_g=total_emissions_g,
        avg_emissions_g=avg_emissions_g,
        total_calcs=total_calcs,
        car_km_total=car_km_total,
    )
