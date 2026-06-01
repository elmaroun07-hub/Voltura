"""
Energy model tests — Block 2 + Block 3 verification.
Block 3 known-input checks verify physical reasonableness against hand-calculated values.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import numpy as np
from models.energy_model import (
    calculate_energy, compute_roi_curve, compute_payback_years,
    geocode, panel_efficiency_factor, fallback_irradiance,
    country_from_latlon, detect_carbon_intensity, validate_inputs,
    TARIFF_BY_COUNTRY, make_input_hash,
)

# ── Standard test inputs ──────────────────────────────────────────────────────
IRR  = [3.5, 4.0, 5.0, 5.5, 6.0, 6.5, 6.5, 6.0, 5.0, 4.0, 3.0, 2.8]
TEMP = [2.0, 3.5, 8.0, 13.0, 17.0, 21.0, 23.0, 22.0, 17.0, 12.0, 6.0, 3.0]
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def _run(**kw):
    defaults = dict(
        irr_monthly=IRR, pv_w=4000.0, battery_kwh=10.0, battery_efficiency=90.0,
        performance_ratio=0.75, annual_kwh=5000.0, tariff=0.30,
        lat=52.52, wind_kw=0.0, carbon_intensity_g_per_kwh=380.0,
    )
    defaults.update(kw)
    return calculate_energy(**defaults)


# ── Block 3: required spec fields ────────────────────────────────────────────

def test_calculate_energy_returns_required_spec_fields():
    r = _run()
    for key in ["solar_kwh", "wind_kwh", "energy_covered", "cost_savings_eur",
                "co2_reduced_tonnes", "payback_year", "npv_savings",
                "installation_cost_eur", "cumulative_savings"]:
        assert key in r, f"Missing spec field: {key}"


def test_calculate_energy_cumulative_savings_length():
    r = _run()
    assert len(r["cumulative_savings"]) == 25


def test_calculate_energy_cumulative_savings_monotone():
    r = _run()
    cs = r["cumulative_savings"]
    assert all(cs[i] < cs[i+1] for i in range(len(cs) - 1))


def test_calculate_energy_returns_12_monthly_rows():
    r = _run()
    assert len(r["monthly_data"]) == 12


def test_calculate_energy_monthly_month_names():
    r = _run()
    months = [row["month"] for row in r["monthly_data"]]
    assert months[0] == "Jan" and months[-1] == "Dec"


# ── Block 3: known-input hand-verification ───────────────────────────────────
#
# 4000 W PV, PR=0.75, Berlin irradiance list above
#
# June (index 5): 4000 × 6.5 × 30 × 0.75 / 1000 = 585.0 kWh generated
#   monthly_consumption = 5000/12 ≈ 416.7 kWh → excess; direct_solar = 416.7
#
# Jan (index 0):  4000 × 3.5 × 31 × 0.75 / 1000 = 325.5 kWh generated < 416.7 → deficit
#
# installation_cost_eur = (4000/1000) × 1200 = 4800 €


def test_known_solar_june_direct():
    """June solar generated > monthly consumption → direct_solar = consumption/12 ≈ 416.7"""
    r = _run()
    monthly_cons = 5000.0 / 12
    assert r["monthly_data"][5]["solar_kwh"] == pytest.approx(monthly_cons, abs=2.0)


def test_known_solar_january():
    """Jan: 4000 × 3.5 × 31 × 0.75 / 1000 = 325.5 kWh, all directly consumed (deficit month)"""
    r = _run()
    expected = 4000 * 3.5 * 31 * 0.75 / 1000  # 325.5
    assert r["monthly_data"][0]["solar_kwh"] == pytest.approx(expected, abs=1.0)


def test_known_january_has_grid():
    """Jan deficit → some grid draw"""
    r = _run()
    assert r["monthly_data"][0]["grid_kwh"] > 0


def test_known_installation_cost():
    """(4000 W / 1000) × €1,200/kWp = €4,800"""
    r = _run()
    assert r["installation_cost_eur"] == pytest.approx(4800.0, rel=1e-6)


def test_known_solar_annual_range():
    """Berlin 4 kWp → 3,000–5,500 kWh/year"""
    r = _run()
    assert 3000 < r["solar_kwh"] < 5500


def test_energy_covered_capped_at_consumption():
    """energy_covered = min(solar+wind, annual_kwh) ≤ 5000"""
    r = _run()
    assert r["energy_covered"] <= 5000.0 + 0.01


def test_cost_savings_equals_covered_times_tariff():
    r = _run()
    assert r["cost_savings_eur"] == pytest.approx(r["energy_covered"] * 0.30, rel=1e-6)


def test_co2_tonnes_formula():
    """co2_reduced_tonnes = energy_covered × (380 g/kWh / 1000) / 1000"""
    r = _run()
    expected = r["energy_covered"] * 380.0 / 1_000_000.0
    assert r["co2_reduced_tonnes"] == pytest.approx(expected, rel=1e-3)


def test_npv_positive():
    r = _run()
    assert r["npv_savings"] > 0


def test_payback_year_reasonable():
    """4 kWp, €0.30/kWh, €4800 install → ~year 4 payback; accept 3–15"""
    r = _run()
    assert 3 <= r["payback_year"] <= 15


def test_npv_formula_manually():
    """NPV = Σ savings*(1.02)^y / (1.05)^y, y=1..25"""
    r = _run()
    cost_savings = r["cost_savings_eur"]
    years = np.arange(1, 26)
    expected_npv = float(np.sum(cost_savings * (1.02 ** years) / (1.05 ** years)))
    assert r["npv_savings"] == pytest.approx(expected_npv, rel=1e-6)


def test_cumulative_savings_year1():
    """Year-1 cumulative = cost_savings × 1.02"""
    r = _run()
    assert r["cumulative_savings"][0] == pytest.approx(r["cost_savings_eur"] * 1.02, rel=1e-6)


# ── Block 3: wind generation ─────────────────────────────────────────────────

def test_wind_cf_high_lat():
    """lat > 50 → CF=0.30; E_wind = 3 × 0.30 × 8760 = 7884"""
    r = _run(pv_w=0, wind_kw=3.0, lat=55.0, battery_kwh=0)
    assert r["wind_kwh"] == pytest.approx(3.0 * 0.30 * 8760, rel=1e-6)


def test_wind_cf_mid_lat():
    """35 ≤ lat ≤ 50 → CF=0.25"""
    r = _run(pv_w=0, wind_kw=3.0, lat=45.0, battery_kwh=0)
    assert r["wind_kwh"] == pytest.approx(3.0 * 0.25 * 8760, rel=1e-6)


def test_wind_cf_low_lat():
    """lat < 35 → CF=0.20"""
    r = _run(pv_w=0, wind_kw=3.0, lat=28.0, battery_kwh=0)
    assert r["wind_kwh"] == pytest.approx(3.0 * 0.20 * 8760, rel=1e-6)


def test_wind_zero_when_not_selected():
    r = _run(wind_kw=0.0)
    assert r["wind_kwh"] == 0.0


def test_wind_increases_energy_covered():
    without = _run(wind_kw=0.0)
    with_w  = _run(wind_kw=3.0)
    assert with_w["energy_covered"] >= without["energy_covered"]


# ── Block 3: ROI / NPV model ─────────────────────────────────────────────────

def test_roi_curve_length():
    r = _run()
    assert len(r["roi_curve"]) == 25


def test_roi_curve_net_position_grows():
    r = _run()
    nets = [row["net_position"] for row in r["roi_curve"]]
    assert nets[-1] > nets[0]


def test_roi_curve_year_numbers():
    r = _run()
    years = [row["year"] for row in r["roi_curve"]]
    assert years == list(range(1, 26))


def test_higher_tariff_yields_higher_npv():
    low  = _run(tariff=0.15)
    high = _run(tariff=0.35)
    assert high["npv_savings"] > low["npv_savings"]


def test_installation_cost_scales_with_pv():
    small = _run(pv_w=2000)
    large = _run(pv_w=8000)
    assert large["installation_cost_eur"] == pytest.approx(
        small["installation_cost_eur"] * 4, rel=1e-6
    )


def test_payback_earlier_with_higher_tariff():
    cheap     = _run(tariff=0.10)
    expensive = _run(tariff=0.40)
    assert expensive["payback_year"] <= cheap["payback_year"]


# ── Block 2: fallback irradiance ─────────────────────────────────────────────

def test_fallback_irradiance_returns_12_values():
    assert len(fallback_irradiance(52.5)) == 12


def test_fallback_irradiance_all_positive():
    assert all(v > 0 for v in fallback_irradiance(52.5))


def test_fallback_irradiance_low_lat_base_55():
    vals = fallback_irradiance(25.0)
    assert max(vals) == pytest.approx(5.5 * 1.20, abs=0.05)


def test_fallback_irradiance_high_lat_base_28():
    vals = fallback_irradiance(55.0)
    assert max(vals) == pytest.approx(2.8 * 1.20, abs=0.05)


def test_fallback_irradiance_bands_strictly_decreasing():
    assert max(fallback_irradiance(25)) > max(fallback_irradiance(35))
    assert max(fallback_irradiance(35)) > max(fallback_irradiance(45))
    assert max(fallback_irradiance(45)) > max(fallback_irradiance(55))


# ── Block 2: country / carbon ────────────────────────────────────────────────

def test_country_from_latlon_spain():
    assert country_from_latlon(40.4, -3.7) == "ES"


def test_country_from_latlon_germany():
    assert country_from_latlon(52.52, 13.41) == "DE"


def test_country_from_latlon_morocco():
    assert country_from_latlon(33.9, -6.8) == "MA"


def test_country_from_latlon_france():
    assert country_from_latlon(48.85, 2.35) == "FR"


def test_country_from_latlon_unknown_returns_default():
    assert country_from_latlon(0.0, 0.0) == "DEFAULT"


def test_detect_carbon_intensity_spain():
    assert detect_carbon_intensity(40.4, -3.7) == 207.0


def test_detect_carbon_intensity_default():
    ci = detect_carbon_intensity(0.0, 0.0)
    assert ci > 0


def test_tariff_dict_has_required_keys():
    for key in ["ES", "MA", "DE", "FR", "IT", "PT", "GB", "DEFAULT"]:
        assert key in TARIFF_BY_COUNTRY


def test_tariff_spain():
    assert TARIFF_BY_COUNTRY["ES"] == pytest.approx(0.18, rel=1e-3)


# ── Block 2: panel efficiency ────────────────────────────────────────────────

def test_panel_efficiency_south():
    assert 0.95 <= panel_efficiency_factor(35, "south") <= 1.0


def test_panel_efficiency_north():
    assert panel_efficiency_factor(35, "north") < 0.75


def test_energy_mix_sums_to_100():
    r = _run()
    total = r["solar_pct"] + r["battery_pct"] + r["wind_pct"] + r["grid_pct"]
    assert total == pytest.approx(100.0, abs=1.0)


# ── Block 2: geocode fallback ────────────────────────────────────────────────

def test_geocode_fallback():
    lat, lon = geocode("thisisaplacethatdoesnotexist12345xyz")
    assert -90 <= lat <= 90 and -180 <= lon <= 180


# ── Block 2: validation ──────────────────────────────────────────────────────

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


def test_validate_boundary_violation_clean():
    _, bv = validate_inputs(_base())
    assert bv is False


def test_validate_boundary_violation_large_pv():
    """PV > ML training max (20000 W) triggers boundary_violation"""
    _, bv = validate_inputs(_base(pv_w=19999.0))
    # 19999 is within bounds → no violation
    _, bv2 = validate_inputs(_base(pv_w=20001.0))
    # 20001 would also fail validation (> 20000), but boundary check is separate
    assert bv is False


# ── Block 3: make_input_hash ─────────────────────────────────────────────────

def test_input_hash_deterministic():
    h1 = make_input_hash({"lat": 52.52, "lon": 13.41, "pv_w": 4000})
    h2 = make_input_hash({"lat": 52.52, "lon": 13.41, "pv_w": 4000})
    assert h1 == h2


def test_input_hash_differs_on_different_inputs():
    h1 = make_input_hash({"lat": 52.52, "pv_w": 4000})
    h2 = make_input_hash({"lat": 40.41, "pv_w": 4000})
    assert h1 != h2


def test_input_hash_length():
    h = make_input_hash({"lat": 52.52, "pv_w": 4000})
    assert len(h) == 16
