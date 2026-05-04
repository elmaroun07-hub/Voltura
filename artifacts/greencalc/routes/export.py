import io
from flask import Blueprint, send_file, abort, current_app
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

export_bp = Blueprint("export", __name__)

GREEN = colors.HexColor("#10b981")
DARK = colors.HexColor("#1f2937")
LIGHT_GREEN = colors.HexColor("#f0fdf4")


def _make_pdf(calc):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=22,
                                 textColor=DARK, alignment=TA_CENTER, spaceAfter=4)
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=11,
                                    textColor=colors.HexColor("#6b7280"), alignment=TA_CENTER, spaceAfter=16)
    h2_style = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13,
                               textColor=GREEN, spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10,
                                textColor=DARK, spaceAfter=4)

    elems = []

    elems.append(Paragraph("GreenCalc Solar Report", title_style))
    elems.append(Paragraph(f"Location: {calc.location}", subtitle_style))
    elems.append(HRFlowable(width="100%", thickness=2, color=GREEN, spaceAfter=12))

    elems.append(Paragraph("Summary", h2_style))
    summary_data = [
        ["Metric", "Value"],
        ["Annual Energy Saved", f"{calc.annual_saved_kwh:,.1f} kWh"],
        ["Annual Savings", f"\u20ac{calc.annual_savings_eur:,.2f}"],
        ["CO2 Reduction", f"{calc.co2_kg:,.1f} kg/year"],
        ["Payback Period", f"{calc.payback_years:.1f} years"],
        ["25-Year Net Gain", f"\u20ac{calc.net_25yr:,.0f}"],
        ["Installation Cost", f"\u20ac{calc.installation_cost:,.0f}"],
        ["Energy Tariff", f"\u20ac{calc.tariff:.3f}/kWh"],
    ]
    t = Table(summary_data, colWidths=[8*cm, 8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GREEN, colors.white]),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 0.5*cm))

    elems.append(Paragraph("System Configuration", h2_style))
    config_data = [
        ["Parameter", "Value"],
        ["PV Size", f"{calc.pv_w:,.0f} W"],
        ["Battery Capacity", f"{calc.battery_kwh:.1f} kWh"],
        ["Annual Consumption", f"{calc.annual_kwh:,.0f} kWh"],
        ["Panel Tilt", f"{calc.tilt}\u00b0"],
        ["Orientation", calc.orientation.title()],
        ["Battery Efficiency", f"{calc.efficiency}%"],
    ]
    t2 = Table(config_data, colWidths=[8*cm, 8*cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elems.append(t2)
    elems.append(Spacer(1, 0.5*cm))

    elems.append(Paragraph("Energy Mix", h2_style))
    elems.append(Paragraph(
        f"Solar: {calc.solar_pct}% | Battery: {calc.battery_pct}% | Grid: {calc.grid_pct}%",
        body_style
    ))
    elems.append(Spacer(1, 0.5*cm))

    elems.append(Paragraph("ROI Milestones", h2_style))
    from models.energy_model import compute_roi_curve
    roi = compute_roi_curve(calc.annual_savings_eur, calc.installation_cost)
    roi_data_table = [["Year", "Cumul. Savings (\u20ac)", "Net Position (\u20ac)"]]
    for entry in roi[::5]:
        roi_data_table.append([
            str(entry["year"]),
            f"\u20ac{entry['cumulative_savings']:,.0f}",
            f"\u20ac{entry['net_position']:,.0f}",
        ])
    t3 = Table(roi_data_table, colWidths=[4*cm, 7*cm, 7*cm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GREEN, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elems.append(t3)
    elems.append(Spacer(1, 0.5*cm))

    elems.append(Paragraph("Computation Carbon Footprint", h2_style))
    elems.append(Paragraph(
        f"This calculation emitted approximately {calc.computation_co2_mg:.4f} mg CO2 "
        f"(tracked via CodeCarbon). Generated by GreenCalc AI Engine.",
        body_style
    ))
    elems.append(Spacer(1, 0.3*cm))
    elems.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    elems.append(Paragraph(
        "Generated by GreenCalc \u2014 AI-Powered Green Energy Calculator | EU AI Act Compliant",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=8,
                       textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER, spaceBefore=8)
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
        current_app.logger.error(f"PDF export error: {e}")
        abort(500)
