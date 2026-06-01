import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from models.energy_model import (
    simulate_8760, compute_roi_curve, compute_payback_years,
    geocode, panel_efficiency_factor, fallback_irradiance,
    country_from_latlon, detect_carbon_intensity, validate_inputs,
    TARIFF_BY_COUNTRY,
)

IRR  = [3.5, 4.0, 5.0, 5.5, 6.0, 6.5, 6.5, 6.0, 5.0, 4.0, 3.0, 2.8]
TEMP = [2.0, 3.5, 8.0, 13.0, 17.0, 21.0, 23.0, 22.0, 17.0, 12.0, 6.0, 3.0]


# ── simulate_8760 ─────────────────────────────────────────────────────────────

def test_simulate_8760_returns_nonzero_savings():
    result = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP)
    assert result["total_saved_kwh"] > 0
    assert result["total_solar_kwh"] > 0
    assert len(result["monthly_data"]) == 12


def test_battery_soc_within_bounds():
    result = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP)
    assert result["min_soc"] >= -0.001
    assert result["max_soc"] <= 10 + 0.001


def test_roi_curve_payback():
    payback = compute_payback_years(1500.0, 8000.0)
    assert 0 < payback < 25


def test_roi_curve_length():
    curve = compute_roi_curve(1500, 8000, years=25)
    assert len(curve) == 25
    assert curve[-1]["cumulative_savings"] > curve[0]["cumulative_savings"]


def test_geocode_fallback():
    lat, lon = geocode("xyznotarealplace12345")
    assert isinstance(lat, float) and isinstance(lon, float)


def test_panel_efficiency_south():
    assert 0.95 <= panel_efficiency_factor(35, "south") <= 1.0


def test_panel_efficiency_north():
    assert panel_efficiency_factor(35, "north") < 0.75


def test_energy_mix_sums_to_100():
    result = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP)
    total = result["solar_pct"] + result["battery_pct"] + result["grid_pct"]
    assert abs(total - 100.0) < 2.0


# ── Block 2: fallback irradiance latitude bands ───────────────────────────────

def test_fallback_irradiance_returns_12_values():
    assert len(fallback_irradiance(52.5)) == 12


def test_fallback_irradiance_all_positive():
    assert all(v > 0 for v in fallback_irradiance(52.5))


def test_fallback_irradiance_low_lat_base_55():
    vals = fallback_irradiance(20.0)   # < 30 → base 5.5
    assert max(vals) <= 5.5 * 1.25


def test_fallback_irradiance_high_lat_base_28():
    high = fallback_irradiance(55.0)   # > 50 → base 2.8
    low  = fallback_irradiance(20.0)   # < 30 → base 5.5
    assert max(high) < max(low)


def test_fallback_irradiance_bands_strictly_decreasing():
    assert max(fallback_irradiance(25)) > max(fallback_irradiance(35))
    assert max(fallback_irradiance(35)) > max(fallback_irradiance(45))
    assert max(fallback_irradiance(45)) > max(fallback_irradiance(55))


# ── Block 2: bounding-box country lookup ─────────────────────────────────────

def test_country_from_latlon_spain():
    assert country_from_latlon(40.4, -3.7) == "ES"


def test_country_from_latlon_germany():
    assert country_from_latlon(52.52, 13.41) == "DE"


def test_country_from_latlon_morocco():
    assert country_from_latlon(33.9, -6.8) == "MA"


def test_country_from_latlon_france():
    assert country_from_latlon(48.85, 2.35) == "FR"   # Paris


def test_country_from_latlon_unknown_returns_default():
    assert country_from_latlon(0.0, 0.0) == "DEFAULT"


def test_detect_carbon_intensity_spain():
    assert detect_carbon_intensity(40.4, -3.7) == 207.0


def test_detect_carbon_intensity_default():
    assert detect_carbon_intensity(0.0, 0.0) == 400.0


# ── Block 2: tariff fallback dict ────────────────────────────────────────────

def test_tariff_dict_has_required_keys():
    for key in ["ES", "MA", "DE", "FR", "IT", "PT", "GB", "DEFAULT"]:
        assert key in TARIFF_BY_COUNTRY


def test_tariff_spain():
    assert TARIFF_BY_COUNTRY["ES"] == pytest.approx(0.18)


# ── Block 2: validate_inputs ──────────────────────────────────────────────────

def _base(**kw):
    data = {
        "lat": 52.52, "lon": 13.41,
        "annual_kwh": 5000.0, "tariff": 0.30,
        "renewable_type": ["solar"],
        "pv_w": 4000.0, "wind_kw": None,
        "battery_kwh": 10.0, "battery_efficiency": 90.0,
        "performance_ratio": 0.75, "tilt": 35.0,
        "roof_area": None,
    }
    data.update(kw)
    return data


def test_validate_valid_inputs():
    errors, bv = validate_inputs(_base())
    assert errors == [] and bv is False


def test_validate_pv_too_low():
    errors, _ = validate_inputs(_base(pv_w=50.0))
    assert any(e["field"] == "pv_w" for e in errors)


def test_validate_pv_exceeds_roof():
    errors, _ = validate_inputs(_base(pv_w=4000.0, roof_area=10.0))
    assert any(e["field"] == "pv_w" for e in errors)


def test_validate_battery_too_large():
    errors, _ = validate_inputs(_base(battery_kwh=150.0))
    assert any(e["field"] == "battery_kwh" for e in errors)


def test_validate_bad_lat():
    errors, _ = validate_inputs(_base(lat=999.0))
    assert any(e["field"] == "lat" for e in errors)


def test_validate_performance_ratio_out_of_range():
    errors, _ = validate_inputs(_base(performance_ratio=0.95))
    assert any(e["field"] == "performance_ratio" for e in errors)


def test_validate_no_renewable_type():
    errors, _ = validate_inputs(_base(renewable_type=[]))
    assert any(e["field"] == "renewable_type" for e in errors)


def test_validate_wind_missing_capacity():
    errors, _ = validate_inputs(_base(renewable_type=["wind"], wind_kw=None))
    assert any(e["field"] == "wind_kw" for e in errors)


def test_validate_boundary_violation_large_pv():
    _, bv = validate_inputs(_base(pv_w=25000.0))
    assert bv is True


def test_validate_boundary_violation_clean():
    _, bv = validate_inputs(_base())
    assert bv is False


# ── Block 2: wind simulation ──────────────────────────────────────────────────

def test_wind_simulation_adds_generation():
    solar_only = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP, wind_kw=0.0)
    with_wind  = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP, wind_kw=3.0)
    assert with_wind["total_saved_kwh"] > solar_only["total_saved_kwh"]


def test_wind_simulation_pct_field_exists():
    result = simulate_8760(5000, 0, 0, 90, 1.0, IRR, TEMP, wind_kw=5.0)
    assert "wind_pct" in result
    assert result["wind_pct"] > 0


def test_performance_ratio_higher_yields_more():
    high = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP, performance_ratio=0.85)
    low  = simulate_8760(5000, 4000, 10, 90, 1.0, IRR, TEMP, performance_ratio=0.60)
    assert high["total_saved_kwh"] > low["total_saved_kwh"]
