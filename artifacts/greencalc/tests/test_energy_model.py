import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.energy_model import (
    simulate_8760,
    compute_roi_curve,
    compute_payback_years,
    fallback_irradiance,
    panel_efficiency_factor,
)


def _default_irr():
    return [3.5, 4.0, 5.0, 5.5, 6.0, 6.5, 6.5, 6.0, 5.0, 4.0, 3.0, 2.8]


def _default_temp():
    return [2.0, 3.5, 8.0, 13.0, 17.0, 21.0, 23.0, 22.0, 17.0, 12.0, 6.0, 3.0]


def test_simulate_8760_returns_nonzero_savings():
    result = simulate_8760(
        annual_kwh=5000,
        pv_w=4000,
        battery_kwh=10,
        efficiency=90,
        panel_factor=1.0,
        irr_monthly=_default_irr(),
        temp_monthly=_default_temp(),
    )
    assert result["total_saved_kwh"] > 0, "Expected non-zero savings"
    assert result["total_solar_kwh"] > 0, "Expected non-zero solar generation"
    assert len(result["monthly_data"]) == 12


def test_battery_soc_within_bounds():
    battery_kwh = 10.0
    result = simulate_8760(
        annual_kwh=5000,
        pv_w=4000,
        battery_kwh=battery_kwh,
        efficiency=90,
        panel_factor=1.0,
        irr_monthly=_default_irr(),
        temp_monthly=_default_temp(),
    )
    assert result["min_soc"] >= -0.001, f"SOC went below 0: {result['min_soc']}"
    assert result["max_soc"] <= battery_kwh + 0.001, f"SOC exceeded battery_kwh: {result['max_soc']}"


def test_roi_curve_payback():
    annual_savings = 1500.0
    installation_cost = 8000.0
    payback = compute_payback_years(annual_savings, installation_cost)
    assert payback < 25, f"Expected payback < 25 years, got {payback}"
    assert payback > 0, f"Expected payback > 0, got {payback}"


def test_roi_curve_length():
    curve = compute_roi_curve(1500, 8000, years=25)
    assert len(curve) == 25
    assert curve[-1]["cumulative_savings"] > curve[0]["cumulative_savings"]


def test_geocode_fallback():
    irr = fallback_irradiance(52.5)
    assert len(irr) == 12, f"Expected 12 monthly values, got {len(irr)}"
    assert all(v > 0 for v in irr), "All irradiance values should be positive"


def test_panel_efficiency_south():
    factor = panel_efficiency_factor(35, "south")
    assert 0.95 <= factor <= 1.0, f"South-facing at 35° should be near optimal: {factor}"


def test_panel_efficiency_north():
    factor = panel_efficiency_factor(35, "north")
    assert factor < 0.75, f"North-facing should have lower efficiency: {factor}"


def test_energy_mix_sums_to_100():
    result = simulate_8760(
        annual_kwh=5000,
        pv_w=4000,
        battery_kwh=10,
        efficiency=90,
        panel_factor=1.0,
        irr_monthly=_default_irr(),
        temp_monthly=_default_temp(),
    )
    total = result["solar_pct"] + result["battery_pct"] + result["grid_pct"]
    assert abs(total - 100.0) < 2.0, f"Energy mix should sum to ~100%, got {total}"
