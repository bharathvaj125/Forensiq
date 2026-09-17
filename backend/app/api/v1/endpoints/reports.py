from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.models.report_job import ReportJob
from app.crud import case_crud
from app.schemas.report import ReportSummary, ReportJobOut, ReportHistoryResponse
from app.services import report_service

router = APIRouter()

@router.get("/cases/{case_id}/summary", response_model=ReportSummary, summary="Get Case Report Summary")
def get_case_report_summary(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Generates a structured analytical case report summary, compiling linked entity counts.
    Enforces row-level geographic scoping checks.
    """
    case = case_crud.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )
        
    return ReportSummary(
        CaseMasterID=case.CaseMasterID,
        CaseNo=case.CaseNo,
        BriefFacts=case.BriefFacts,
        TotalAccused=len(case.accused_list),
        TotalVictims=len(case.victims),
        TotalEvidence=len(case.evidence_items),
        ReportGeneratedAt=datetime.now(timezone.utc)
    )

@router.post("/cases/{case_id}/generate", response_model=ReportJobOut, summary="Trigger PDF Report Generation")
def generate_case_report(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Triggers the asynchronous generation of a PDF case report dossier by integer Case ID.
    """
    return report_service.create_report_job(db, case_id, current_user)

@router.post("/compile", response_model=ReportJobOut, summary="Trigger PDF Report Compilation by Case ID or Case No")
def compile_case_report(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Triggers PDF dossier compilation by Case ID or Case Number string (e.g. '202600006' or '4823').
    """
    case_input = payload.get("case_input") or payload.get("case_id") or payload.get("CaseMasterID") or payload.get("case_no") or payload.get("CaseNo") or payload.get("id") or payload.get("crime_no")
    if case_input is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a valid Case ID or Case Number.")
    return report_service.create_report_job(db, case_input, current_user)

@router.get("/history", response_model=ReportHistoryResponse, summary="Get Report History")
def get_reports_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves all generated case reports within the user's jurisdiction scope.
    """
    history = report_service.get_report_history(db, current_user)
    return ReportHistoryResponse(history=history)

@router.get("/jobs/{report_job_id}", response_model=ReportJobOut, summary="Get Report Job Status")
def get_report_job_status(
    report_job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves status of a running report generation job.
    """
    return report_service.get_report_job(db, report_job_id, current_user)

@router.get("/jobs/{report_job_id}/download", summary="Download PDF Report")
def download_pdf_report(
    report_job_id: int,
    db: Session = Depends(get_db)
):
    """
    Downloads the compiled PDF bytes. Bypass strict auth scopes to allow simple href downloads.
    """
    job = db.query(ReportJob).filter(ReportJob.ReportJobID == report_job_id).first()
    if not job or not job.PDFBytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF report file is not ready or does not exist."
        )
    return Response(
        content=job.PDFBytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=case_dossier_{job.CaseMasterID}.pdf"}
    )


@router.get("/export/csv", summary="Export Cases CSV Dataset")
def export_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """Downloads jurisdiction-scoped case dataset in CSV format."""
    csv_bytes = report_service.export_cases_csv(db, current_user)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ksp_cases_dataset.csv"}
    )


@router.get("/export/excel/{case_id}", summary="Export Case Excel Dossier")
def export_excel(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """Downloads detailed case dossier in Excel-compatible TSV format."""
    excel_bytes = report_service.export_case_excel(db, case_id, current_user)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f"attachment; filename=case_dossier_{case_id}.xls"}
    )


@router.get("/export/docx/{case_id}", summary="Export Case Word Document")
def export_docx(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """Downloads case dossier in Word document format."""
    docx_bytes = report_service.export_case_docx(db, case_id, current_user)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=case_dossier_{case_id}.docx"}
    )
