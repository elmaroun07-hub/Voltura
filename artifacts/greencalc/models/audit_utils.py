"""
Block 6 Article 73 — Audit logging utility.
Call log_audit() from any route handler after a calculation or prediction.
"""
import json
import logging

logger = logging.getLogger(__name__)


def log_audit(
    *,
    session_id: str,
    endpoint: str,
    input_hash: str = "",
    output_summary: dict = None,
    model_version: str = "",
    fallback_used: bool = False,
    boundary_violation: bool = False,
    emissions_kg: float = 0.0,
    user_feedback_id: int = None,
):
    """Insert one row into audit_log. Never raises — failures are logged as warnings."""
    try:
        from extensions import db
        from models.db_models import AuditLog

        row = AuditLog(
            session_id=session_id,
            endpoint=endpoint,
            input_hash=input_hash,
            output_summary=json.dumps(output_summary or {}, default=str),
            model_version=model_version,
            fallback_used=fallback_used,
            boundary_violation=boundary_violation,
            emissions_kg=emissions_kg,
            user_feedback_id=user_feedback_id,
        )
        db.session.add(row)
        db.session.commit()
    except Exception as exc:
        logger.warning("Audit log write failed: %s", exc)
