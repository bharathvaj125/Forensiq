from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.models.officer import Officer
from app.models.case_master import CaseMaster
from app.models.task_delegation import TaskDelegation, TaskTimelineEvent
from app.services.rank_service import rank_weight
from app.schemas.task_delegation import TaskCreate, TaskStatusUpdate, TaskDelegationOut, TaskTimelineEventOut

router = APIRouter()

TASK_STATUSES = ("Assigned", "In Progress", "Evidence Collected", "Under Review", "Completed")


def _is_admin(user: User) -> bool:
    return bool(user.role and user.role.RoleName == "Admin")


def _weight_of(db: Session, user: User) -> int:
    officer = db.query(Officer).filter(Officer.OfficerID == user.OfficerID).first() if user.OfficerID else None
    return rank_weight(officer.Rank if officer else None) or 0


def build_task_out(db: Session, task: TaskDelegation) -> TaskDelegationOut:
    by_user = db.query(User).filter(User.UserID == task.AssignedByUserID).first()
    to_user = db.query(User).filter(User.UserID == task.AssignedToUserID).first()
    
    by_officer = db.query(Officer).filter(Officer.OfficerID == by_user.OfficerID).first() if by_user and by_user.OfficerID else None
    to_officer = db.query(Officer).filter(Officer.OfficerID == to_user.OfficerID).first() if to_user and to_user.OfficerID else None
    
    case_obj = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == task.CaseMasterID).first() if task.CaseMasterID else None

    timeline_outs = []
    for ev in task.timeline_events:
        ev_user = db.query(User).filter(User.UserID == ev.UpdatedByUserID).first()
        timeline_outs.append(TaskTimelineEventOut(
            EventID=ev.EventID,
            TaskID=ev.TaskID,
            Status=ev.Status,
            Note=ev.Note,
            UpdatedByUserID=ev.UpdatedByUserID,
            UpdatedByUsername=ev_user.Username if ev_user else "System",
            Timestamp=ev.Timestamp
        ))

    return TaskDelegationOut(
        TaskID=task.TaskID,
        Title=task.Title,
        Description=task.Description,
        CaseMasterID=task.CaseMasterID,
        CaseNo=case_obj.CaseNo if case_obj else None,
        AssignedByUserID=task.AssignedByUserID,
        AssignedByUsername=by_user.Username if by_user else "Removed account",
        AssignedByRank=by_officer.Rank if by_officer else None,
        AssignedToUserID=task.AssignedToUserID,
        AssignedToUsername=to_user.Username if to_user else "Removed account",
        AssignedToRank=to_officer.Rank if to_officer else None,
        DistrictID=task.DistrictID,
        UnitID=task.UnitID,
        Priority=task.Priority,
        Status=task.Status,
        DueDate=task.DueDate,
        CreatedAt=task.CreatedAt,
        UpdatedAt=task.UpdatedAt,
        timeline_events=timeline_outs
    )


@router.post("/", response_model=TaskDelegationOut, status_code=status.HTTP_201_CREATED, summary="Appoint Task to Subordinate Officer")
def appoint_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Superior officer appoints a new task for a subordinate officer of lower rank.
    """
    target_user = db.query(User).filter(User.UserID == task_in.AssignedToUserID, User.IsActive == True).first()  # noqa: E712
    if not target_user:
        raise HTTPException(status_code=404, detail="Target officer not found.")
    if target_user.UserID == current_user.UserID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot appoint a task to yourself.")
    if target_user.role and target_user.role.RoleName in ("Admin", "ExternalAgencyOfficer"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tasks can only be appointed to serving police officers.")
    current_officer = db.query(Officer).filter(Officer.OfficerID == current_user.OfficerID).first() if current_user.OfficerID else None
    if not _is_admin(current_user) and _weight_of(db, target_user) >= _weight_of(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only appoint tasks to officers of a lower rank than yours.")
    if task_in.DueDate:
        try:
            date.fromisoformat(task_in.DueDate[:10])
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The due date must be an ISO date (YYYY-MM-DD).")

    new_task = TaskDelegation(
        Title=task_in.Title,
        Description=task_in.Description,
        CaseMasterID=task_in.CaseMasterID,
        AssignedByUserID=current_user.UserID,
        AssignedToUserID=task_in.AssignedToUserID,
        DistrictID=task_in.DistrictID,
        UnitID=task_in.UnitID,
        Priority=task_in.Priority,
        Status="Assigned",
        DueDate=task_in.DueDate
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # Initial timeline event
    init_event = TaskTimelineEvent(
        TaskID=new_task.TaskID,
        Status="Assigned",
        Note=f"Task appointed by {current_user.Username}" + (f" ({current_officer.Rank})" if current_officer and current_officer.Rank else ""),
        UpdatedByUserID=current_user.UserID
    )
    db.add(init_event)
    db.commit()
    db.refresh(new_task)

    from app.services import notification_service
    notification_service.create_notification(
        db, target_user.UserID, f"New task assigned: {new_task.Title}",
        f"{current_user.Username} appointed you a {new_task.Priority or 'standard'} priority task"
        + (f" due {new_task.DueDate:%Y-%m-%d}" if new_task.DueDate else "") + "."
    )

    return build_task_out(db, new_task)


@router.get("/assigned-by-me", response_model=List[TaskDelegationOut], summary="Get Tasks Appointed By Me")
def get_tasks_assigned_by_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves all tasks appointed by the current superior officer.
    """
    tasks = db.query(TaskDelegation).filter(TaskDelegation.AssignedByUserID == current_user.UserID).order_by(TaskDelegation.CreatedAt.desc()).all()
    return [build_task_out(db, t) for t in tasks]


@router.get("/assigned-to-me", response_model=List[TaskDelegationOut], summary="Get My Assigned Tasks")
def get_tasks_assigned_to_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves all tasks assigned to the current officer for execution.
    """
    tasks = db.query(TaskDelegation).filter(TaskDelegation.AssignedToUserID == current_user.UserID).order_by(TaskDelegation.CreatedAt.desc()).all()
    return [build_task_out(db, t) for t in tasks]


@router.put("/{task_id}/status", response_model=TaskDelegationOut, summary="Update Task Execution Status")
def update_task_status(
    task_id: int,
    status_in: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates the task status (e.g. In Progress, Evidence Collected, Completed) and appends a step to the timeline.
    """
    task = db.query(TaskDelegation).filter(TaskDelegation.TaskID == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if status_in.Status not in TASK_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Status must be one of: {', '.join(TASK_STATUSES)}.")
    if current_user.UserID not in (task.AssignedToUserID, task.AssignedByUserID) and not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the officer the task is appointed to, or the officer who appointed it, can update it.")
    task.Status = status_in.Status
    db.commit()

    # Append timeline event
    ev = TaskTimelineEvent(
        TaskID=task.TaskID,
        Status=status_in.Status,
        Note=status_in.Note or f"Status updated to {status_in.Status}",
        UpdatedByUserID=current_user.UserID
    )
    db.add(ev)
    db.commit()
    db.refresh(task)

    return build_task_out(db, task)


@router.get("/subordinate-officers", summary="Officers the current user may appoint tasks to")
def get_subordinate_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Active police officers of a strictly lower rank than the caller (an administrator may appoint any serving officer).
    External agency officers and administrators are never assignees."""
    current_weight = _weight_of(db, current_user)
    admin = _is_admin(current_user)
    officers = {o.OfficerID: o for o in db.query(Officer).all()}
    result = []
    for u in db.query(User).filter(User.UserID != current_user.UserID, User.IsActive == True).all():  # noqa: E712
        role_name = u.role.RoleName if u.role else ""
        if role_name in ("Admin", "ExternalAgencyOfficer"):
            continue
        officer = officers.get(u.OfficerID)
        weight = rank_weight(officer.Rank if officer else None) or 0
        if admin or weight < current_weight:
            result.append({"UserID": u.UserID, "Username": u.Username, "RoleName": role_name, "Rank": officer.Rank if officer else None,
                           "OfficerName": officer.Name if officer else None, "BadgeNumber": officer.BadgeNumber if officer else None, "Weight": weight})
    result.sort(key=lambda row: row["Weight"], reverse=True)
    return result
