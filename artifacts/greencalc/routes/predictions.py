from flask import Blueprint, render_template, request, jsonify
from models.ml_model import ml_model

predictions_bp = Blueprint("predictions", __name__)


@predictions_bp.route("/predict", methods=["GET", "POST"])
def predict():
    result = None
    shap_vals = None
    if request.method == "POST":
        try:
            month = int(request.form.get("month", 6))
            hour = int(request.form.get("hour", 12))
            irradiance = float(request.form.get("irradiance", 5.0))
            temperature = float(request.form.get("temperature", 20.0))
            result = round(ml_model.predict(month, hour, irradiance, temperature), 3)
            shap_vals = ml_model.explain(month, hour, irradiance, temperature)
        except Exception as e:
            result = f"Error: {e}"
    return render_template("predict.html", result=result, shap_vals=shap_vals)


@predictions_bp.route("/shap-values", methods=["GET", "POST"])
def shap_values():
    """Return SHAP feature attributions as JSON for given input features."""
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = request.args

    try:
        month = int(data.get("month", 6))
        hour = int(data.get("hour", 12))
        irradiance = float(data.get("irradiance", 5.0))
        temperature = float(data.get("temperature", 20.0))
        shap_vals = ml_model.explain(month, hour, irradiance, temperature)
        prediction = round(ml_model.predict(month, hour, irradiance, temperature), 4)
        return jsonify({
            "inputs": {"month": month, "hour": hour, "irradiance": irradiance, "temperature": temperature},
            "prediction_kwh": prediction,
            "shap_values": shap_vals,
            "feature_importance": ml_model.feature_importance(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@predictions_bp.route("/dashboard")
def dashboard():
    from extensions import db
    from models.db_models import Calculation
    calcs = db.session.execute(
        db.select(Calculation).order_by(Calculation.created_at.desc()).limit(50)
    ).scalars().all()
    return render_template("dashboard.html", calcs=calcs)
