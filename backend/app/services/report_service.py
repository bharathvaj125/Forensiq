import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String
from fastapi import HTTPException, status
from app.models.report_job import ReportJob
from app.models.case_master import CaseMaster
from app.models.user import User
from app.tasks.report_tasks import generate_pdf_report_task
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter

logger = logging.getLogger("ksp_backend")

def create_report_job(db: Session, case_input: str | int, current_user: User) -> ReportJob:
    """
    Creates a pending report job for the officer, supporting search by Case Master ID or Case No.
    """
    case_query = db.query(CaseMaster)
    
    input_str = str(case_input).strip()
    if input_str.isdigit():
        case_id_val = int(input_str)
        case_query = case_query.filter(or_(
            CaseMaster.CaseMasterID == case_id_val,
            CaseMaster.CaseNo == input_str,
            CaseMaster.CaseNo.ilike(f"%{input_str}%"),
            CaseMaster.CrimeNo == case_id_val,
            cast(CaseMaster.CrimeNo, String).ilike(f"%{input_str}%")
        ))
    else:
        case_query = case_query.filter(or_(
            CaseMaster.CaseNo.ilike(f"%{input_str}%"),
            cast(CaseMaster.CrimeNo, String).ilike(f"%{input_str}%")
        ))

    case_query = apply_jurisdiction_filter(case_query, db, current_user)
    case = case_query.first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case matching '{case_input}' was not found or access denied."
        )

    report_job = ReportJob(
        CaseMasterID=case.CaseMasterID,
        Status="pending",
        CreatedBy=current_user.UserID
    )
    db.add(report_job)
    db.commit()
    db.refresh(report_job)

    try:
        generate_pdf_report_task(report_job.ReportJobID)
    except Exception as exc:
        logger.error(f"Failed to compile PDF report: {exc}")
        report_job.Status = "failed"
        db.commit()

    db.refresh(report_job)
    return report_job

def get_report_job(db: Session, report_job_id: int, current_user: User) -> ReportJob:
    """
    Retrieves the status of a specific report job, verifying row-level access permissions.
    """
    report_job = db.query(ReportJob).filter(ReportJob.ReportJobID == report_job_id).first()
    if not report_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found.")
    
    # Verify user owns the job or has access to target case
    if report_job.CreatedBy and report_job.CreatedBy != current_user.UserID and current_user.Role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. This report was requested by another officer.")

    case_query = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == report_job.CaseMasterID)
    case_query = apply_jurisdiction_filter(case_query, db, current_user)
    if not case_query.first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to case dossier report.")
    
    return report_job

def get_report_history(db: Session, current_user: User) -> list[ReportJob]:
    """
    Retrieves history of generated report jobs compiled within the officer's jurisdiction scope.
    """
    query = db.query(ReportJob).join(CaseMaster)
    query = apply_jurisdiction_filter(query, db, current_user, model_class=CaseMaster)
    return query.order_by(ReportJob.CompiledAt.desc()).all()


import csv
import io

def export_cases_csv(db: Session, current_user: User) -> bytes:
    """Export jurisdiction-scoped cases as a CSV file."""
    query = db.query(CaseMaster)
    query = apply_jurisdiction_filter(query, db, current_user)
    cases = query.limit(1000).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "CaseMasterID", "CaseNo", "CrimeRegisteredDate", "Priority",
        "AIRiskScore", "AccusedCount", "EvidenceCount", "BriefFacts"
    ])
    for c in cases:
        writer.writerow([
            c.CaseMasterID,
            c.CaseNo or "",
            c.CrimeRegisteredDate.strftime("%Y-%m-%d") if c.CrimeRegisteredDate else "",
            c.InvestigationPriority or "Medium",
            f"{c.AIRiskScore:.2f}" if c.AIRiskScore else "0.00",
            len(c.accused_list),
            len(c.evidence_items),
            (c.BriefFacts or "").replace("\n", " ")[:200]
        ])
    return output.getvalue().encode("utf-8")

def export_case_excel(db: Session, case_id: int, current_user: User) -> bytes:
    """Export detailed case dossier as an Excel-compatible TSV/XML file."""
    case_query = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id)
    case = apply_jurisdiction_filter(case_query, db, current_user).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found or access denied.")
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter="\t")
    writer.writerow(["Field", "Value"])
    writer.writerow(["Case Number", case.CaseNo or "N/A"])
    writer.writerow(["Case Master ID", case.CaseMasterID])
    writer.writerow(["Registration Date", str(case.CrimeRegisteredDate)[:10] if case.CrimeRegisteredDate else "N/A"])
    writer.writerow(["Priority", case.InvestigationPriority or "Medium"])
    writer.writerow(["AI Risk Score", f"{(case.AIRiskScore or 0.0)*100:.1f}%"])
    writer.writerow(["Brief Facts", case.BriefFacts or "N/A"])
    writer.writerow([])
    writer.writerow(["Accused Name", "Age", "Occupation", "Status"])
    for a in case.accused_list:
        writer.writerow([a.AccusedName or "N/A", f"{a.AgeYear or 'N/A'} yrs", a.Occupation or "N/A", "Repeat Offender" if a.IsRepeatOffender else "First Offence"])
    return output.getvalue().encode("utf-8")

def export_case_docx(db: Session, case_id: int, current_user: User) -> bytes:
    """Export case dossier as a Word document file."""
    case_query = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id)
    case = apply_jurisdiction_filter(case_query, db, current_user).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found or access denied.")
    
    content = f"""KARNATAKA STATE POLICE
OFFICIAL EXECUTIVE CASE DOSSIER & CRIME INTELLIGENCE BRIEF

Case Number: {case.CaseNo or 'N/A'}
Case Master ID: #{case.CaseMasterID}
Registration Date: {str(case.CrimeRegisteredDate)[:10] if case.CrimeRegisteredDate else 'N/A'}
Priority: {case.InvestigationPriority or 'Medium'}
AI Risk Score: {(case.AIRiskScore or 0.0)*100:.1f}%

BRIEF FACTS:
{case.BriefFacts or 'No brief facts recorded.'}

ACCUSED ENTITIES:
"""
    for a in case.accused_list:
        content += f"- {a.AccusedName or 'N/A'} ({a.AgeYear or 'N/A'} yrs, {a.Occupation or 'N/A'})\n"
    
    return content.encode("utf-8")
