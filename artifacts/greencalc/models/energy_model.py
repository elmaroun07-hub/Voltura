import json
import math
import os
import time
import requests
import numpy as np

_CARBON_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "grid_carbon_intensity.json")

def _load_carbon_data():
    try:
        with open(_CARBON_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

CARBON_DATA = _load_carbon_data()

MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


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


def fetch_nasa_power(lat: float, lon: float) -> dict:
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
        data = resp.json()
        props = data["properties"]["parameter"]
        irr_raw = props["ALLSKY_SFC_SW_DWN"]
        temp_raw = props["T2M"]

        irr_monthly = []
        temp_monthly = []
        for m in range(1, 13):
            vals_irr = [v for k, v in irr_raw.items() if k.endswith(f"{m:02d}") and v != -999]
            vals_temp = [v for k, v in temp_raw.items() if k.endswith(f"{m:02d}") and v != -999]
            irr_monthly.append(float(np.mean(vals_irr)) if vals_irr else fallback_irradiance(lat)[m - 1])
            temp_monthly.append(float(np.mean(vals_temp)) if vals_temp else 15.0)
        return {"irradiance": irr_monthly, "temperature": temp_monthly}
    except Exception:
        irr = fallback_irradiance(lat)
        temp = [15.0] * 12
        return {"irradiance": irr, "temperature": temp}


def fallback_irradiance(lat: float) -> list[float]:
    lat_rad = math.radians(abs(lat))
    base = 5.5 - 3.0 * (lat_rad / (math.pi / 2))
    seasonal = [0.6, 0.7, 0.85, 1.0, 1.1, 1.2, 1.2, 1.1, 0.95, 0.8, 0.65, 0.55]
    return [round(base * s, 3) for s in seasonal]


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


def simulate_8760(
    annual_kwh: float,
    pv_w: float,
    battery_kwh: float,
    efficiency: float,
    panel_factor: float,
    irr_monthly: list[float],
    temp_monthly: list[float],
) -> dict:
    eff = efficiency / 100.0
    pv_kw = pv_w / 1000.0

    hours_per_month = [d * 24 for d in MONTH_DAYS]
    hourly_consumption = annual_kwh / 8760.0

    total_solar_kwh = 0.0
    total_battery_kwh = 0.0
    total_grid_kwh = 0.0
    total_saved_kwh = 0.0

    monthly_data = []
    all_soc = []

    hour_idx = 0
    soc = battery_kwh * 0.5

    for m in range(12):
        irr = irr_monthly[m]
        temp = temp_monthly[m]
        temp_derate = 1.0 - 0.004 * max(0, temp - 25)
        peak_gen = pv_kw * irr * panel_factor * temp_derate

        days = MONTH_DAYS[m]
        hours = days * 24

        month_solar = 0.0
        month_battery_used = 0.0
        month_grid = 0.0
        month_saved = 0.0

        for h in range(hours):
            hour_of_day = (hour_idx + h) % 24
            sun_factor = max(0.0, math.sin(math.pi * (hour_of_day - 6) / 12)) if 6 <= hour_of_day <= 18 else 0.0
            gen = peak_gen * sun_factor * (irr / 5.5)

            load = hourly_consumption * (0.8 + 0.4 * math.sin(math.pi * (hour_of_day - 6) / 12))

            net = gen - load
            if net >= 0:
                charge = min(net * eff, battery_kwh - soc)
                soc = min(battery_kwh, soc + charge)
                solar_used = load
                month_solar += solar_used
                month_saved += solar_used
            else:
                deficit = -net
                discharge = min(deficit, soc * eff)
                soc = max(0.0, soc - discharge / eff if eff > 0 else soc - discharge)
                battery_used = min(discharge, deficit)
                grid_used = max(0.0, deficit - battery_used)
                month_solar += gen
                month_battery_used += battery_used
                month_grid += grid_used
                month_saved += gen + battery_used

            all_soc.append(soc)

        hour_idx += hours
        total_solar_kwh += month_solar
        total_battery_kwh += month_battery_used
        total_grid_kwh += month_grid
        total_saved_kwh += month_saved

        monthly_data.append({
            "month": MONTH_NAMES[m],
            "solar_kwh": round(month_solar, 1),
            "battery_kwh": round(month_battery_used, 1),
            "grid_kwh": round(month_grid, 1),
            "saved_kwh": round(month_saved, 1),
        })

    total_consumed = annual_kwh
    solar_pct = round(100 * total_solar_kwh / max(1, total_consumed), 1)
    battery_pct = round(100 * total_battery_kwh / max(1, total_consumed), 1)
    grid_pct = round(max(0, 100 - solar_pct - battery_pct), 1)

    return {
        "monthly_data": monthly_data,
        "total_solar_kwh": round(total_solar_kwh, 1),
        "total_battery_kwh": round(total_battery_kwh, 1),
        "total_grid_kwh": round(total_grid_kwh, 1),
        "total_saved_kwh": round(total_saved_kwh, 1),
        "solar_pct": solar_pct,
        "battery_pct": battery_pct,
        "grid_pct": grid_pct,
        "min_soc": round(min(all_soc), 3),
        "max_soc": round(max(all_soc), 3),
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


def compute_payback_years(annual_savings_eur: float, installation_cost_eur: float, inflation: float = 0.015) -> float:
    if annual_savings_eur <= 0:
        return 99.0
    cumulative = 0.0
    for y in range(1, 26):
        cumulative += annual_savings_eur * ((1 + inflation) ** (y - 1))
        if cumulative >= installation_cost_eur:
            return round(y - 1 + (installation_cost_eur - (cumulative - annual_savings_eur * ((1 + inflation) ** (y - 1)))) / (annual_savings_eur * ((1 + inflation) ** (y - 1))), 1)
    return 99.0


def detect_carbon_intensity(location: str) -> float:
    for country, intensity in CARBON_DATA.items():
        if country.lower() in location.lower() or location.lower() in country.lower():
            return float(intensity)
    return 400.0


def estimate_installation_cost(pv_w: float, battery_kwh: float) -> float:
    return (pv_w / 1000.0) * 900 + battery_kwh * 500 + 1200
