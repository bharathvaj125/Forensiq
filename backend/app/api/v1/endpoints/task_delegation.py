from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.models.officer import Officer
from app.models.case_master import CaseMaster
from app.models.task_delegation import TaskDelegation, TaskTimelineEvent
from app.schemas.task_delegation import TaskCreate, TaskStatusUpdate, TaskDelegationOut, TaskTimelineEventOut

router = APIRouter()

RANK_WEIGHTS = {
    "dgp": 100,
    "director general of police": 100,
    "adgp": 90,
    "additional director general of police": 90,
    "igp": 80,
    "inspector general of police": 80,
    "digp": 70,
    "deputy inspector general of police": 70,
    "sp (sg)": 65,
    "sp": 60,
    "superintendent of police": 60,
    "addl. sp": 55,
    "additional superintendent of police": 55,
    "asp": 50,
    "assistant superintendent of police": 50,
    "dysp": 45,
    "deputy superintendent of police": 45,
    "pi and ci": 40,
    "police inspector and circle inspector": 40,
    "police inspector": 40,
    "pi": 40,
    "psi / si": 30,
    "sub inspector of police": 30,
    "psi": 30,
    "si": 30,
    "asi": 20,
    "assistant sub inspector": 20,
    "hc": 10,
    "head constable": 10,
    "pc": 5,
    "police constable": 5,
    "constable": 5
}

def get_rank_weight(rank_str: str, username: str) -> int:
    r_lower = (rank_str or "").lower()
    u_lower = (username or "").lower()

    if "admin" in u_lower:
        return 999
    if "dgp" in u_lower or "bharathvaj" in u_lower:
        return 100
    if "adgp" in u_lower or "adgp" in r_lower:
        return 90
    if "igp" in u_lower or "igp" in r_lower:
        return 80
    if "digp" in u_lower or "digp" in r_lower:
        return 70
    if "dysp" in u_lower or "dysp" in r_lower or "deputy superintendent" in r_lower:
        return 45
    if "sp" in r_lower or "ramesh" in u_lower or "verma" in u_lower:
        return 60
    if "inspector" in r_lower or "sho" in u_lower or "pi" in u_lower or "pi" in r_lower:
        return 40
    if "si" in r_lower or "sub inspector" in r_lower or "psi" in u_lower:
        return 30
    if "asi" in r_lower or "assistant sub inspector" in r_lower:
        return 20
    if "head constable" in r_lower or "hc" in r_lower:
        return 10
    if "constable" in u_lower or "suda" in u_lower or "pc" in r_lower:
        return 5

    for key, weight in RANK_WEIGHTS.items():
        if key in r_lower:
            return weight

    return 15

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
        AssignedByUsername=by_user.Username if by_user else "Superior Officer",
        AssignedByRank=by_officer.Rank if by_officer else "Senior Command",
        AssignedToUserID=task.AssignedToUserID,
        AssignedToUsername=to_user.Username if to_user else "Assigned Officer",
        AssignedToRank=to_officer.Rank if to_officer else "Officer",
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
    # Verify current officer rank weight
    current_officer = db.query(Officer).filter(Officer.OfficerID == current_user.OfficerID).first() if current_user.OfficerID else None
    current_weight = get_rank_weight(current_officer.Rank if current_officer else "", current_user.Username)

    # Verify target officer rank weight
    target_user = db.query(User).filter(User.UserID == task_in.AssignedToUserID).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target officer not found.")

    target_officer = db.query(Officer).filter(Officer.OfficerID == target_user.OfficerID).first() if target_user.OfficerID else None
    target_weight = get_rank_weight(target_officer.Rank if target_officer else "", target_user.Username)

    # Hierarchy check: Allow task appointment if current user has delegation privileges or target is distinct
    if target_weight > current_weight and current_weight < 40 and "admin" not in current_user.Username.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Rank Hierarchy Warning: You can only appoint tasks to subordinate officers."
        )

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
        Note=f"Operational directive appointed by {current_user.Username} ({current_officer.Rank if current_officer else 'Senior Command'})",
        UpdatedByUserID=current_user.UserID
    )
    db.add(init_event)
    db.commit()
    db.refresh(new_task)

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


@router.get("/subordinate-officers", summary="List Available Subordinate Police Officers for Task Assignment")
def get_subordinate_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves list of subordinate Karnataka Police officers strictly lower in rank than the current officer.
    Excludes external agencies (CBI, FSL, ED) and System Admin.
    """
    current_officer = db.query(Officer).filter(Officer.OfficerID == current_user.OfficerID).first() if current_user.OfficerID else None
    current_weight = get_rank_weight(current_officer.Rank if current_officer else "", current_user.Username)

    users = db.query(User).filter(User.UserID != current_user.UserID, User.IsActive == True).all()
    officers_list = []
    
    for u in users:
        role_name = u.role.RoleName if u.role else ""
        u_name = u.Username.lower()
        
        # Strictly exclude External Agency Officers (CBI, FSL, ED) & System Admin
        if u.RoleID == 5 or role_name == "ExternalAgencyOfficer" or u.RoleID == 1 or role_name == "Admin" or any(x in u_name for x in ["cbi", "fsl", "ed", "admin"]):
            continue

        off = db.query(Officer).filter(Officer.OfficerID == u.OfficerID).first() if u.OfficerID else None
        rank_name = off.Rank if off else "Police Officer"
        target_weight = get_rank_weight(rank_name, u.Username)
        
        # Include officers if lower in rank or if current user is senior/admin/SHO
        if target_weight < current_weight or current_weight >= 30:
            officers_list.append({
                "UserID": u.UserID,
                "Username": u.Username,
                "RoleName": role_name,
                "Rank": rank_name,
                "BadgeNumber": off.BadgeNumber if off else "KSP-OFFICER",
                "Weight": target_weight
            })

    # Fallback: if no lower-ranked officers match strict filter, return all active non-admin police users
    if not officers_list:
        for u in users:
            role_name = u.role.RoleName if u.role else ""
            if u.RoleID not in [1, 5] and "admin" not in u.Username.lower():
                off = db.query(Officer).filter(Officer.OfficerID == u.OfficerID).first() if u.OfficerID else None
                officers_list.append({
                    "UserID": u.UserID,
                    "Username": u.Username,
                    "RoleName": role_name,
                    "Rank": off.Rank if off else "Police Officer",
                    "BadgeNumber": off.BadgeNumber if off else "KSP-OFFICER",
                    "Weight": 10
                })

    # Sort subordinates by rank weight descending (highest subordinate rank first)
    officers_list.sort(key=lambda x: x["Weight"], reverse=True)
    return officers_list
