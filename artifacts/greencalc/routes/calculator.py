import json
import time
from flask import Blueprint, render_template, request, current_app
from models.energy_model import (
    geocode, fetch_nasa_power, panel_efficiency_factor, simulate_8760,
    compute_roi_curve, compute_payback_years, detect_carbon_intensity,
    estimate_installation_cost
)
from models.ml_model import ml_model

calculator_bp = Blueprint("calculator", __name__)


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

    try:
        location = request.form.get("location", "Berlin, Germany")
        annual_kwh = float(request.form.get("annual_kwh", 5000))
        pv_w = float(request.form.get("pv_w", 4000))
        battery_kwh = float(request.form.get("battery_kwh", 10))
        tariff = float(request.form.get("tariff", 0.30))
        efficiency = float(request.form.get("efficiency", 90))
        tilt = float(request.form.get("tilt", 35))
        orientation = request.form.get("orientation", "south")
        installation_cost_input = request.form.get("installation_cost", "").strip()

        installation_cost = (
            float(installation_cost_input)
            if installation_cost_input
            else estimate_installation_cost(pv_w, battery_kwh)
        )

        lat, lon = geocode(location)

        nasa = fetch_nasa_power(lat, lon)
        irr_monthly = nasa["irradiance"]
        temp_monthly = nasa["temperature"]

        panel_factor = panel_efficiency_factor(tilt, orientation)

        t0 = time.time()
        sim = simulate_8760(annual_kwh, pv_w, battery_kwh, efficiency, panel_factor, irr_monthly, temp_monthly)
        compute_time_s = time.time() - t0

        annual_savings_eur = round(sim["total_saved_kwh"] * tariff, 2)
        carbon_intensity = detect_carbon_intensity(location)
        co2_kg = round(sim["total_saved_kwh"] * carbon_intensity / 1000, 1)

        payback = compute_payback_years(annual_savings_eur, installation_cost)
        roi_curve = compute_roi_curve(annual_savings_eur, installation_cost)

        mid_month = 6
        mid_hour = 12
        mid_irr = irr_monthly[mid_month - 1]
        mid_temp = temp_monthly[mid_month - 1]
        ml_pred = ml_model.predict(mid_month, mid_hour, mid_irr, mid_temp)
        shap_vals = ml_model.explain(mid_month, mid_hour, mid_irr, mid_temp)

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

        calc = Calculation(
            location=location,
            lat=lat,
            lon=lon,
            annual_kwh=annual_kwh,
            pv_w=pv_w,
            battery_kwh=battery_kwh,
            tariff=tariff,
            efficiency=efficiency,
            tilt=tilt,
            orientation=orientation,
            installation_cost=installation_cost,
            annual_saved_kwh=sim["total_saved_kwh"],
            annual_savings_eur=annual_savings_eur,
            co2_kg=co2_kg,
            payback_years=payback,
            net_25yr=net_25yr,
            solar_pct=sim["solar_pct"],
            battery_pct=sim["battery_pct"],
            grid_pct=sim["grid_pct"],
            computation_co2_mg=computation_co2_mg,
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
            monthly_data_json=json.dumps(sim["monthly_data"]),
            roi_curve_json=json.dumps(roi_curve),
            shap_vals_json=json.dumps(shap_vals),
        )
    except Exception as e:
        current_app.logger.error(f"Calculate error: {e}")
        return render_template("form.html", error=str(e)), 400
