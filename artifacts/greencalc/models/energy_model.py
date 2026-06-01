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

MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
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


def country_from_latlon(lat: float, lon: float) -> str:
    """Return ISO 2-letter country code from lat/lon using bounding boxes. No external API."""
    for iso, (lat_min, lat_max, lon_min, lon_max) in _COUNTRY_BOXES.items():
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return iso
    return "DEFAULT"


def fallback_irradiance(lat: float) -> list[float]:
    """Return 12 monthly irradiance values by latitude band."""
    abs_lat = abs(lat)
    if abs_lat < 30:
        base = 5.5
    elif abs_lat < 40:
        base = 5.0
    elif abs_lat < 50:
        base = 3.8
    else:
        base = 2.8
    seasonal = [0.60, 0.70, 0.85, 1.00, 1.10, 1.20, 1.20, 1.10, 0.95, 0.80, 0.65, 0.55]
    return [round(base * s, 3) for s in seasonal]


def fetch_nasa_power(lat: float, lon: float) -> dict:
    """Fetch 12 monthly irradiance + temperature values from NASA POWER API.
    
    Returns {"irradiance": [12 floats], "temperature": [12 floats], "source": "nasa"|"fallback"}.
    Logs WARNING and uses lat-band fallback on any failure.
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
        irr = fallback_irradiance(lat)
        return {"irradiance": irr, "temperature": [15.0] * 12, "source": "fallback"}


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


def _wind_generation_hourly(wind_kw: float) -> np.ndarray:
    """Simple wind power model: monthly seasonal + diurnal variation."""
    # Typical monthly average wind speeds (m/s) for mid-latitudes
    wind_speed_monthly = np.array([8.0, 7.5, 7.0, 6.0, 5.5, 5.0, 4.8, 5.2, 6.0, 7.0, 7.5, 8.0])
    wind_hourly_base = np.repeat(wind_speed_monthly, [d * 24 for d in MONTH_DAYS])
    hours_of_day = np.arange(8760) % 24
    # Wind tends to be higher during daytime
    time_factor = 1.0 + 0.15 * np.sin(2 * np.pi * (hours_of_day - 6) / 24)
    wind_speed = wind_hourly_base * time_factor

    # Simplified power curve: cut-in 3 m/s, rated at 12 m/s, cut-out 25 m/s
    cut_in, rated, cut_out = 3.0, 12.0, 25.0
    power_ratio = np.where(
        wind_speed < cut_in, 0.0,
        np.where(
            wind_speed > cut_out, 0.0,
            np.clip((wind_speed - cut_in) / (rated - cut_in), 0.0, 1.0) ** 2,
        ),
    )
    return wind_kw * power_ratio  # kWh per hour


def simulate_8760(
    annual_kwh: float,
    pv_w: float,
    battery_kwh: float,
    efficiency: float,
    panel_factor: float,
    irr_monthly: list[float],
    temp_monthly: list[float],
    performance_ratio: float = 0.75,
    wind_kw: float = 0.0,
) -> dict:
    """NumPy-vectorized 8760-hour solar+wind+battery simulation."""
    eff = efficiency / 100.0
    pv_kw = pv_w / 1000.0
    hourly_consumption = annual_kwh / 8760.0

    irr_hourly = np.repeat(np.array(irr_monthly), [d * 24 for d in MONTH_DAYS])
    temp_hourly = np.repeat(np.array(temp_monthly), [d * 24 for d in MONTH_DAYS])
    hours_of_day = np.arange(8760) % 24

    # Solar generation
    sun_angle = np.where(
        (hours_of_day >= 6) & (hours_of_day <= 18),
        np.sin(np.pi * (hours_of_day - 6) / 12),
        0.0,
    )
    sun_angle = np.clip(sun_angle, 0.0, None)
    temp_derate = 1.0 - 0.004 * np.maximum(0.0, temp_hourly - 25.0)
    solar_gen = pv_kw * irr_hourly * panel_factor * performance_ratio * temp_derate / 5.5 * sun_angle

    # Wind generation (0 if no wind turbine)
    wind_gen = _wind_generation_hourly(wind_kw) if wind_kw > 0 else np.zeros(8760)

    gen = solar_gen + wind_gen

    # Load profile
    load = hourly_consumption * (0.8 + 0.4 * np.sin(np.pi * (hours_of_day - 6) / 12))

    net = gen - load

    # Sequential battery SoC simulation
    soc = battery_kwh * 0.5
    soc_arr = np.empty(8760)
    solar_used_arr = np.empty(8760)
    wind_used_arr = np.empty(8760)
    battery_used_arr = np.empty(8760)
    grid_used_arr = np.empty(8760)

    for h in range(8760):
        n = net[h]
        s_gen = solar_gen[h]
        w_gen = wind_gen[h]
        total_gen = s_gen + w_gen
        if n >= 0:
            charge = min(n * eff, battery_kwh - soc)
            soc = min(battery_kwh, soc + charge)
            ratio_s = s_gen / total_gen if total_gen > 0 else 1.0
            solar_used_arr[h] = load[h] * ratio_s
            wind_used_arr[h] = load[h] * (1.0 - ratio_s)
            battery_used_arr[h] = 0.0
            grid_used_arr[h] = 0.0
        else:
            deficit = -n
            discharge = min(deficit, soc * eff)
            soc = max(0.0, soc - (discharge / eff if eff > 0 else discharge))
            battery_used = min(discharge, deficit)
            grid_used = max(0.0, deficit - battery_used)
            ratio_s = s_gen / total_gen if total_gen > 0 else 1.0
            solar_used_arr[h] = s_gen
            wind_used_arr[h] = w_gen
            battery_used_arr[h] = battery_used
            grid_used_arr[h] = grid_used
        soc_arr[h] = soc

    hour_boundaries = np.concatenate([[0], np.cumsum([d * 24 for d in MONTH_DAYS])])
    monthly_data = []
    for m in range(12):
        s, e = int(hour_boundaries[m]), int(hour_boundaries[m + 1])
        monthly_data.append({
            "month": MONTH_NAMES[m],
            "solar_kwh": round(float(solar_used_arr[s:e].sum()), 1),
            "wind_kwh": round(float(wind_used_arr[s:e].sum()), 1),
            "battery_kwh": round(float(battery_used_arr[s:e].sum()), 1),
            "grid_kwh": round(float(grid_used_arr[s:e].sum()), 1),
            "saved_kwh": round(float((solar_used_arr[s:e] + wind_used_arr[s:e] + battery_used_arr[s:e]).sum()), 1),
        })

    total_solar = float(solar_used_arr.sum())
    total_wind = float(wind_used_arr.sum())
    total_battery = float(battery_used_arr.sum())
    total_grid = float(grid_used_arr.sum())
    total_saved = float((solar_used_arr + wind_used_arr + battery_used_arr).sum())
    total_consumed = max(1.0, annual_kwh)

    solar_pct = round(100 * total_solar / total_consumed, 1)
    wind_pct = round(100 * total_wind / total_consumed, 1)
    battery_pct = round(100 * total_battery / total_consumed, 1)
    grid_pct = round(max(0.0, 100 - solar_pct - wind_pct - battery_pct), 1)

    return {
        "monthly_data": monthly_data,
        "total_solar_kwh": round(total_solar, 1),
        "total_wind_kwh": round(total_wind, 1),
        "total_battery_kwh": round(total_battery, 1),
        "total_grid_kwh": round(total_grid, 1),
        "total_saved_kwh": round(total_saved, 1),
        "solar_pct": solar_pct,
        "wind_pct": wind_pct,
        "battery_pct": battery_pct,
        "grid_pct": grid_pct,
        "min_soc": round(float(soc_arr.min()), 3),
        "max_soc": round(float(soc_arr.max()), 3),
    }


def compute_roi_curve(
    annual_savings_eur: float,
    installation_cost_eur: float,
    years: int = 25,
    inflation: float = 0.015,
) -> list[dict]:
    curve = []
    cumulative = 0.0
    for y in range(1, years + 1):
        savings_y = annual_savings_eur * ((1 + inflation) ** (y - 1))
        cumulative += savings_y
        net = cumulative - installation_cost_eur
        curve.append({
            "year": y,
            "cumulative_savings": round(cumulative, 2),
            "net_position": round(net, 2),
        })
    return curve


def compute_payback_years(
    annual_savings_eur: float,
    installation_cost_eur: float,
    inflation: float = 0.015,
) -> float:
    if annual_savings_eur <= 0:
        return 99.0
    cumulative = 0.0
    for y in range(1, 26):
        year_savings = annual_savings_eur * ((1 + inflation) ** (y - 1))
        if cumulative + year_savings >= installation_cost_eur:
            frac = (installation_cost_eur - cumulative) / year_savings
            return round(y - 1 + frac, 1)
        cumulative += year_savings
    return 99.0


def detect_carbon_intensity(lat: float, lon: float) -> float:
    """Return gCO₂/kWh for the country at lat/lon using bounding box lookup."""
    iso = country_from_latlon(lat, lon)
    return float(CARBON_BY_ISO.get(iso, CARBON_BY_ISO.get("DEFAULT", 400)))


def estimate_installation_cost(pv_w: float, battery_kwh: float, wind_kw: float = 0.0) -> float:
    return (pv_w / 1000.0) * 900 + battery_kwh * 500 + wind_kw * 1200 + 1200


def validate_inputs(data: dict) -> tuple[list[dict], bool]:
    """Validate all calculator inputs.
    
    Returns (errors, boundary_violation).
    errors is a list of {"error": str, "field": str}; empty list = valid.
    boundary_violation = True if inputs are outside ML training distribution.
    """
    errors: list[dict] = []
    boundary_violation = False

    def err(field: str, msg: str):
        errors.append({"error": msg, "field": field})

    # Coordinates
    lat = data.get("lat")
    lon = data.get("lon")
    if lat is None or lon is None:
        err("lat", "Location coordinates are required — click the map or enter manually.")
    else:
        if not (-90 <= lat <= 90):
            err("lat", f"Latitude must be between -90 and 90 (got {lat}).")
        if not (-180 <= lon <= 180):
            err("lon", f"Longitude must be between -180 and 180 (got {lon}).")

    # Annual kWh
    annual_kwh = data.get("annual_kwh", 0)
    if not (500 <= annual_kwh <= 50000):
        err("annual_kwh", f"Annual energy usage must be 500–50,000 kWh (got {annual_kwh:.0f}).")
    if not (ML_TRAINING_BOUNDS["annual_kwh"][0] <= annual_kwh <= ML_TRAINING_BOUNDS["annual_kwh"][1]):
        boundary_violation = True

    # Tariff
    tariff = data.get("tariff", 0)
    if not (0.01 <= tariff <= 2.00):
        err("tariff", f"Electricity tariff must be 0.01–2.00 €/kWh (got {tariff}).")

    # Renewable type
    renewable_types = data.get("renewable_type", [])
    if not renewable_types:
        err("renewable_type", "Select at least one renewable energy type.")

    # PV wattage
    pv_w = data.get("pv_w", 0)
    if "solar" in renewable_types or "hybrid" in renewable_types:
        if not (100 <= pv_w <= 20000):
            err("pv_w", f"PV wattage must be 100–20,000 W (got {pv_w:.0f}).")
        roof_area = data.get("roof_area")
        if roof_area and roof_area > 0:
            max_wp = roof_area * 180
            if pv_w > max_wp:
                err("pv_w", f"PV wattage ({pv_w:.0f} W) exceeds roof capacity ({max_wp:.0f} W for {roof_area:.0f} m²).")
    if not (ML_TRAINING_BOUNDS["pv_w"][0] <= pv_w <= ML_TRAINING_BOUNDS["pv_w"][1]):
        boundary_violation = True

    # Wind turbine
    wind_kw = data.get("wind_kw")
    if "wind" in renewable_types or "hybrid" in renewable_types:
        if wind_kw is None:
            err("wind_kw", "Wind turbine capacity is required for wind/hybrid systems.")
        elif not (0.5 <= wind_kw <= 50):
            err("wind_kw", f"Wind turbine capacity must be 0.5–50 kW (got {wind_kw}).")

    # Battery
    battery_kwh = data.get("battery_kwh", 0)
    if not (0 <= battery_kwh <= 100):
        err("battery_kwh", f"Battery capacity must be 0–100 kWh (got {battery_kwh}).")
    if not (ML_TRAINING_BOUNDS["battery_kwh"][0] <= battery_kwh <= ML_TRAINING_BOUNDS["battery_kwh"][1]):
        boundary_violation = True

    # Battery efficiency
    battery_eff = data.get("battery_efficiency", 90)
    if not (50 <= battery_eff <= 99):
        err("battery_efficiency", f"Battery efficiency must be 50–99% (got {battery_eff}).")

    # Performance ratio
    perf_ratio = data.get("performance_ratio", 0.75)
    if not (0.60 <= perf_ratio <= 0.85):
        err("performance_ratio", f"Performance ratio must be 0.60–0.85 (got {perf_ratio}).")

    # Tilt
    tilt = data.get("tilt", 35)
    if not (0 <= tilt <= 90):
        err("tilt", f"Panel tilt must be 0–90° (got {tilt}).")

    return errors, boundary_violation
