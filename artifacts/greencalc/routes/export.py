"""
Block 7: PDF Export — 8-page ReportLab report.
POST /export/pdf   {"calculation_id": "<uuid>"}
GET  /export/pdf/<int:calc_id>   (backward-compat, used by results.html)
"""
import io
import json
from datetime import datetime

from flask import Blueprint, request, jsonify, make_response, abort, current_app
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, String, Line

export_bp = Blueprint("export", __name__)

# ── Palette ────────────────────────────────────────────────────────────────────
GC_GREEN   = colors.HexColor("#2D6A4F")   # brand dark green (header, table headers)
GC_EMERALD = colors.HexColor("#10b981")   # mid-green (lines, accents)
GC_LIGHT   = colors.HexColor("#d1fae5")   # very light green (row backgrounds)
GC_DARK    = colors.HexColor("#1f2937")   # near-black body text
GC_AMBER   = colors.HexColor("#f59e0b")   # amber (net-position line)
GC_RED     = colors.HexColor("#ef4444")   # red (break-even marker)
GC_GRAY    = colors.HexColor("#e5e7eb")   # grid lines / separators
GC_MGRAY   = colors.HexColor("#9ca3af")   # muted labels
GC_WARN_BG = colors.HexColor("#fef3c7")   # amber-tint warning background
GC_WARN_FG = colors.HexColor("#92400e")   # amber-tint warning text
WHITE      = colors.white

W, H = A4   # 595.28 × 841.89 pts

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun",
          "Jul","Aug","Sep","Oct","Nov","Dec"]

# ── Canvas callbacks ───────────────────────────────────────────────────────────

def _draw_footer(canvas, model_version, report_date):
    canvas.setFont("Helvetica", 6.5)
    canvas.setFillColor(GC_MGRAY)
    txt = (
        f"AI-assisted estimate  |  Not financial advice  |  "
        f"Model v{model_version}  |  GreenCalc  |  {report_date}"
    )
    canvas.drawCentredString(W / 2, 1.1 * cm, txt)
    canvas.setStrokeColor(GC_GRAY)
    canvas.setLineWidth(0.4)
    canvas.line(2 * cm, 1.45 * cm, W - 2 * cm, 1.45 * cm)


def _draw_cover_header(canvas):
    canvas.setFillColor(GC_GREEN)
    canvas.rect(0, H - 3.6 * cm, W, 3.6 * cm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 19)
    canvas.setFillColor(WHITE)
    canvas.drawCentredString(W / 2, H - 1.7 * cm, "Renewable Energy Assessment Report")
    canvas.setFont("Helvetica", 10)
    canvas.setFillColor(colors.HexColor("#bbf7d0"))
    canvas.drawCentredString(W / 2, H - 2.6 * cm, "Powered by GreenCalc  |  AI-assisted estimate")


def _draw_section_header(canvas, title, page_num):
    canvas.setFillColor(colors.HexColor("#f0fdf4"))
    canvas.rect(0, H - 1.4 * cm, W, 1.4 * cm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(GC_GREEN)
    canvas.drawString(2 * cm, H - 0.85 * cm, title)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GC_MGRAY)
    canvas.drawRightString(W - 2 * cm, H - 0.85 * cm, f"Page {page_num}")


_PAGE_TITLES = {
    1: "",
    2: "Executive Summary",
    3: "System Details",
    4: "25-Year ROI Chart",
    5: "Monthly Generation Chart",
    6: "AI Explanation",
    7: "Carbon Tracking",
    8: "Grants & Subsidies",
}


def _make_page_callback(model_version, report_date):
    def _cb(canvas, doc):
        canvas.saveState()
        pn = doc.page
        _draw_footer(canvas, model_version, report_date)
        if pn == 1:
            _draw_cover_header(canvas)
        else:
            title = _PAGE_TITLES.get(pn, f"Section {pn}")
            _draw_section_header(canvas, title, pn)
        canvas.restoreState()
    return _cb


# ── Chart drawings ─────────────────────────────────────────────────────────────

def _roi_drawing(roi_curve, width=445, height=160):
    """Line chart: cumulative savings + net position + break-even marker."""
    d = Drawing(width, height)
    if not roi_curve:
        return d

    years      = [r["year"] for r in roi_curve]
    cumulative = [r["cumulative_savings"] for r in roi_curve]
    net        = [r["net_position"] for r in roi_curve]

    ml, mr, mb, mt = 58, 12, 30, 18
    pw = width - ml - mr
    ph = height - mb - mt

    min_v = min(min(net), 0)
    max_v = max(max(cumulative), 1)
    vr    = max_v - min_v or 1

    def xc(yr):
        return ml + (yr - 1) / max(len(years) - 1, 1) * pw

    def yc(v):
        return mb + ((v - min_v) / vr) * ph

    # Grid lines
    for frac in [0.25, 0.5, 0.75, 1.0]:
        y_g = mb + frac * ph
        d.add(Line(ml, y_g, ml + pw, y_g, strokeColor=GC_GRAY,
                   strokeWidth=0.4, strokeDashArray=[3, 3]))

    # Zero line
    y0 = yc(0)
    d.add(Line(ml, y0, ml + pw, y0, strokeColor=GC_MGRAY,
               strokeWidth=0.6, strokeDashArray=[4, 2]))

    # Axes
    d.add(Line(ml, mb, ml, mb + ph, strokeColor=GC_GRAY, strokeWidth=0.8))
    d.add(Line(ml, mb, ml + pw, mb, strokeColor=GC_GRAY, strokeWidth=0.8))

    # Cumulative savings (green)
    for i in range(len(years) - 1):
        d.add(Line(xc(years[i]),   yc(cumulative[i]),
                   xc(years[i+1]), yc(cumulative[i+1]),
                   strokeColor=GC_EMERALD, strokeWidth=2.2))

    # Net position (amber)
    for i in range(len(years) - 1):
        d.add(Line(xc(years[i]),   yc(net[i]),
                   xc(years[i+1]), yc(net[i+1]),
                   strokeColor=GC_AMBER, strokeWidth=1.5))

    # Break-even vertical marker
    for r in roi_curve:
        if r["net_position"] >= 0:
            bx = xc(r["year"])
            d.add(Line(bx, mb, bx, mb + ph, strokeColor=GC_RED,
                       strokeWidth=1.0, strokeDashArray=[5, 3]))
            d.add(String(bx + 3, mb + ph - 10, f"Break-even yr {r['year']}",
                         fontSize=7, fillColor=GC_RED))
            break

    # X-axis labels
    for yr in [1, 5, 10, 15, 20, 25]:
        if yr <= max(years):
            xp = xc(yr)
            d.add(Line(xp, mb, xp, mb - 3, strokeColor=GC_GRAY, strokeWidth=0.5))
            d.add(String(xp, mb - 13, str(yr), fontSize=7,
                         fillColor=GC_MGRAY, textAnchor="middle"))

    # Y-axis labels
    n_ticks = 5
    for i in range(n_ticks + 1):
        v  = min_v + (vr * i / n_ticks)
        yp = yc(v)
        d.add(String(ml - 4, yp - 3, f"€{v:,.0f}", fontSize=6,
                     fillColor=GC_MGRAY, textAnchor="end"))

    # Legend
    lx, ly = ml, mb + ph + 4
    d.add(Rect(lx, ly, 10, 5, fillColor=GC_EMERALD, strokeColor=None))
    d.add(String(lx + 13, ly, "Cumulative savings", fontSize=7, fillColor=GC_DARK))
    d.add(Rect(lx + 100, ly, 10, 5, fillColor=GC_AMBER, strokeColor=None))
    d.add(String(lx + 113, ly, "Net position", fontSize=7, fillColor=GC_DARK))
    d.add(Line(lx + 180, ly + 2, lx + 190, ly + 2, strokeColor=GC_RED,
               strokeWidth=1.2, strokeDashArray=[4, 2]))
    d.add(String(lx + 193, ly, "Break-even", fontSize=7, fillColor=GC_RED))

    return d


def _monthly_bar_drawing(monthly_data, annual_kwh, width=445, height=165):
    """Grouped bar chart: solar generation vs avg monthly consumption."""
    d = Drawing(width, height)
    if not monthly_data:
        return d

    n             = len(monthly_data)
    ml, mr, mb, mt = 48, 8, 32, 20
    pw = width - ml - mr
    ph = height - mb - mt

    monthly_cons = annual_kwh / 12
    solar_vals   = [row["solar_kwh"] for row in monthly_data]
    batt_vals    = [row["battery_kwh"] for row in monthly_data]
    max_v        = max(max(sv + bv for sv, bv in zip(solar_vals, batt_vals)),
                       monthly_cons, 1)

    group_w = pw / n
    bar_w   = group_w * 0.32
    gap     = group_w * 0.08

    # Grid
    for frac in [0.25, 0.5, 0.75, 1.0]:
        yg = mb + frac * ph
        d.add(Line(ml, yg, ml + pw, yg, strokeColor=GC_GRAY,
                   strokeWidth=0.3, strokeDashArray=[3, 3]))

    # Consumption reference line
    ycons = mb + (monthly_cons / max_v) * ph
    d.add(Line(ml, ycons, ml + pw, ycons, strokeColor=GC_AMBER,
               strokeWidth=1.0, strokeDashArray=[6, 3]))

    for i, row in enumerate(monthly_data):
        gx = ml + i * group_w + gap

        # Solar bar (green)
        sv = row["solar_kwh"]
        sh = (sv / max_v) * ph
        d.add(Rect(gx, mb, bar_w, sh, fillColor=GC_EMERALD, strokeColor=None))

        # Battery bar (lighter green, stacked on solar)
        bv = row["battery_kwh"]
        bh = (bv / max_v) * ph
        d.add(Rect(gx, mb + sh, bar_w, bh,
                   fillColor=colors.HexColor("#6ee7b7"), strokeColor=None))

        # Month label
        d.add(String(gx + bar_w / 2, mb - 13, MONTHS[i], fontSize=7,
                     fillColor=GC_MGRAY, textAnchor="middle"))

    # Axes
    d.add(Line(ml, mb, ml, mb + ph, strokeColor=GC_GRAY, strokeWidth=0.8))
    d.add(Line(ml, mb, ml + pw, mb, strokeColor=GC_GRAY, strokeWidth=0.8))

    # Y-axis labels
    for i in range(6):
        v  = (max_v * i) / 5
        yp = mb + (v / max_v) * ph
        d.add(String(ml - 4, yp - 3, f"{v:.0f}", fontSize=6,
                     fillColor=GC_MGRAY, textAnchor="end"))

    # Legend
    lx, ly = ml, mb + ph + 5
    d.add(Rect(lx, ly, 9, 6, fillColor=GC_EMERALD, strokeColor=None))
    d.add(String(lx + 12, ly, "Direct solar (kWh)", fontSize=7, fillColor=GC_DARK))
    d.add(Rect(lx + 100, ly, 9, 6,
               fillColor=colors.HexColor("#6ee7b7"), strokeColor=None))
    d.add(String(lx + 112, ly, "Battery discharge (kWh)", fontSize=7, fillColor=GC_DARK))
    d.add(Line(lx + 230, ly + 3, lx + 242, ly + 3, strokeColor=GC_AMBER,
               strokeWidth=1.2, strokeDashArray=[5, 3]))
    d.add(String(lx + 245, ly, f"Avg consumption ({monthly_cons:.0f} kWh)", fontSize=7, fillColor=GC_DARK))

    return d


# ── Style helpers ──────────────────────────────────────────────────────────────

def _make_styles():
    base = getSampleStyleSheet()

    def s(name, **kw):
        parent = kw.pop("parent", base["Normal"])
        return ParagraphStyle(name, parent=parent, **kw)

    return {
        "h1":     s("gcH1", fontSize=13, textColor=GC_GREEN, spaceBefore=6,
                    spaceAfter=5, fontName="Helvetica-Bold", leading=16),
        "h2":     s("gcH2", fontSize=10, textColor=GC_GREEN, spaceBefore=5,
                    spaceAfter=4, fontName="Helvetica-Bold", leading=13),
        "body":   s("gcBody", fontSize=9, textColor=GC_DARK, spaceAfter=3, leading=13),
        "small":  s("gcSmall", fontSize=7.5, textColor=colors.HexColor("#6b7280"),
                    spaceAfter=2, leading=10),
        "center": s("gcCenter", fontSize=9, textColor=GC_DARK, alignment=TA_CENTER),
        "legend": s("gcLegend", fontSize=7, textColor=GC_MGRAY, alignment=TA_CENTER),
        "warn":   s("gcWarn", fontSize=8.5, textColor=GC_WARN_FG, backColor=GC_WARN_BG,
                    borderPad=6, leading=12, spaceAfter=4),
        "note":   s("gcNote", fontSize=8, textColor=GC_WARN_FG, backColor=GC_WARN_BG,
                    borderPad=6, leading=12, spaceBefore=4, spaceAfter=4),
        "intro":  s("gcIntro", fontSize=9, textColor=colors.HexColor("#374151"),
                    leading=14, spaceAfter=6),
    }


def _green_table(data, col_widths, fontsize=9):
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, 0), GC_GREEN),
        ("TEXTCOLOR",      (0, 0), (-1, 0), WHITE),
        ("FONTNAME",       (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",       (0, 0), (-1, -1), fontsize),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [GC_LIGHT, WHITE]),
        ("GRID",           (0, 0), (-1, -1), 0.4, GC_GRAY),
        ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",     (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 5),
    ]))
    return t


# ── Main PDF builder ───────────────────────────────────────────────────────────

def _build_pdf(
    calc,
    monthly_data,
    roi_curve,
    pv_top_features,
    pv_explanation,
    pv_model_version,
    pv_recommended=None,
    pv_ci_lower=None,
    pv_ci_upper=None,
):
    buf = io.BytesIO()
    report_date = datetime.utcnow().strftime("%Y-%m-%d")
    st = _make_styles()
    PB = PageBreak

    loc_str  = calc.location or "Unknown"
    lat_str  = f"{calc.lat:.4f}°" if calc.lat else "—"
    lon_str  = f"{calc.lon:.4f}°" if calc.lon else "—"
    npv_val  = calc.npv_savings or calc.net_25yr or 0
    co2_t    = calc.co2_reduced_tonnes or 0
    pv_size  = pv_recommended or int(calc.pv_w or 0)

    elems = []

    # ── PAGE 1: Cover ───────────────────────────────────────────────────────────
    # Top spacer clears the 3.6cm green header bar drawn on the canvas
    elems.append(Spacer(1, 4.0 * cm))

    cover_data = [
        ["Report ID",     calc.calc_uuid or str(calc.id)],
        ["Location",      loc_str],
        ["Coordinates",   f"Lat {lat_str}   Lon {lon_str}"],
        ["Generated",     datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
        ["Model Version", pv_model_version],
    ]
    t_cover = Table(cover_data, colWidths=[5 * cm, 11.5 * cm])
    t_cover.setStyle(TableStyle([
        ("FONTSIZE",       (0, 0), (-1, -1), 9),
        ("FONTNAME",       (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR",      (0, 0), (0, -1), GC_GREEN),
        ("GRID",           (0, 0), (-1, -1), 0.4, GC_GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [GC_LIGHT, WHITE]),
        ("TOPPADDING",     (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 6),
    ]))
    elems.append(t_cover)
    elems.append(Spacer(1, 0.8 * cm))
    elems.append(Paragraph(
        "This report was generated using the GreenCalc renewable energy assessment platform. "
        "Figures are AI-assisted estimates based on NASA POWER irradiance data and a "
        "Gradient Boosting Regressor model trained on 2,000 synthetic residential solar "
        "installations across Spain, Morocco, and the EU (lat 28°–60°).",
        st["intro"],
    ))
    elems.append(Paragraph(
        "⚠️  This report is for informational purposes only. Consult a certified energy "
        "professional before making investment decisions.",
        st["warn"],
    ))
    elems.append(PB())

    # ── PAGE 2: Executive Summary ───────────────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    exec_data = [["Metric", "Value", "Notes"]]
    exec_data += [
        ["Recommended PV System",
         f"{pv_size:,} W",
         f"Battery: {calc.battery_kwh:.1f} kWh"],
        ["Annual Energy Savings",
         f"{calc.annual_saved_kwh:,.1f} kWh",
         "Solar + battery vs. grid"],
        ["Annual Cost Savings",
         f"\u20ac{calc.annual_savings_eur:,.2f}",
         f"Tariff: \u20ac{calc.tariff:.3f}/kWh"],
        ["CO\u2082 Emissions Reduced",
         f"{co2_t:.3f} t/year",
         f"({co2_t * 1000:.0f} kg/year)"],
        ["Payback Period",
         f"{calc.payback_years:.1f} years",
         "With 2% inflation"],
        ["Net Present Value (25yr)",
         f"\u20ac{npv_val:,.0f}",
         "5% discount rate, 2% inflation"],
        ["Installation Cost",
         f"\u20ac{(calc.installation_cost or 0):,.0f}",
         "Estimated"],
    ]
    if pv_ci_lower is not None and pv_ci_upper is not None:
        exec_data.append([
            "Confidence Interval",
            f"[{int(pv_ci_lower):,}\u2013{int(pv_ci_upper):,} W]",
            "10th\u201390th percentile (GBR)",
        ])
    exec_data.append(["Model Version", pv_model_version, "GradientBoostingRegressor"])

    elems.append(_green_table(exec_data, [6 * cm, 5 * cm, 5.5 * cm]))
    elems.append(PB())

    # ── PAGE 3: System Details ──────────────────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    inputs_data = [["Parameter", "Value"]]
    inputs_data += [
        ["Location",              loc_str],
        ["Country ISO",           calc.country_iso or "\u2014"],
        ["Coordinates (stored)",  f"Lat {lat_str}, Lon {lon_str}"],
        ["Annual Consumption",    f"{calc.annual_kwh:,.0f} kWh/year"],
        ["PV System Size (input)",f"{int(calc.pv_w):,} W"],
        ["Battery Capacity",      f"{calc.battery_kwh:.1f} kWh"],
        ["Battery Efficiency",    f"{calc.efficiency:.0f}%"],
        ["Wind Turbine",          f"{calc.wind_kw:.2f} kW" if calc.wind_kw else "None"],
        ["Panel Tilt",            f"{calc.tilt:.0f}\u00b0"],
        ["Orientation",           (calc.orientation or "south").capitalize()],
        ["Performance Ratio",     f"{calc.performance_ratio:.2f}"],
        ["Roof Area",             f"{calc.roof_area:.0f} m\u00b2" if calc.roof_area else "\u2014"],
        ["Occupants",             str(calc.num_occupants) if calc.num_occupants else "\u2014"],
        ["Energy Tariff",         f"\u20ac{calc.tariff:.4f}/kWh"],
        ["Installation Cost",     f"\u20ac{(calc.installation_cost or 0):,.0f}"],
        ["Renewable Type",        calc.renewable_type or "solar"],
        ["NASA Data Source",      calc.nasa_source or "nasa"],
        ["Boundary Violation",
         "\u26a0\ufe0f Yes \u2014 physics fallback applied" if calc.boundary_violation
         else "\u2713 No"],
    ]
    elems.append(_green_table(inputs_data, [8 * cm, 8.5 * cm], fontsize=8.5))
    elems.append(PB())

    # ── PAGE 4: 25-Year ROI Chart ───────────────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    elems.append(Paragraph("25-Year Return on Investment", st["h1"]))
    elems.append(Paragraph(
        f"Cumulative savings with 2% annual energy price inflation and 5% NPV discount rate. "
        f"Installation cost: \u20ac{(calc.installation_cost or 0):,.0f}.",
        st["body"],
    ))
    elems.append(Spacer(1, 0.25 * cm))
    elems.append(_roi_drawing(roi_curve, width=445, height=165))
    elems.append(Paragraph(
        "Green line: cumulative savings (\u20ac)  \u2014  "
        "Amber line: net position (savings minus install cost)  \u2014  "
        "Red dashed: break-even point",
        st["legend"],
    ))
    elems.append(Spacer(1, 0.5 * cm))

    # Milestone table
    yr_milestones = [["Year 5", "Year 10", "Year 15", "Year 20", "Year 25 (NPV)"]]
    if len(roi_curve) >= 25:
        yr_milestones.append([
            f"\u20ac{roi_curve[4]['cumulative_savings']:,.0f}",
            f"\u20ac{roi_curve[9]['cumulative_savings']:,.0f}",
            f"\u20ac{roi_curve[14]['cumulative_savings']:,.0f}",
            f"\u20ac{roi_curve[19]['cumulative_savings']:,.0f}",
            f"\u20ac{npv_val:,.0f}",
        ])
    else:
        yr_milestones.append(["\u2014"] * 4 + [f"\u20ac{npv_val:,.0f}"])
    elems.append(_green_table(yr_milestones, [3.3 * cm] * 5))
    elems.append(PB())

    # ── PAGE 5: Monthly Generation Chart ───────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    elems.append(Paragraph("Monthly Solar Generation vs. Consumption", st["h1"]))
    elems.append(Paragraph(
        f"12-month breakdown. Average monthly consumption: "
        f"{calc.annual_kwh / 12:.0f} kWh. "
        f"Total annual solar generation: {calc.solar_kwh:,.0f} kWh.",
        st["body"],
    ))
    elems.append(Spacer(1, 0.25 * cm))
    elems.append(_monthly_bar_drawing(monthly_data, calc.annual_kwh,
                                      width=445, height=165))
    elems.append(Spacer(1, 0.25 * cm))

    # Monthly table
    month_hdr = ["Month", "Solar (kWh)", "Battery (kWh)", "Grid (kWh)",
                 "Saved (kWh)", "Savings (\u20ac)"]
    month_rows = [month_hdr]
    for row in monthly_data:
        month_rows.append([
            row["month"],
            f"{row['solar_kwh']:.1f}",
            f"{row['battery_kwh']:.1f}",
            f"{row['grid_kwh']:.1f}",
            f"{row['saved_kwh']:.1f}",
            f"\u20ac{row['saved_kwh'] * (calc.tariff or 0.20):.2f}",
        ])
    t_m = Table(month_rows, colWidths=[2 * cm, 3 * cm, 3 * cm, 3 * cm, 3 * cm, 2.5 * cm])
    t_m.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, 0), GC_GREEN),
        ("TEXTCOLOR",      (0, 0), (-1, 0), WHITE),
        ("FONTNAME",       (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",       (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [GC_LIGHT, WHITE]),
        ("GRID",           (0, 0), (-1, -1), 0.4, GC_GRAY),
        ("ALIGN",          (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",     (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 4),
    ]))
    elems.append(t_m)
    elems.append(PB())

    # ── PAGE 6: AI Explanation ──────────────────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    elems.append(Paragraph("AI Explanation & Model Transparency", st["h1"]))

    elems.append(Paragraph("Top 3 Influential Factors (SHAP Analysis)", st["h2"]))
    if pv_top_features:
        shap_data = [["Feature", "Impact (25yr scale)", "Direction"]]
        for tf in pv_top_features:
            sym = "\u2191 Positive" if tf.get("direction") == "positive" else "\u2193 Negative"
            shap_data.append([
                tf.get("feature", "\u2014"),
                tf.get("impact", "\u2014"),
                sym,
            ])
        elems.append(_green_table(shap_data, [7 * cm, 5 * cm, 4.5 * cm]))
    else:
        elems.append(Paragraph(
            "SHAP analysis unavailable \u2014 physics fallback was used.", st["body"]))

    elems.append(Spacer(1, 0.3 * cm))
    elems.append(Paragraph("Plain-Language Explanation", st["h2"]))
    elems.append(Paragraph(pv_explanation or "No AI explanation available.", st["body"]))

    elems.append(Spacer(1, 0.3 * cm))
    elems.append(Paragraph("Confidence Interval Explanation", st["h2"]))
    if pv_ci_lower is not None and pv_ci_upper is not None:
        ci_text = (
            f"The model provides a 10th\u201390th percentile confidence interval of "
            f"[{int(pv_ci_lower):,}\u2013{int(pv_ci_upper):,} W] for the recommended PV system. "
            f"This means that for installations with similar characteristics in this region, "
            f"90\u202f% of optimal system sizes fall within this range. "
            f"The central estimate of {pv_size:,} W represents the median (50th percentile) prediction."
        )
    else:
        ci_text = (
            "Confidence interval not available for this calculation. "
            "The recommended system size is a point estimate based on the physics model."
        )
    elems.append(Paragraph(ci_text, st["body"]))

    elems.append(Spacer(1, 0.5 * cm))
    elems.append(Paragraph(
        "EU AI Act Disclaimer \u2014 Limited Risk System (Article 50)", st["h2"]))
    elems.append(Paragraph(
        f"This report was generated with AI assistance. "
        f"All figures are estimates. Model version: {pv_model_version}. "
        f"Consult a certified energy professional before making investment decisions.",
        ParagraphStyle(
            "gcAIDisclaim",
            parent=ParagraphStyle("x", parent=getSampleStyleSheet()["Normal"]),
            fontSize=9, textColor=GC_WARN_FG,
            backColor=GC_WARN_BG, borderPad=8, leading=14, spaceAfter=4,
        ),
    ))
    elems.append(Paragraph(
        "GreenCalc is classified as a Limited Risk AI system under the EU AI Act. "
        "Transparency obligations (Article 50) apply. This page fulfils that obligation.",
        st["small"],
    ))
    elems.append(PB())

    # ── PAGE 7: Carbon Tracking ─────────────────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    elems.append(Paragraph("Carbon Impact Assessment", st["h1"]))

    comp_mg      = calc.computation_co2_mg or 0.0
    comp_g       = comp_mg / 1000          # mg → g
    comp_kg      = comp_g  / 1000          # g  → kg
    saved_t      = co2_t                   # tonnes/year
    saved_kg     = saved_t * 1000          # kg/year
    net_kg       = saved_kg - comp_kg
    car_km       = comp_kg / 0.210 if comp_kg > 0 else 0
    ratio        = net_kg / max(comp_kg, 1e-12)

    carbon_data = [["Metric", "Value", "Unit"]]
    carbon_data += [
        ["CO\u2082 emitted by this calculation",
         f"{comp_g:.6f}", "grams  (CodeCarbon)"],
        ["CO\u2082 saved annually by recommended system",
         f"{saved_t:.4f}", "tonnes/year"],
        ["CO\u2082 saved annually",
         f"{saved_kg:,.1f}", "kg/year"],
        ["Net benefit  (saved \u2212 emitted)",
         f"{net_kg:,.2f}", "kg/year"],
        ["Car equivalent  (computation only)",
         f"{car_km:.4f}", "km NOT driven"],
        ["Net benefit ratio",
         f"{ratio:,.0f}\u00d7", "kg saved per kg emitted"],
    ]
    elems.append(_green_table(carbon_data, [8 * cm, 4.5 * cm, 4 * cm]))
    elems.append(Spacer(1, 0.4 * cm))
    elems.append(Paragraph(
        f"By installing this {pv_size:,}\u2009W solar system you avoid "
        f"{saved_kg:,.0f}\u2009kg of CO\u2082 every year \u2014 equivalent to taking "
        f"approximately {saved_kg / 120:.0f} cars off the road for a year. "
        f"The computational carbon cost of generating this report was {comp_g:.6f}\u2009g CO\u2082 "
        f"\u2014 more than {ratio:,.0f}\u00d7 less than the annual benefit.",
        st["body"],
    ))
    elems.append(PB())

    # ── PAGE 8: Grants & Subsidies ──────────────────────────────────────────────
    elems.append(Spacer(1, 1.6 * cm))
    elems.append(Paragraph("Grants & Subsidies", st["h1"]))
    elems.append(Paragraph(
        "The following grant and subsidy programmes may be available depending on your location. "
        "Availability, amounts, and eligibility criteria change frequently.",
        st["body"],
    ))
    elems.append(Spacer(1, 0.3 * cm))

    elems.append(Paragraph("\U0001f1ea\U0001f1f8  Spain", st["h2"]))
    spain_data = [
        ["Programme", "Description", "URL"],
        ["IDAE",
         "Instituto para la Diversificaci\u00f3n y Ahorro de la Energ\u00eda \u2014 "
         "national energy efficiency grants and subsidies for residential solar installations.",
         "www.idae.es"],
        ["Next Generation EU",
         "Plan de Recuperaci\u00f3n, Transformaci\u00f3n y Resiliencia \u2014 "
         "EU recovery funds channelled through Spain for renewable energy installations.",
         "ec.europa.eu"],
        ["Regional incentives",
         "Comunidades Aut\u00f3nomas (Andaluc\u00eda, Catalu\u00f1a, Madrid, Valencia, etc.) "
         "offer regional subsidies, IBI tax reductions, and simplified permitting.",
         "Regional gov."],
    ]
    t_spain = Table(spain_data, colWidths=[4 * cm, 9.5 * cm, 3 * cm])
    t_spain.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), GC_GREEN),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [GC_LIGHT, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, GC_GRAY),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elems.append(t_spain)
    elems.append(Spacer(1, 0.4 * cm))

    elems.append(Paragraph("\U0001f1f2\U0001f1e6  Morocco", st["h2"]))
    morocco_data = [
        ["Programme", "Description", "URL"],
        ["AMEE",
         "Agence Marocaine pour l\u2019Efficacit\u00e9 \u00c9nerg\u00e9tique \u2014 "
         "national agency providing technical support, certification, and funding programmes "
         "for energy efficiency and renewable energy projects.",
         "www.amee.ma"],
        ["MASEN",
         "Moroccan Agency for Sustainable Energy \u2014 "
         "coordinates large-scale and residential renewable energy deployment, "
         "net-metering regulations, and co-financing schemes.",
         "www.masen.ma"],
    ]
    t_morocco = Table(morocco_data, colWidths=[4 * cm, 9.5 * cm, 3 * cm])
    t_morocco.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), GC_GREEN),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [GC_LIGHT, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, GC_GRAY),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elems.append(t_morocco)

    elems.append(Spacer(1, 0.5 * cm))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=GC_GRAY))
    elems.append(Paragraph(
        "\u26a0\ufe0f  Verify current availability at official sources. "
        "Incentive programmes change frequently. "
        f"Information accurate at time of report generation ({report_date}).",
        st["note"],
    ))

    # ── Assemble document ────────────────────────────────────────────────────────
    cb = _make_page_callback(pv_model_version, report_date)
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
    )
    doc.build(elems, onFirstPage=cb, onLaterPages=cb)
    buf.seek(0)
    return buf


# ── Shared helper ──────────────────────────────────────────────────────────────

def _pdf_response_for_calc(calc):
    from models.energy_model import (
        fetch_nasa_power, fallback_irradiance, calculate_energy,
        detect_carbon_intensity, compute_roi_curve,
    )
    from models.ml_model import pv_model

    lat = calc.lat or 52.52
    lon = calc.lon or 13.405

    # NASA irradiance
    try:
        nasa = fetch_nasa_power(lat, lon)
        irr  = nasa["irradiance"]
    except Exception:
        irr = fallback_irradiance(lat)

    # Monthly generation data
    ci_g   = detect_carbon_intensity(lat, lon)
    result = calculate_energy(
        irr_monthly=irr,
        pv_w=calc.pv_w or 4000,
        battery_kwh=calc.battery_kwh or 10,
        battery_efficiency=calc.efficiency or 90,
        performance_ratio=calc.performance_ratio or 0.75,
        annual_kwh=calc.annual_kwh or 5000,
        tariff=calc.tariff or 0.20,
        lat=lat,
        wind_kw=calc.wind_kw or 0.0,
        carbon_intensity_g_per_kwh=ci_g,
    )
    monthly_data = result["monthly_data"]

    # ROI curve
    roi_curve = compute_roi_curve(
        annual_savings_eur=calc.annual_savings_eur or result["annual_savings_eur"],
        installation_cost_eur=calc.installation_cost or result["installation_cost_eur"],
    )

    # PV model: SHAP + CI
    pv_top_features  = []
    pv_explanation   = "AI explanation unavailable."
    pv_model_version = "fallback"
    pv_recommended   = None
    pv_ci_lower      = None
    pv_ci_upper      = None

    try:
        pv_model.ensure_ready()
        avg_irr   = sum(irr) / 12
        avg_temp  = max(-10.0, 25.0 - (lat - 28) * 0.5)
        num_occ   = calc.num_occupants or 3
        tariff    = calc.tariff or 0.20

        (main_w, lo_w, hi_w) = pv_model.predict_pv(
            month=6, latitude=lat, irradiance=avg_irr,
            avg_temp=avg_temp, household_size=num_occ,
            consumption_kwh=calc.annual_kwh or 5000,
        )
        pv_recommended   = int(round(main_w))
        pv_ci_lower      = round(lo_w)
        pv_ci_upper      = round(hi_w)
        pv_model_version = pv_model.model_version

        # Fix #3 (path b — physics-honest): no spurious SHAP attribution in the
        # PDF either — state the real physics drivers instead.
        pv_top_features = []
        pv_explanation = (
            f"Sized to cover {calc.annual_kwh or 5000:,.0f} kWh/year given "
            f"{avg_irr:.1f} kWh/m²/day of local solar resource "
            f"(physics-based estimate)."
        )
    except Exception as exc:
        current_app.logger.warning("PDF: PV model failed: %s", exc)

    buf = _build_pdf(
        calc, monthly_data, roi_curve,
        pv_top_features, pv_explanation, pv_model_version,
        pv_recommended=pv_recommended,
        pv_ci_lower=pv_ci_lower,
        pv_ci_upper=pv_ci_upper,
    )

    safe_loc = (calc.location or "report").replace(" ", "_").replace(",", "")
    filename  = f"greencalc_{safe_loc}_{calc.calc_uuid or calc.id}.pdf"

    resp = make_response(buf.read())
    resp.headers["Content-Type"]           = "application/pdf"
    resp.headers["Content-Disposition"]    = f'attachment; filename="{filename}"'
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Cache-Control"]          = "no-store"
    return resp


# ── Routes ─────────────────────────────────────────────────────────────────────

@export_bp.route("/export/pdf", methods=["POST"])
def export_pdf():
    """POST /export/pdf  body: {"calculation_id": "<uuid>"}"""
    from extensions import db
    from models.db_models import Calculation

    data      = request.get_json(silent=True) or {}
    calc_uuid = data.get("calculation_id") or data.get("calc_uuid")
    if not calc_uuid:
        return jsonify({"error": "calculation_id is required"}), 400

    calc = db.session.execute(
        db.select(Calculation).where(Calculation.calc_uuid == str(calc_uuid))
    ).scalars().first()
    if not calc:
        return jsonify({"error": "Calculation not found"}), 404

    try:
        return _pdf_response_for_calc(calc)
    except Exception as exc:
        current_app.logger.error("PDF export error: %s", exc, exc_info=True)
        return jsonify({"error": "PDF generation failed", "detail": str(exc)}), 500


@export_bp.route("/export/pdf/<int:calc_id>")
def export_pdf_by_id(calc_id):
    """GET /export/pdf/<int:calc_id>  — backward compat used by results.html."""
    from extensions import db
    from models.db_models import Calculation

    calc = db.session.get(Calculation, calc_id)
    if not calc:
        abort(404)

    try:
        return _pdf_response_for_calc(calc)
    except Exception as exc:
        current_app.logger.error("PDF export error (by id): %s", exc, exc_info=True)
        abort(500)
