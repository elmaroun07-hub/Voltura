"""
Block 6 — EU AI Act Compliance Layer
Article 50 (Transparency), Article 14 (Human Oversight),
Article 10 (Data Governance / GDPR), Article 73 (Audit Logging).
"""
import os
import logging
from flask import (
    Blueprint, render_template, request, jsonify, session as flask_session,
)
from models.ml_model import ml_model, FEATURE_NAMES

logger = logging.getLogger(__name__)

compliance_bp = Blueprint("compliance", __name__)


# ── Legacy compliance page ────────────────────────────────────────────────────

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
    max_shap = 1
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
        max_shap=max_shap,
    )


# ── Article 14: User feedback (thumbs up / down) ──────────────────────────────

@compliance_bp.route("/feedback", methods=["POST"])
def feedback():
    from extensions import db
    from models.db_models import UserFeedback

    data = request.get_json(silent=True) or request.form
    calculation_id = data.get("calculation_id")
    rating_raw = data.get("rating")
    comment = (data.get("comment") or "").strip()[:1000]
    sid = flask_session.get("_sid", "anonymous")

    try:
        rating = int(rating_raw)
        if rating not in (1, -1):
            return jsonify({"error": "rating must be 1 (👍) or -1 (👎)"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be 1 or -1"}), 400

    fb = UserFeedback(
        calculation_id=int(calculation_id) if calculation_id else None,
        session_id=sid,
        rating=rating,
        comment=comment,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"saved": True, "feedback_id": fb.id}), 201


# ── Article 14: Manual override ──────────────────────────────────────────────

@compliance_bp.route("/override", methods=["POST"])
def override():
    from extensions import db
    from models.db_models import UserOverride

    data = request.get_json(silent=True) or request.form
    calculation_id = data.get("calculation_id")
    field_name     = (data.get("field_name") or "").strip()[:64]
    original_value = str(data.get("original_value") or "")[:64]
    override_value = str(data.get("override_value") or "")[:64]
    sid = flask_session.get("_sid", "anonymous")

    if not calculation_id or not field_name:
        return jsonify({"error": "calculation_id and field_name are required"}), 400

    row = UserOverride(
        calculation_id=int(calculation_id),
        session_id=sid,
        field_name=field_name,
        original_value=original_value,
        override_value=override_value,
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({"saved": True, "override_id": row.id}), 201


# ── GDPR Article 10: Delete my data ─────────────────────────────────────────

@compliance_bp.route("/delete-my-data", methods=["GET", "POST"])
def delete_my_data():
    if request.method == "GET":
        return render_template("delete_data.html")

    from extensions import db
    from models.db_models import Calculation

    sid = flask_session.get("_sid", "")
    email = (request.form.get("email") or request.get_json(silent=True) or {}).get("email") or ""

    deleted = 0

    # Primary: delete all by session_id
    if sid:
        rows = db.session.execute(
            db.select(Calculation).where(Calculation.session_id == sid)
        ).scalars().all()
        for row in rows:
            db.session.delete(row)
        deleted += len(rows)

    # Fallback: accept email to delete opt-in records (if session expired)
    if not deleted and email:
        rows = db.session.execute(
            db.select(Calculation).where(Calculation.location.ilike(f"%{email}%"))
        ).scalars().all()
        for row in rows:
            db.session.delete(row)
        deleted += len(rows)

    db.session.commit()

    return jsonify({"deleted": True, "records_removed": deleted}), 200


# ── Article 73: Admin audit endpoint ─────────────────────────────────────────

@compliance_bp.route("/admin/audit")
def admin_audit():
    token = request.headers.get("X-Admin-Token", "")
    admin_token = os.getenv("ADMIN_TOKEN", "")

    # Always 403 if token missing or wrong — even if ADMIN_TOKEN not set
    if not token or token != admin_token:
        return jsonify({"error": "Forbidden — invalid or missing X-Admin-Token"}), 403

    from extensions import db
    from models.db_models import AuditLog, UserFeedback
    from sqlalchemy import func

    # Total predictions
    total = db.session.execute(
        db.select(func.count(AuditLog.id))
    ).scalar() or 0

    # Fallback rate
    fallbacks = db.session.execute(
        db.select(func.count(AuditLog.id)).where(AuditLog.fallback_used == True)  # noqa: E712
    ).scalar() or 0

    # Boundary violations
    violations = db.session.execute(
        db.select(func.count(AuditLog.id)).where(AuditLog.boundary_violation == True)  # noqa: E712
    ).scalar() or 0

    # Feedback sentiment
    pos = db.session.execute(
        db.select(func.count(UserFeedback.id)).where(UserFeedback.rating == 1)
    ).scalar() or 0
    neg = db.session.execute(
        db.select(func.count(UserFeedback.id)).where(UserFeedback.rating == -1)
    ).scalar() or 0
    total_feedback = pos + neg

    # Recent entries (last 50)
    recent = db.session.execute(
        db.select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(50)
    ).scalars().all()

    return jsonify({
        "prediction_volume":     total,
        "fallback_rate_pct":     round(fallbacks / total * 100, 1) if total else 0.0,
        "boundary_violations":   violations,
        "violation_rate_pct":    round(violations / total * 100, 1) if total else 0.0,
        "feedback_positive":     pos,
        "feedback_negative":     neg,
        "feedback_total":        total_feedback,
        "feedback_sentiment_pct": round(pos / total_feedback * 100, 1) if total_feedback else None,
        "recent_audit_entries": [
            {
                "id":                row.id,
                "timestamp":         row.timestamp.isoformat(),
                "session_id":        row.session_id,
                "endpoint":          row.endpoint,
                "model_version":     row.model_version,
                "fallback_used":     row.fallback_used,
                "boundary_violation":row.boundary_violation,
                "emissions_kg":      row.emissions_kg,
            }
            for row in recent
        ],
    })
