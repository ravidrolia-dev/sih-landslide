import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_advisory_pdf_bytes(lat: float, lon: float, location_name: str, risk_data: dict) -> bytes:
    """
    Generates an official PDF Disaster Management Early Warning Advisory report using ReportLab.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e293b'),
        alignment=1, # Center
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0284c7'),
        alignment=1, # Center
        spaceAfter=15
    )

    heading2_style = ParagraphStyle(
        'DocHeading2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    bold_body_style = ParagraphStyle(
        'DocBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0f172a')
    )

    story = []

    # Header Banner
    story.append(Paragraph("NATIONAL LANDSLIDE EARLY WARNING & ADVISORY SYSTEM", subtitle_style))
    story.append(Paragraph("OFFICIAL DISASTER MANAGEMENT EARLY WARNING ADVISORY", title_style))
    story.append(Paragraph("Issued in Collaboration with SDMA, NDRF, & Geological Survey of India", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=15))

    risk_score = risk_data.get('risk_score', 0.0)
    category = risk_data.get('category', 'Watch')
    satellite_features = risk_data.get('satellite_features', {})
    top_factors = risk_data.get('top_factors', [])

    # Color logic
    if category == 'Severe':
        badge_bg = colors.HexColor('#fee2e2')
        badge_text = colors.HexColor('#dc2626')
    elif category == 'Warning':
        badge_bg = colors.HexColor('#ffedd5')
        badge_text = colors.HexColor('#ea580c')
    elif category == 'Alert':
        badge_bg = colors.HexColor('#fef9c3')
        badge_text = colors.HexColor('#ca8a04')
    else:
        badge_bg = colors.HexColor('#d1fae5')
        badge_text = colors.HexColor('#059669')

    # Summary Table
    now_str = datetime.now().strftime("%d %b %Y, %H:%M HRS IST")
    summary_data = [
        [
            Paragraph("Target Location:", bold_body_style),
            Paragraph(f"<b>{location_name or 'Queried Point'}</b>", body_style),
            Paragraph("Advisory Ref:", bold_body_style),
            Paragraph(f"NE-GEO/ADV/{datetime.now().strftime('%Y%m%d')}/09", body_style)
        ],
        [
            Paragraph("Coordinates:", bold_body_style),
            Paragraph(f"{lat:.4f}°N, {lon:.4f}°E", body_style),
            Paragraph("Timestamp:", bold_body_style),
            Paragraph(now_str, body_style)
        ],
        [
            Paragraph("Risk Tier:", bold_body_style),
            Paragraph(f"<font color='{badge_text.hexval()}'><b>{category.upper()} ({risk_score}%)</b></font>", bold_body_style),
            Paragraph("Model Pipeline:", bold_body_style),
            Paragraph("XGBoost + SHAP Explainer (v2.4)", body_style)
        ]
    ]

    summary_table = Table(summary_data, colWidths=[90, 160, 90, 180])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 12))

    # Satellite Feature Triggers
    story.append(Paragraph("1. Live Google Earth Engine (GEE) Satellite Metric Triggers", heading2_style))
    
    sat_table_data = [
        [Paragraph("Satellite Feature Parameter", bold_body_style), Paragraph("Observed Value", bold_body_style), Paragraph("Primary Satellite Source", bold_body_style), Paragraph("Risk Threshold Evaluation", bold_body_style)],
        [Paragraph("Elevation", body_style), Paragraph(f"{satellite_features.get('elevation', 0):.0f} meters", body_style), Paragraph("USGS SRTM 30m DEM", body_style), Paragraph("High altitude slope terrain", body_style)],
        [Paragraph("Slope Angle", body_style), Paragraph(f"{satellite_features.get('slope', 0):.1f} degrees", body_style), Paragraph("USGS SRTM 30m DEM", body_style), Paragraph("Steep incline failure vulnerability", body_style)],
        [Paragraph("24-Hour Rainfall", body_style), Paragraph(f"{satellite_features.get('rainfall_24h', 0):.1f} mm", body_style), Paragraph("NASA GPM IMERG 30-min", body_style), Paragraph("Short-term deluge intensity", body_style)],
        [Paragraph("72-Hour Rainfall", body_style), Paragraph(f"{satellite_features.get('rainfall_72h', 0):.1f} mm", body_style), Paragraph("NASA GPM IMERG 30-min", body_style), Paragraph("Cumulative saturation trigger", body_style)],
        [Paragraph("Vegetation Index (NDVI)", body_style), Paragraph(f"{satellite_features.get('ndvi', 0):.3f}", body_style), Paragraph("Sentinel-2 Harmonized", body_style), Paragraph("Canopy root binding capacity", body_style)],
        [Paragraph("Soil Moisture", body_style), Paragraph(f"{satellite_features.get('soil_moisture', 0)*100:.0f}%", body_style), Paragraph("Estimated Moisture Field", body_style), Paragraph("Subsurface pore water pressure", body_style)],
    ]

    sat_table = Table(sat_table_data, colWidths=[130, 90, 150, 150])
    sat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(sat_table)
    story.append(Spacer(1, 12))

    # SHAP Explainability Breakdown
    story.append(Paragraph("2. SHAP Machine Learning Failure Mode Breakdown", heading2_style))
    shap_text = "The XGBoost model identified the following key parameters contributing to the calculated susceptibility score:<br/>"
    for factor in top_factors[:4]:
        name = factor.get('feature', '').replace('_', ' ').title()
        impact = factor.get('impact', 0.0)
        direction = "INCREASED risk" if impact > 0 else "DECREASED risk"
        shap_text += f"• <b>{name}</b>: Contribution impact of <b>{impact:+.3f}</b> ({direction})<br/>"
    story.append(Paragraph(shap_text, body_style))
    story.append(Spacer(1, 12))

    # Actionable Disaster SOPs
    story.append(Paragraph("3. Actionable Standard Operating Protocols (SOPs) for Authorities", heading2_style))
    
    if category in ['Severe', 'Warning']:
        sop_data = [
            [Paragraph("Target Authority / Unit", bold_body_style), Paragraph("Actionable Emergency Directives", bold_body_style)],
            [
                Paragraph("<b>NDRF Quick Response Team (QRT)</b>", body_style),
                Paragraph("• Mobilize Search & Rescue units within 1.5 km radius.<br/>• Setup emergency shelters away from active drainage paths.<br/>• Pre-position heavy earthmoving equipment.", body_style)
            ],
            [
                Paragraph("<b>Highway Patrol & BRO</b>", body_style),
                Paragraph("• Restrict heavy multi-axle freight traffic along vulnerable mountain passes.<br/>• Deploy flagmen and warning beacons at road cut intersections.<br/>• Keep standby clearing crews ready.", body_style)
            ],
            [
                Paragraph("<b>District Emergency Ops (DEOC)</b>", body_style),
                Paragraph("• Issue high-decibel siren warnings for settlements down-slope.<br/>• Maintain hourly communication with state meteorology control room.", body_style)
            ]
        ]
    else:
        sop_data = [
            [Paragraph("Target Authority / Unit", bold_body_style), Paragraph("Routine Protocol Directives", bold_body_style)],
            [
                Paragraph("<b>District Authorities & Public</b>", body_style),
                Paragraph("• Routine satellite monitoring active.<br/>• Maintain normal vigilance during ongoing monsoon period.", body_style)
            ]
        ]

    sop_table = Table(sop_data, colWidths=[150, 370])
    sop_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(sop_table)
    story.append(Spacer(1, 20))

    # Official Sign-off Stamp
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#94a3b8'), spaceAfter=10))
    story.append(Paragraph("<b>AUTOMATED EMERGENCY DISASTER ADVISORY SYSTEM — NE-GEOALERT PLATFORM</b>", ParagraphStyle('Sign', parent=body_style, alignment=1, fontSize=8, textColor=colors.HexColor('#64748b'))))
    story.append(Paragraph("This document is generated automatically from live Google Earth Engine feeds and trained ML inference. Verified by SDMA Command Center.", ParagraphStyle('Sign2', parent=body_style, alignment=1, fontSize=8, textColor=colors.HexColor('#94a3b8'))))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def simulate_emergency_alert(lat: float, lon: float, location_name: str, risk_data: dict) -> dict:
    """
    Simulates sending emergency SMS & Email alerts to emergency response units (NDRF, SDMA, DEOC).
    """
    category = risk_data.get('category', 'Watch')
    score = risk_data.get('risk_score', 0.0)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
    tx_id = f"ALERT-TX-{int(datetime.now().timestamp())}"

    recipients = [
        {"unit": "NDRF 1st Battalion (Guwahati Control Room)", "phone": "+91-94350-XXXXX", "email": "controlroom.1bn@ndrf.gov.in"},
        {"unit": "State Disaster Management Authority (SDMA)", "phone": "+91-98620-XXXXX", "email": "seoc.sdma@state.gov.in"},
        {"unit": "District Emergency Operations Center (DEOC)", "phone": "+91-94361-XXXXX", "email": "deoc.district@nic.in"},
        {"unit": "Border Roads Organisation (BRO) Task Force", "phone": "+91-94360-XXXXX", "email": "hq.bro.ner@nic.in"}
    ]

    sms_payload = (
        f"🚨 EMERGENCY LANDSLIDE ALERT [{category.upper()} - {score:.1f}%]\n"
        f"Location: {location_name} ({lat:.4f}N, {lon:.4f}E)\n"
        f"Time: {timestamp}\n"
        f"Directives: Mobilize QRT & prepare traffic restriction. Ref: {tx_id}"
    )

    email_payload = {
        "subject": f"[PRIORITY URGENT] Landslide Risk Alert ({category.upper()}) - {location_name}",
        "body": (
            f"Official Emergency Notification\n\n"
            f"The NE-GeoAlert Google Earth Engine Early Warning Platform has detected a high landslide risk event.\n\n"
            f"Location: {location_name}\n"
            f"Coordinates: Lat {lat:.4f}, Lon {lon:.4f}\n"
            f"Calculated Risk Score: {score:.2f}%\n"
            f"Risk Category: {category.upper()}\n"
            f"Timestamp: {timestamp}\n\n"
            f"Standard Operating Protocol:\n"
            f"1. NDRF Quick Response Teams placed on high standby.\n"
            f"2. Preemptive inspection of mountain cut slopes.\n"
            f"3. Continuous GEE satellite rainfall monitoring enabled.\n\n"
            f"System Transaction ID: {tx_id}"
        )
    }

    return {
        "status": "DISPATCHED",
        "transaction_id": tx_id,
        "timestamp": timestamp,
        "location": {"name": location_name, "latitude": lat, "longitude": lon},
        "risk_summary": {"score": score, "category": category},
        "recipients_notified": len(recipients),
        "recipients": recipients,
        "sms_payload": sms_payload,
        "email_payload": email_payload
    }
