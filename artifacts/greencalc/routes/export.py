import io
from flask import Blueprint, send_file, abort, current_app
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart

export_bp = Blueprint("export", __name__)

GREEN = colors.HexColor("#10b981")
DARK = colors.HexColor("#1f2937")
LIGHT_GREEN = colors.HexColor("#f0fdf4")
AMBER = colors.HexColor("#f59e0b")
GRAY = colors.HexColor("#e5e7eb")


def _shap_chart_drawing(shap_vals: dict, width: float = 400, height: float = 120) -> Drawing:
    """Build a horizontal bar SHAP chart as a ReportLab Drawing."""
    d = Drawing(width, height)
    features = list(shap_vals.keys())
    values = [abs(v) for v in shap_vals.values()]
    max_val = max(values) if values else 1
    bar_height = 16
    spacing = 24
    label_w = 100
    bar_area = width - label_w - 60

    for i, (feat, val) in enumerate(zip(features, values)):
        y = height - (i + 1) * spacing + 4
        bar_w = (val / max_val) * bar_area if max_val > 0 else 0
        d.add(String(label_w - 5, y + 3, feat, fontSize=9,
                     fillColor=colors.HexColor("#4b5563"), textAnchor="end"))
        d.add(Rect(label_w, y, bar_w, bar_height,
                   fillColor=GREEN, strokeColor=None))
        d.add(String(label_w + bar_w + 4, y + 3, f"{val:.4f}",
                     fontSize=8, fillColor=colors.HexColor("#6b7280")))
    return d


def _roi_chart_drawing(roi_curve: list[dict], width: float = 400, height: float = 140) -> Drawing:
    """Build a simple ROI line chart as a ReportLab Drawing."""
    d = Drawing(width, height)
    if not roi_curve:
        return d

    years = [r["year"] for r in roi_curve]
    net_positions = [r["net_position"] for r in roi_curve]
    cumulative = [r["cumulative_savings"] for r in roi_curve]

    min_val = min(min(net_positions), 0)
    max_val = max(max(cumulative), 1)
    val_range = max_val - min_val or 1

    margin_l, margin_r, margin_b, margin_t = 55, 15, 20, 10
    plot_w = width - margin_l - margin_r
    plot_h = height - margin_b - margin_t

    zero_y = margin_b + (-min_val / val_range) * plot_h

    def x_coord(yr):
        return margin_l + (yr - 1) / (max(years) - 1) * plot_w if len(years) > 1 else margin_l

    def y_coord(val):
        return margin_b + ((val - min_val) / val_range) * plot_h

    d.add(Line(margin_l, margin_b, margin_l, margin_b + plot_h,
               strokeColor=GRAY, strokeWidth=1))
    d.add(Line(margin_l, zero_y, margin_l + plot_w, zero_y,
               strokeColor=GRAY, strokeWidth=0.5, strokeDashArray=[3, 3]))

    for i in range(len(years) - 1):
        d.add(Line(x_coord(years[i]), y_coord(cumulative[i]),
                   x_coord(years[i+1]), y_coord(cumulative[i+1]),
                   strokeColor=GREEN, strokeWidth=2))
        d.add(Line(x_coord(years[i]), y_coord(net_positions[i]),
                   x_coord(years[i+1]), y_coord(net_positions[i+1]),
                   strokeColor=AMBER, strokeWidth=1.5))

    for yr in [1, 5, 10, 15, 20, 25]:
        if yr in years:
            xp = x_coord(yr)
            d.add(String(xp, margin_b - 12, str(yr), fontSize=7,
                         fillColor=colors.HexColor("#9ca3af"), textAnchor="middle"))

    d.add(String(2, margin_b + plot_h * 0.75, f"€{max_val:,.0f}",
                 fontSize=7, fillColor=colors.HexColor("#9ca3af")))
    d.add(String(2, margin_b + plot_h * 0.25, f"€{(min_val + (max_val - min_val) * 0.25):,.0f}",
                 fontSize=7, fillColor=colors.HexColor("#9ca3af")))
    return d


def _make_pdf(calc):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("gcTitle", parent=styles["Title"], fontSize=20,
                                 textColor=DARK, alignment=TA_CENTER, spaceAfter=4)
    subtitle_style = ParagraphStyle("gcSubtitle", parent=styles["Normal"], fontSize=10,
                                    textColor=colors.HexColor("#6b7280"), alignment=TA_CENTER, spaceAfter=12)
    h2_style = ParagraphStyle("gcH2", parent=styles["Heading2"], fontSize=12,
                               textColor=GREEN, spaceBefore=10, spaceAfter=5)
    body_style = ParagraphStyle("gcBody", parent=styles["Normal"], fontSize=9,
                                textColor=DARK, spaceAfter=4)

    elems = []

    elems.append(Paragraph("GreenCalc Solar Report", title_style))
    elems.append(Paragraph(f"Location: {calc.location}", subtitle_style))
    elems.append(HRFlowable(width="100%", thickness=2, color=GREEN, spaceAfter=10))

    # Summary card
    elems.append(Paragraph("Summary", h2_style))
    summary_data = [
        ["Metric", "Value"],
        ["Annual Energy Saved", f"{calc.annual_saved_kwh:,.1f} kWh"],
        ["Annual Savings", f"\u20ac{calc.annual_savings_eur:,.2f}"],
        ["CO\u2082 Reduction", f"{calc.co2_kg:,.1f} kg/year"],
        ["Payback Period", f"{calc.payback_years:.1f} years"],
        ["25-Year Net Gain", f"\u20ac{calc.net_25yr:,.0f}"],
        ["Installation Cost", f"\u20ac{calc.installation_cost:,.0f}"],
        ["Energy Tariff", f"\u20ac{calc.tariff:.3f}/kWh"],
        ["PV Size / Battery", f"{calc.pv_w:,.0f} W / {calc.battery_kwh:.1f} kWh"],
        ["Energy Mix", f"Solar {calc.solar_pct}% | Battery {calc.battery_pct}% | Grid {calc.grid_pct}%"],
    ]
    t = Table(summary_data, colWidths=[8*cm, 8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GREEN, colors.white]),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 0.4*cm))

    # ROI Curve chart
    elems.append(Paragraph("25-Year ROI Curve", h2_style))
    from models.energy_model import compute_roi_curve
    roi = compute_roi_curve(calc.annual_savings_eur, calc.installation_cost)
    roi_drawing = _roi_chart_drawing(roi, width=430, height=130)
    elems.append(roi_drawing)
    elems.append(Paragraph(
        "\u2014 Green: cumulative savings    \u2014\u2014 Amber: net position (savings minus installation cost)",
        ParagraphStyle("gcLegend", parent=styles["Normal"], fontSize=7,
                       textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER)
    ))
    elems.append(Spacer(1, 0.4*cm))

    # Monthly breakdown table
    elems.append(Paragraph("Monthly Energy Breakdown", h2_style))
    from extensions import db
    from models.db_models import Calculation
    monthly_header = ["Month", "Solar (kWh)", "Battery (kWh)", "Grid (kWh)", "Saved (kWh)", "Savings (\u20ac)"]
    monthly_rows = [monthly_header]

    # Recompute monthly from the stored data using the simulation
    from models.energy_model import (
        geocode, fetch_nasa_power, panel_efficiency_factor, simulate_8760,
        estimate_installation_cost
    )
    try:
        nasa = fetch_nasa_power(calc.lat or 52.52, calc.lon or 13.405)
        pf = panel_efficiency_factor(calc.tilt, calc.orientation)
        sim = simulate_8760(
            calc.annual_kwh, calc.pv_w, calc.battery_kwh,
            calc.efficiency, pf,
            nasa["irradiance"], nasa["temperature"]
        )
        for row in sim["monthly_data"]:
            monthly_rows.append([
                row["month"],
                f"{row['solar_kwh']:.1f}",
                f"{row['battery_kwh']:.1f}",
                f"{row['grid_kwh']:.1f}",
                f"{row['saved_kwh']:.1f}",
                f"\u20ac{row['saved_kwh'] * calc.tariff:.2f}",
            ])
    except Exception:
        monthly_rows.append(["N/A", "-", "-", "-", "-", "-"])

    col_ws = [2*cm, 3*cm, 3*cm, 3*cm, 3*cm, 3*cm]
    t_m = Table(monthly_rows, colWidths=col_ws)
    t_m.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GREEN, colors.white]),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(t_m)
    elems.append(Spacer(1, 0.4*cm))

    # SHAP Feature Importance chart
    elems.append(Paragraph("AI Model — SHAP Feature Importance", h2_style))
    elems.append(Paragraph(
        "SHAP (SHapley Additive exPlanations) values showing which input features most influence "
        "the ML consumption prediction. Wider bars = greater impact on the model output.",
        body_style
    ))
    from models.ml_model import ml_model
    shap_vals = ml_model.explain(6, 12, 5.0, 15.0)
    shap_drawing = _shap_chart_drawing(shap_vals, width=380, height=110)
    elems.append(shap_drawing)
    elems.append(Spacer(1, 0.4*cm))

    # Footer
    elems.append(HRFlowable(width="100%", thickness=1, color=GRAY))
    elems.append(Paragraph(
        f"Computation carbon footprint: {calc.computation_co2_mg:.4f} mg CO\u2082 (CodeCarbon)\n"
        "Generated by GreenCalc \u2014 AI-Powered Green Energy Calculator | EU AI Act Compliant",
        ParagraphStyle("gcFooter", parent=styles["Normal"], fontSize=7,
                       textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER, spaceBefore=6)
    ))

    doc.build(elems)
    buf.seek(0)
    return buf


@export_bp.route("/export/pdf/<int:calc_id>")
def export_pdf(calc_id):
    from extensions import db
    from models.db_models import Calculation
    calc = db.session.get(Calculation, calc_id)
    if not calc:
        abort(404)
    try:
        buf = _make_pdf(calc)
        filename = f"greencalc_{calc.location.replace(' ', '_').replace(',', '')}_{calc_id}.pdf"
        return send_file(buf, mimetype="application/pdf",
                         as_attachment=True, download_name=filename)
    except Exception as e:
        current_app.logger.error(f"PDF export error: {e}", exc_info=True)
        abort(500)
