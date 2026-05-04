from flask import Blueprint, render_template, current_app
from models.ml_model import ml_model, FEATURE_NAMES

compliance_bp = Blueprint("compliance", __name__)


@compliance_bp.route("/compliance")
def compliance():
    feature_importance = ml_model.feature_importance()
    max_imp = max(feature_importance.values()) if feature_importance else 1
    return render_template(
        "compliance.html",
        feature_importance=feature_importance,
        feature_names=FEATURE_NAMES,
        max_imp=max_imp,
    )
