"""
GreenCalc energy model — Block 3 physics-based power balance engine.
All computation uses NumPy vectorized operations (no Python for-loops over arrays).
"""
import hashlib
import json
import logging
import math
import os
import requests
import numpy as np

logger = logging.getLogger(__name__)

_CARBON_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "grid_carbon_intensity.json")


def _load_carbon_data() -> dict:
    try:
        with open(_CARBON_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


CARBON_BY_ISO: dict[str, int] = _load_carbon_data()

MONTH_DAYS = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], dtype=np.float64)
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Tariff fallback by country ISO (€/kWh)
TARIFF_BY_COUNTRY: dict[str, float] = {
    "ES": 0.18, "MA": 0.12, "DE": 0.35, "FR": 0.20,
    "IT": 0.25, "PT": 0.22, "GB": 0.28, "DEFAULT": 0.20,
}

# Simple bounding boxes (lat_min, lat_max, lon_min, lon_max) — no external geocoding
_COUNTRY_BOXES: dict[str, tuple[float, float, float, float]] = {
    "PT": (36.9, 42.2, -9.5, -6.2),
    "ES": (36.0, 43.8, -9.3, 4.3),
    "MA": (27.7, 35.9, -13.2, -0.9),
    "FR": (41.3, 51.1, -5.1, 9.6),
    "GB": (49.9, 61.0, -8.2, 1.8),
    "DE": (47.3, 55.1, 6.0, 15.0),
    "NL": (50.7, 53.6, 3.3, 7.3),
    "BE": (49.5, 51.5, 2.5, 6.4),
    "CH": (45.8, 47.8, 5.9, 10.5),
    "AT": (46.4, 49.0, 9.5, 17.2),
    "IT": (36.6, 47.1, 6.6, 18.5),
    "DK": (54.6, 57.8, 8.1, 15.2),
    "SE": (55.3, 69.1, 11.1, 24.2),
    "NO": (57.9, 71.2, 4.5, 31.1),
    "PL": (49.0, 54.9, 14.1, 24.1),
    "CZ": (48.6, 51.1, 12.1, 18.9),
    "GR": (35.0, 41.8, 19.4, 28.3),
    "TR": (36.0, 42.1, 26.0, 44.8),
    "DZ": (19.0, 37.1, -8.7, 12.0),
    "TN": (30.2, 37.5, 7.5, 11.6),
    "EG": (22.0, 31.7, 24.7, 37.1),
    "US": (25.0, 49.0, -125.0, -67.0),
    "CA": (42.0, 83.0, -141.0, -52.6),
    "MX": (14.5, 32.7, -117.1, -86.7),
    "BR": (-33.7, 5.3, -73.9, -34.8),
    "AR": (-55.1, -21.8, -73.6, -53.6),
    "ZA": (-34.8, -22.1, 16.5, 32.9),
    "IN": (8.1, 37.1, 68.1, 97.4),
    "CN": (18.2, 53.6, 73.5, 134.8),
    "JP": (24.4, 45.6, 122.9, 145.8),
    "KR": (33.1, 38.6, 124.6, 129.6),
    "AU": (-43.7, -10.7, 113.3, 153.6),
}

# ML training distribution bounds — flag boundary_violation if outside these
ML_TRAINING_BOUNDS: dict[str, tuple[float, float]] = {
    "annual_kwh": (500.0, 50000.0),
    "pv_w": (100.0, 20000.0),
    "battery_kwh": (0.0, 100.0),
    "battery_efficiency": (50.0, 99.0),
    "wind_kw": (0.5, 50.0),
    "irradiance": (1.0, 8.0),
    "temperature": (-20.0, 45.0),
}


# ── Location helpers ─────────────────────────────────────────────────────────

def country_from_latlon(lat: float, lon: float) -> str:
    """Return ISO 2-letter country code using bounding boxes. No external API."""
    for iso, (lat_min, lat_max, lon_min, lon_max) in _COUNTRY_BOXES.items():
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return iso
    return "DEFAULT"


def detect_carbon_intensity(lat: float, lon: float) -> float:
    """Return gCO₂/kWh for the country at lat/lon using bounding box lookup."""
    iso = country_from_latlon(lat, lon)
    return float(CARBON_BY_ISO.get(iso, CARBON_BY_ISO.get("DEFAULT", 400)))


def fallback_irradiance(lat: float) -> list[float]:
    """Return 12 monthly irradiance values (kWh/m²/day) by latitude band."""
    abs_lat = abs(lat)
    if abs_lat < 30:
        base = 5.5
    elif abs_lat < 40:
        base = 5.0
    elif abs_lat < 50:
        base = 3.8
    else:
        base = 2.8
    seasonal = np.array([0.60, 0.70, 0.85, 1.00, 1.10, 1.20,
                         1.20, 1.10, 0.95, 0.80, 0.65, 0.55])
    return [round(float(v), 3) for v in (base * seasonal)]


def fetch_nasa_power(lat: float, lon: float) -> dict:
    """Fetch 12 monthly irradiance + temperature values from NASA POWER API.

    Returns {"irradiance": [12 floats], "temperature": [12 floats], "source": "nasa"|"fallback"}.
    Logs WARNING on failure.
    """
    from config import NASA_POWER_BASE_URL
    params = {
        "parameters": "ALLSKY_SFC_SW_DWN,T2M",
        "community": "RE",
        "longitude": lon,
        "latitude": lat,
        "start": "2019",
        "end": "2023",
        "format": "JSON",
    }
    try:
        resp = requests.get(NASA_POWER_BASE_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        props = data["properties"]["parameter"]
        irr_raw = props["ALLSKY_SFC_SW_DWN"]
        temp_raw = props["T2M"]

        irr_monthly: list[float] = []
        temp_monthly: list[float] = []
        for m in range(1, 13):
            vals_irr = [v for k, v in irr_raw.items() if k.endswith(f"{m:02d}") and v != -999]
            vals_temp = [v for k, v in temp_raw.items() if k.endswith(f"{m:02d}") and v != -999]
            irr_monthly.append(
                float(np.mean(vals_irr)) if vals_irr else fallback_irradiance(lat)[m - 1]
            )
            temp_monthly.append(float(np.mean(vals_temp)) if vals_temp else 15.0)

        assert len(irr_monthly) == 12 and len(temp_monthly) == 12
        return {"irradiance": irr_monthly, "temperature": temp_monthly, "source": "nasa"}

    except Exception as exc:
        logger.warning(
            "NASA POWER API failure for lat=%.4f lon=%.4f — using fallback irradiance. Error: %s",
            lat, lon, exc,
        )
        return {"irradiance": fallback_irradiance(lat), "temperature": [15.0] * 12, "source": "fallback"}


def geocode(location: str) -> tuple[float, float]:
    headers = {"User-Agent": "GreenCalc/1.0 (greencalc@example.com)"}
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": location, "format": "json", "limit": 1}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=6)
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return 52.52, 13.405


def panel_efficiency_factor(tilt: float, orientation: str) -> float:
    tilt_opt = 35.0
    tilt_factor = 1.0 - 0.0005 * (tilt - tilt_opt) ** 2
    orient_map = {
        "south": 1.0, "south-east": 0.95, "south-west": 0.95,
        "east": 0.85, "west": 0.85, "north": 0.65,
        "north-east": 0.70, "north-west": 0.70,
    }
    orient_factor = orient_map.get(orientation.lower(), 0.90)
    return max(0.5, min(1.0, tilt_factor * orient_factor))


# Fix #5: bounded battery state-of-charge. A battery can never exceed capacity or go
# below empty; energy stored in surplus months is discharged in deficit months.
BATTERY_ROUND_TRIP_EFF = 0.90   # round-trip efficiency, applied on charge (tunable)

def simulate_battery(gen_monthly, cons_monthly, capacity_kwh, eff=BATTERY_ROUND_TRIP_EFF):
    """Single usable-capacity battery over 12 months.
    gen_monthly, cons_monthly: length-12 kWh/month arrays. capacity_kwh: usable kWh."""
    soc = 0.0
    discharge, soc_end, grid_import, grid_export = [], [], [], []
    for g, c in zip(gen_monthly, cons_monthly):
        net = g - c
        if net >= 0:                                  # surplus → charge, spill rest to grid
            room   = capacity_kwh - soc
            stored = min(net * eff, room)
            soc   += stored
            discharge.append(0.0)
            grid_import.append(0.0)
            grid_export.append(net - (stored / eff))  # panel energy not absorbed by battery
        else:                                         # deficit → discharge to cover load
            need  = -net
            drawn = min(soc, need)
            soc  -= drawn
            discharge.append(drawn)
            grid_import.append(need - drawn)
            grid_export.append(0.0)
        soc_end.append(soc)
    return {"discharge": discharge, "soc_end": soc_end,
            "grid_import": grid_import, "grid_export": grid_export}


# ── Block 3: Physics-based power balance engine ──────────────────────────────

def calculate_energy(
    irr_monthly: list[float],
    pv_w: float,
    battery_kwh: float,
    battery_efficiency: float,
    performance_ratio: float,
    annual_kwh: float,
    tariff: float,
    lat: float,
    wind_kw: float = 0.0,
    carbon_intensity_g_per_kwh: float = 400.0,
) -> dict:
    """Fully-vectorized monthly power balance model (NumPy, no Python loops).

    Returns a dict with spec fields (solar_kwh, wind_kwh, energy_covered,
    cost_savings_eur, co2_reduced_tonnes, payback_year, npv_savings,
    installation_cost_eur, cumulative_savings) plus display fields.
    """
    # ── Solar generation (vectorized) ────────────────────────────────────────
    irr_arr = np.maximum(np.array(irr_monthly, dtype=np.float64), 0.0)  # zero-guard
    E_solar_monthly = pv_w * irr_arr * MONTH_DAYS * performance_ratio / 1000.0  # kWh/month
    E_solar_annual = float(np.sum(E_solar_monthly))

    # ── Battery dispatch model (Fix #5: bounded month-by-month SOC) ─────────────────────────
    consumption_monthly = (annual_kwh / 12.0) * np.ones(12, dtype=np.float64)

    # Fix #5: simulate a real bounded battery — SOC capped at usable capacity and
    # floored at empty; surplus stored (round-trip eff) is discharged in later
    # deficit months. Replaces the previous np.cumsum(excess) model, whose "stored"
    # energy grew unbounded across the year.
    battery_sim = simulate_battery(
        E_solar_monthly, consumption_monthly,
        capacity_kwh=battery_kwh, eff=battery_efficiency / 100.0,
    )
    battery_discharge = np.array(battery_sim["discharge"], dtype=np.float64)
    grid_monthly      = np.array(battery_sim["grid_import"], dtype=np.float64)
    grid_export_month = np.array(battery_sim["grid_export"], dtype=np.float64)

    direct_solar  = np.minimum(E_solar_monthly, consumption_monthly)  # solar used on-site directly
    saved_monthly = direct_solar + battery_discharge

    grid_export_kwh = float(np.sum(grid_export_month))
    self_consumption_rate = (
        float((E_solar_annual - grid_export_kwh) / E_solar_annual)
        if E_solar_annual > 0 else 0.0
    )

    # ── Wind generation (vectorized CF by latitude) ──────────────────────────
    E_wind_annual = 0.0
    if wind_kw > 0:
        CF = float(np.where(lat < 35, 0.20, np.where(lat <= 50, 0.25, 0.30)))
        E_wind_annual = wind_kw * CF * 8760.0  # kWh/year

    # ── Annual savings ───────────────────────────────────────────────────────
    total_renewable_kwh = E_solar_annual + E_wind_annual
    energy_covered = min(total_renewable_kwh, annual_kwh)
    cost_savings_eur = energy_covered * tariff
    # co2: energy_covered [kWh] * intensity [g/kWh] / 1_000_000 = tonnes
    # Spec formula: energy_covered * grid_carbon_intensity / 1000
    # → we pass intensity in kg/kWh (g/kWh / 1000), so /1000 gives tonnes ✓
    carbon_intensity_kg = carbon_intensity_g_per_kwh / 1000.0
    co2_reduced_tonnes = energy_covered * carbon_intensity_kg / 1000.0

    # ── 25-year ROI with NPV (discount rate 5%, inflation 2%) ────────────────
    installation_cost_eur = (pv_w / 1000.0) * 1200.0   # €1,200 per kWp (spec)
    inflation_rate = 0.02
    discount_rate = 0.05
    years = np.arange(1, 26, dtype=np.float64)
    annual_savings_inflated = cost_savings_eur * (1.0 + inflation_rate) ** years
    npv_savings = float(np.sum(annual_savings_inflated / (1.0 + discount_rate) ** years))
    cumulative_savings = np.cumsum(annual_savings_inflated)

    mask = cumulative_savings >= installation_cost_eur
    payback_year = int(np.argmax(mask) + 1) if np.any(mask) else 99

    # ── Monthly breakdown (for table + charts) ───────────────────────────────
    monthly_data = [
        {
            "month": MONTH_NAMES[m],
            "solar_kwh": round(float(direct_solar[m]), 1),
            "battery_kwh": round(float(battery_discharge[m]), 1),
            "grid_kwh": round(float(grid_monthly[m]), 1),
            "saved_kwh": round(float(saved_monthly[m]), 1),
        }
        for m in range(12)
    ]

    # ── ROI curve (for chart) ────────────────────────────────────────────────
    roi_curve = [
        {
            "year": int(y),
            "cumulative_savings": round(float(cumulative_savings[i]), 2),
            "net_position": round(float(cumulative_savings[i] - installation_cost_eur), 2),
        }
        for i, y in enumerate(years)
    ]

    # ── Energy mix percentages ───────────────────────────────────────────────
    denom = max(annual_kwh, 1.0)
    solar_pct = round(100.0 * float(np.sum(direct_solar)) / denom, 1)
    battery_pct = round(100.0 * float(np.sum(battery_discharge)) / denom, 1)
    wind_pct = round(100.0 * E_wind_annual / denom, 1)
    grid_pct = round(max(0.0, 100.0 - solar_pct - battery_pct - wind_pct), 1)

    return {
        # ── Spec-required fields ──────────────────────────────────────────────
        "solar_kwh": round(E_solar_annual, 1),
        "wind_kwh": round(E_wind_annual, 1),
        "energy_covered": round(energy_covered, 1),
        "cost_savings_eur": round(cost_savings_eur, 2),
        "co2_reduced_tonnes": round(co2_reduced_tonnes, 6),
        "payback_year": payback_year,
        "npv_savings": round(npv_savings, 2),
        "installation_cost_eur": round(installation_cost_eur, 2),
        "cumulative_savings": cumulative_savings.tolist(),
        # ── Display / template compat fields ──────────────────────────────────
        "monthly_data": monthly_data,
        "roi_curve": roi_curve,
        "total_saved_kwh": round(energy_covered, 1),           # template: annual_saved_kwh
        "annual_savings_eur": round(cost_savings_eur, 2),
        "co2_kg": round(co2_reduced_tonnes * 1000.0, 1),       # tonnes → kg for template
        "net_25yr": round(float(cumulative_savings[-1]) - installation_cost_eur, 2),
        "payback_years": float(payback_year),                   # template compat (float)
        "solar_pct": solar_pct,
        "battery_pct": battery_pct,
        "wind_pct": wind_pct,
        "grid_pct": grid_pct,
        "self_consumption_rate": round(self_consumption_rate, 4),
        "grid_export_kwh": round(grid_export_kwh, 1),
        "E_solar_monthly": E_solar_monthly.tolist(),            # for PDF export
    }


def make_input_hash(data: dict) -> str:
    """Stable SHA-256 of key inputs for deduplication."""
    keys = ["lat", "lon", "pv_w", "wind_kw", "battery_kwh", "annual_kwh",
            "performance_ratio", "tariff", "battery_efficiency"]
    payload = {k: data.get(k) for k in keys}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:16]


# ── Validation ───────────────────────────────────────────────────────────────

def validate_inputs(data: dict) -> tuple[list[dict], bool]:
    """Validate all calculator inputs.

    Returns (errors, boundary_violation).
    errors is a list of {"error": str, "field": str}; empty list = valid.
    """
    errors: list[dict] = []
    boundary_violation = False

    def err(field: str, msg: str):
        errors.append({"error": msg, "field": field})

    lat = data.get("lat")
    lon = data.get("lon")
    if lat is None or lon is None:
        err("lat", "Location coordinates are required — click the map or enter manually.")
    else:
        if not (-90 <= lat <= 90):
            err("lat", f"Latitude must be between -90 and 90 (got {lat}).")
        if not (-180 <= lon <= 180):
            err("lon", f"Longitude must be between -180 and 180 (got {lon}).")

    annual_kwh = data.get("annual_kwh", 0)
    if not (500 <= annual_kwh <= 50000):
        err("annual_kwh", f"Annual energy usage must be 500–50,000 kWh (got {annual_kwh:.0f}).")
    if not (ML_TRAINING_BOUNDS["annual_kwh"][0] <= annual_kwh <= ML_TRAINING_BOUNDS["annual_kwh"][1]):
        boundary_violation = True

    tariff = data.get("tariff", 0)
    if not (0.01 <= tariff <= 2.00):
        err("tariff", f"Electricity tariff must be 0.01–2.00 €/kWh (got {tariff}).")

    renewable_types = data.get("renewable_type", [])
    if not renewable_types:
        err("renewable_type", "Select at least one renewable energy type.")

    pv_w = data.get("pv_w", 0)
    if "solar" in renewable_types or "hybrid" in renewable_types:
        if not (100 <= pv_w <= 20000):
            err("pv_w", f"PV wattage must be 100–20,000 W (got {pv_w:.0f}).")
        roof_area = data.get("roof_area")
        if roof_area and roof_area > 0:
            max_wp = roof_area * 180
            if pv_w > max_wp:
                err("pv_w", f"PV wattage ({pv_w:.0f} W) exceeds roof capacity "
                    f"({max_wp:.0f} W for {roof_area:.0f} m²).")
    if not (ML_TRAINING_BOUNDS["pv_w"][0] <= pv_w <= ML_TRAINING_BOUNDS["pv_w"][1]):
        boundary_violation = True

    wind_kw = data.get("wind_kw")
    if "wind" in renewable_types or "hybrid" in renewable_types:
        if wind_kw is None:
            err("wind_kw", "Wind turbine capacity is required for wind/hybrid systems.")
        elif not (0.5 <= wind_kw <= 50):
            err("wind_kw", f"Wind turbine capacity must be 0.5–50 kW (got {wind_kw}).")

    battery_kwh = data.get("battery_kwh", 0)
    if not (0 <= battery_kwh <= 100):
        err("battery_kwh", f"Battery capacity must be 0–100 kWh (got {battery_kwh}).")
    if not (ML_TRAINING_BOUNDS["battery_kwh"][0] <= battery_kwh <= ML_TRAINING_BOUNDS["battery_kwh"][1]):
        boundary_violation = True

    battery_eff = data.get("battery_efficiency", 90)
    if not (50 <= battery_eff <= 99):
        err("battery_efficiency", f"Battery efficiency must be 50–99% (got {battery_eff}).")

    perf_ratio = data.get("performance_ratio", 0.75)
    if not (0.60 <= perf_ratio <= 0.85):
        err("performance_ratio", f"Performance ratio must be 0.60–0.85 (got {perf_ratio}).")

    tilt = data.get("tilt", 35)
    if not (0 <= tilt <= 90):
        err("tilt", f"Panel tilt must be 0–90° (got {tilt}).")

    return errors, boundary_violation


# ── Legacy helpers (kept for backward compat / PDF export) ───────────────────

def compute_roi_curve(
    annual_savings_eur: float,
    installation_cost_eur: float,
    years: int = 25,
    inflation: float = 0.02,
    discount_rate: float = 0.05,
) -> list[dict]:
    yrs = np.arange(1, years + 1, dtype=np.float64)
    inflated = annual_savings_eur * (1.0 + inflation) ** yrs
    cumulative = np.cumsum(inflated)
    npv_arr = inflated / (1.0 + discount_rate) ** yrs
    return [
        {
            "year": int(y),
            "cumulative_savings": round(float(cumulative[i]), 2),
            "net_position": round(float(cumulative[i] - installation_cost_eur), 2),
            "npv_savings": round(float(np.sum(npv_arr[:i+1])), 2),
        }
        for i, y in enumerate(yrs)
    ]


def compute_payback_years(
    annual_savings_eur: float,
    installation_cost_eur: float,
    inflation: float = 0.02,
) -> float:
    if annual_savings_eur <= 0:
        return 99.0
    yrs = np.arange(1, 26, dtype=np.float64)
    cumulative = np.cumsum(annual_savings_eur * (1.0 + inflation) ** yrs)
    mask = cumulative >= installation_cost_eur
    return float(np.argmax(mask) + 1) if np.any(mask) else 99.0


def estimate_installation_cost(pv_w: float, battery_kwh: float, wind_kw: float = 0.0) -> float:
    return (pv_w / 1000.0) * 900 + battery_kwh * 500 + wind_kw * 1200 + 1200
