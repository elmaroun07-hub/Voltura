from flask import Blueprint, render_template
from models.ml_model import ml_model, FEATURE_NAMES

compliance_bp = Blueprint("compliance", __name__)


@compliance_bp.route("/compliance")
def compliance():
    from extensions import db
    from models.db_models import Calculation

    feature_importance = ml_model.feature_importance()
    max_imp = max(feature_importance.values()) if feature_importance else 1

    last_calc = db.session.execute(
        db.select(Calculation).order_by(Calculation.created_at.desc()).limit(1)
    ).scalars().first()

    last_shap = None
    last_prediction = None
    if last_calc:
        mid_irr = 5.0
        mid_temp = 15.0
        last_prediction = round(ml_model.predict(6, 12, mid_irr, mid_temp), 3)
        last_shap = ml_model.explain(6, 12, mid_irr, mid_temp)
        max_shap = max(abs(v) for v in last_shap.values()) if last_shap else 1

    return render_template(
        "compliance.html",
        feature_importance=feature_importance,
        feature_names=FEATURE_NAMES,
        max_imp=max_imp,
        last_calc=last_calc,
        last_shap=last_shap,
        last_prediction=last_prediction,
        max_shap=max_shap if last_shap else 1,
    )
