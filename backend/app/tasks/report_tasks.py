import io
import logging
from datetime import datetime

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.case_master import CaseMaster
from app.models.report_job import ReportJob

logger = logging.getLogger("ksp_backend")

def generate_fallback_pdf(case: CaseMaster) -> bytes:
    """Generates a valid binary PDF 1.4 stream if ReportLab is not present in runtime."""
    case_no = case.CaseNo or str(case.CaseMasterID)
    facts = (case.BriefFacts or "No facts recorded.").replace("\n", " ").replace("(", "[").replace(")", "]")[:200]
    stream_text = (
        f"BT /F1 16 Tf 50 750 Td (KARNATAKA STATE POLICE) Tj ET\n"
        f"BT /F1 12 Tf 50 725 Td (EXECUTIVE DOSSIER - FIR #{case_no}) Tj ET\n"
        f"BT /F1 10 Tf 50 695 Td (Registration Date: {str(case.CrimeRegisteredDate)[:10]}) Tj ET\n"
        f"BT /F1 10 Tf 50 675 Td (Investigation Priority: {case.InvestigationPriority or 'Medium'}) Tj ET\n"
        f"BT /F1 10 Tf 50 655 Td (AI Risk Score: {int((case.AIRiskScore or 0.55)*100)}%) Tj ET\n"
        f"BT /F1 9 Tf 50 625 Td (Brief Facts: {facts[:75]}) Tj ET\n"
    ).encode("latin-1", errors="ignore")

    stream_len = len(stream_text)
    return (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Count 1 /Kids [3 0 R]>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj\n"
        b"4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        b"5 0 obj <</Length " + str(stream_len).encode() + b">>\nstream\n" +
        stream_text +
        b"\nendstream\nendobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000244 00000 n \n"
        b"0000000319 00000 n \n"
        b"trailer <</Size 6 /Root 1 0 R>>\n"
        b"startxref\n400\n%%EOF"
    )

def build_pdf_bytes_for_case(case: CaseMaster) -> bytes:
    if not HAS_REPORTLAB:
        return generate_fallback_pdf(case)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e3a8a'),
        alignment=1,
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=12
    )
    h2_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0f172a')
    )
    facts_style = ParagraphStyle(
        'FactsBox',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
        backColor=colors.HexColor('#f8fafc'),
        borderColor=colors.HexColor('#cbd5e1'),
        borderWidth=1,
        borderPadding=8,
        spaceAfter=10
    )
    ai_style = ParagraphStyle(
        'AIBox',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e3a8a'),
        backColor=colors.HexColor('#eff6ff'),
        borderColor=colors.HexColor('#bfdbfe'),
        borderWidth=1,
        borderPadding=8,
        spaceAfter=10
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("KARNATAKA STATE POLICE", title_style))
    story.append(Paragraph("OFFICIAL EXECUTIVE CASE DOSSIER & CRIME INTELLIGENCE BRIEF", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a8a'), spaceAfter=10))

    # Meta Table
    station_name = "N/A"
    district_name = "N/A"
    if hasattr(case, 'station') and case.station:
        station_name = case.station.UnitName or "N/A"
        if hasattr(case.station, 'district') and case.station.district:
            district_name = case.station.district.DistrictName or "N/A"

    risk_score_val = case.AIRiskScore or 0.0
    risk_pct = f"{risk_score_val * 100:.1f}%"
    risk_level = "Severe High Risk" if risk_score_val >= 0.8 else "High Risk" if risk_score_val >= 0.6 else "Medium Risk" if risk_score_val >= 0.3 else "Low Risk"

    meta_data = [
        [Paragraph("<b>Case Number</b>", body_style), Paragraph(f"<b>{case.CaseNo or 'N/A'}</b>", body_style), Paragraph("<b>Case Master ID</b>", body_style), Paragraph(f"#{case.CaseMasterID}", body_style)],
        [Paragraph("<b>District</b>", body_style), Paragraph(district_name, body_style), Paragraph("<b>Police Station</b>", body_style), Paragraph(station_name, body_style)],
        [Paragraph("<b>Registration Date</b>", body_style), Paragraph(case.CrimeRegisteredDate.strftime('%Y-%m-%d') if case.CrimeRegisteredDate else "N/A", body_style), Paragraph("<b>Priority</b>", body_style), Paragraph(f"<b>{case.InvestigationPriority or 'Medium'}</b>", body_style)],
        [Paragraph("<b>AI Risk Score</b>", body_style), Paragraph(f"<font color='#b91c1c'><b>{risk_level} ({risk_pct})</b></font>", body_style), Paragraph("<b>Sensitivity</b>", body_style), Paragraph(case.CaseSensitivity or "Standard", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[110, 160, 110, 160])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # Incident Brief Facts
    story.append(Paragraph("Incident Brief Facts", h2_style))
    story.append(Paragraph(case.BriefFacts or "No facts recorded.", facts_style))

    # AI Threat Analysis
    story.append(Paragraph("AI Threat & Pattern Analytics", h2_style))
    ai_text = (
        f"<b>Predictive Threat Index:</b> {risk_pct} ({risk_level})<br/>"
        f"<b>Spatio-Temporal Coordinates:</b> Lat: {case.latitude or 0.0:.4f}, Lng: {case.longitude or 0.0:.4f}<br/>"
        f"<b>Tactical Patrol Directive:</b> Focus mobile beat patrols near sector coordinates ({case.latitude or 0.0:.3f}, {case.longitude or 0.0:.3f}) during peak crime hours (18:00 - 02:00 hrs). Cross-reference active bail status and gang linkages."
    )
    story.append(Paragraph(ai_text, ai_style))

    # Accused Table
    story.append(Paragraph("Accused / Suspect Profiles", h2_style))
    acc_headers = [Paragraph("<b>Accused Name</b>", body_style), Paragraph("<b>Age</b>", body_style), Paragraph("<b>Occupation</b>", body_style), Paragraph("<b>Status</b>", body_style)]
    acc_data = [acc_headers]
    for a in case.accused_list:
        rep_str = "Repeat Offender" if a.IsRepeatOffender == 1 else "First Offence"
        acc_data.append([
            Paragraph(a.AccusedName or "N/A", body_style),
            Paragraph(f"{a.AgeYear or 'N/A'} yrs", body_style),
            Paragraph(a.Occupation or "N/A", body_style),
            Paragraph(rep_str, body_style)
        ])
    if len(acc_data) == 1:
        acc_data.append([Paragraph("No accused entities listed.", body_style), Paragraph("-", body_style), Paragraph("-", body_style), Paragraph("-", body_style)])

    t_acc = Table(acc_data, colWidths=[160, 80, 160, 140])
    t_acc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_acc)
    story.append(Spacer(1, 10))

    # Victims Table
    story.append(Paragraph("Victim & Witness Records", h2_style))
    v_headers = [Paragraph("<b>Victim Name</b>", body_style), Paragraph("<b>Age</b>", body_style), Paragraph("<b>Injury Severity</b>", body_style), Paragraph("<b>Relation to Accused</b>", body_style)]
    v_data = [v_headers]
    for v in getattr(case, 'victims', []):
        v_data.append([
            Paragraph(getattr(v, 'VictimName', 'N/A') or 'N/A', body_style),
            Paragraph(f"{getattr(v, 'AgeYear', 'N/A')} yrs", body_style),
            Paragraph(getattr(v, 'InjurySeverity', 'Standard') or 'Standard', body_style),
            Paragraph(getattr(v, 'RelationToAccused', 'None') or 'None', body_style)
        ])
    if len(v_data) == 1:
        v_data.append([Paragraph("No victim entities linked.", body_style), Paragraph("-", body_style), Paragraph("-", body_style), Paragraph("-", body_style)])

    t_v = Table(v_data, colWidths=[160, 80, 160, 140])
    t_v.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_v)
    story.append(Spacer(1, 10))

    # Evidence Table
    story.append(Paragraph("Collected Evidence Items", h2_style))
    ev_headers = [Paragraph("<b>Evidence Type</b>", body_style), Paragraph("<b>Description / Seizure Details</b>", body_style), Paragraph("<b>Collection Date</b>", body_style)]
    ev_data = [ev_headers]
    for e in case.evidence_items:
        ev_data.append([
            Paragraph(e.EvidenceType or "N/A", body_style),
            Paragraph(e.Description or "N/A", body_style),
            Paragraph(e.CollectionDate.strftime('%Y-%m-%d') if e.CollectionDate else "N/A", body_style)
        ])
    if len(ev_data) == 1:
        ev_data.append([Paragraph("No evidence items registered.", body_style), Paragraph("-", body_style), Paragraph("-", body_style)])

    t_ev = Table(ev_data, colWidths=[150, 250, 140])
    t_ev.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_ev)
    story.append(Spacer(1, 15))

    footer_style = ParagraphStyle(
        'FooterNotice',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )
    story.append(Paragraph("CONFIDENTIAL — OFFICIAL POLICE USE ONLY — Generated by KSP AI Crime Intelligence Platform", footer_style))

    doc.build(story)
    return buffer.getvalue()


@celery_app.task(name="app.tasks.report_tasks.generate_pdf_report_task")
def generate_pdf_report_task(report_job_id: int):
    db = SessionLocal()
    try:
        report_job = db.query(ReportJob).filter(ReportJob.ReportJobID == report_job_id).first()
        if not report_job:
            logger.error(f"Report job #{report_job_id} not found in database.")
            return

        case = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == report_job.CaseMasterID).first()
        if not case:
            logger.error(f"Case #{report_job.CaseMasterID} not found for report job #{report_job_id}.")
            report_job.Status = "failed"
            db.commit()
            return

        logger.info(f"Generating ReportLab PDF for Case ID: {case.CaseMasterID}...")

        pdf_bytes = build_pdf_bytes_for_case(case)

        report_job.PDFBytes = pdf_bytes
        report_job.Status = "completed"
        report_job.PDFUrl = f"/api/v1/reports/jobs/{report_job_id}/download"
        db.commit()
        logger.info(f"Successfully compiled ReportLab PDF for Case ID: {case.CaseMasterID}")

    except Exception as e:
        logger.error(f"Error in generate_pdf_report_task: {e}", exc_info=True)
        if 'report_job' in locals() and report_job:
            report_job.Status = "failed"
            db.commit()
    finally:
        db.close()
