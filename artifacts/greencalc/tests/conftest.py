"""
Pytest fixtures for the GreenCalc Flask suite — load-hardening (task_ff173b68).

Before this file the suite had NO conftest and NO mocking, so every tracked call
spun up a REAL codecarbon.EmissionsTracker (per-test hardware + geolocation
probing) and /calculate route tests made live NASA POWER / Nominatim HTTP calls.
Result: non-deterministic, pathologically slow runs (observed ~9 min vs ~64 min).

The autouse `_offline_env` fixture makes every test fully offline & deterministic:
  * codecarbon.EmissionsTracker -> no-op tracker (reports 0.0 kg, no probing)
  * fetch_nasa_power / geocode   -> deterministic offline stubs
  * requests.get                 -> guard that RAISES (proves zero live calls leak)

Live integration coverage is opt-in: mark a test @pytest.mark.network and run
`pytest --run-network`; such tests bypass the offline patches and hit the real APIs.
"""
import importlib
import sys

import pytest


# ── Offline fakes ─────────────────────────────────────────────────────────────

class _NoOpEmissionsTracker:
    """Drop-in for codecarbon.EmissionsTracker: no hardware/network probing."""

    def __init__(self, *args, **kwargs):
        self.final_emissions_data = None

    def start(self):
        return None

    def stop(self):
        return 0.0


def _fake_fetch_nasa_power(lat, lon):
    """Deterministic, offline replacement for NASA POWER (latitude-band data)."""
    from models.energy_model import fallback_irradiance
    return {
        "irradiance": fallback_irradiance(lat),
        "temperature": [15.0] * 12,
        "source": "nasa",
    }


def _fake_geocode(location):
    """Deterministic, offline replacement for the Nominatim geocode (Berlin)."""
    return 52.52, 13.405


def _blocked_requests_get(*args, **kwargs):
    raise RuntimeError(
        "Live network call blocked in tests (requests.get). Stub it in "
        "tests/conftest.py, or mark the test @pytest.mark.network."
    )


# ── Autouse: every test is offline + deterministic ────────────────────────────

@pytest.fixture(autouse=True)
def _offline_env(request, monkeypatch):
    # Opt-in live integration tests run against the real codecarbon + APIs.
    if request.node.get_closest_marker("network"):
        yield
        return

    # 1) codecarbon — one patch point; track_calculation re-imports it per call.
    monkeypatch.setattr("codecarbon.EmissionsTracker", _NoOpEmissionsTracker, raising=False)

    # 2) NASA POWER + geocode. export.py imports them *inside* the function (so the
    #    models.energy_model patch is enough there); calculator.py binds them at
    #    module load (so patch that module's names too, if it's been imported).
    em = importlib.import_module("models.energy_model")
    monkeypatch.setattr(em, "fetch_nasa_power", _fake_fetch_nasa_power, raising=False)
    monkeypatch.setattr(em, "geocode", _fake_geocode, raising=False)
    cal = sys.modules.get("routes.calculator")
    if cal is not None:
        monkeypatch.setattr(cal, "fetch_nasa_power", _fake_fetch_nasa_power, raising=False)
        monkeypatch.setattr(cal, "geocode", _fake_geocode, raising=False)

    # 3) Safety net — any other live HTTP fails loudly instead of hitting the wire.
    import requests
    monkeypatch.setattr(requests, "get", _blocked_requests_get, raising=False)

    yield


# ── Opt-in live network tests ─────────────────────────────────────────────────

def pytest_addoption(parser):
    parser.addoption(
        "--run-network", action="store_true", default=False,
        help="run @pytest.mark.network tests that hit live external APIs",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "network: live network integration test (deselected unless --run-network)",
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--run-network"):
        return
    skip_live = pytest.mark.skip(reason="needs --run-network (live external API)")
    for item in items:
        if item.get_closest_marker("network"):
            item.add_marker(skip_live)
