"""
Block 5 — CodeCarbon wrapper for GreenCalc.
Scope: wrap ONLY the calculation engine call and ML prediction.
NEVER wrap the entire Flask app or any route outside /predict.
"""
import logging
import os
import time

logger = logging.getLogger(__name__)


def track_calculation(func, *args, **kwargs):
    """Wrap a single compute call with CodeCarbon emissions tracking.

    Returns (result, emissions_kg).
    On any CodeCarbon failure, falls back to zero-emission estimate
    so the caller never raises.
    """
    tmp_path = "/tmp/cc_greencalc_temp.csv"
    t0 = time.time()

    try:
        from codecarbon import EmissionsTracker

        tracker = EmissionsTracker(
            project_name="greencalc",
            save_to_file=True,
            output_file=tmp_path,
            save_to_api=False,
            log_level="error",
        )
        try:
            tracker.start()
            result = func(*args, **kwargs)
            emissions_kg = tracker.stop() or 0.0
        except Exception as e:
            try:
                tracker.stop()
            except Exception:
                pass
            raise e
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

        return result, float(emissions_kg)

    except ImportError:
        # CodeCarbon not installed — physics-based fallback
        result = func(*args, **kwargs)
        duration_s = time.time() - t0
        # ~10 W CPU × duration → kWh → kg CO₂ at 0.4 kgCO₂/kWh
        emissions_kg = duration_s * 10 / 3_600_000 * 0.4
        return result, emissions_kg

    except Exception as exc:
        logger.warning("CodeCarbon tracking failed (%s) — returning zero emission.", exc)
        result = func(*args, **kwargs)
        return result, 0.0


def get_tracker_metadata(tracker) -> dict:
    """Extract duration and energy_consumed_kwh from a stopped CodeCarbon tracker."""
    try:
        fd = tracker.final_emissions_data
        return {
            "duration_seconds": float(getattr(fd, "duration", 0.0) or 0.0),
            "energy_consumed_kwh": float(getattr(fd, "energy_consumed", 0.0) or 0.0),
        }
    except Exception:
        return {"duration_seconds": 0.0, "energy_consumed_kwh": 0.0}
