from datetime import datetime
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.case_master import CaseMaster
from app.models.police_station import PoliceStation
from app.models.user import User


def create_notification(db: Session, user_id: int, title: str, message: str) -> Notification:
    """
    Creates a new dynamic alert or event notification for the user.
    """
    notification = Notification(
        UserID=user_id,
        Title=title,
        Message=message,
        IsRead=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def list_notifications(db: Session, current_user: User) -> list[Notification]:
    """
    Retrieves all notifications for the active user. If empty, seeds recent FIR incident notifications directly from CaseMaster.
    """
    user_notifs = db.query(Notification).filter(Notification.UserID == current_user.UserID).order_by(Notification.CreatedAt.desc()).all()
    if user_notifs:
        return user_notifs

    # Seed recent FIR incidents cleanly from CaseMaster
    recent_cases = db.query(CaseMaster).filter(CaseMaster.CrimeRegisteredDate.isnot(None)).order_by(CaseMaster.CrimeRegisteredDate.desc()).limit(6).all()
    
    ps_ids = {c.PoliceStationID for c in recent_cases if c.PoliceStationID}
    stations = {ps.UnitID: ps.UnitName for ps in db.query(PoliceStation).filter(PoliceStation.UnitID.in_(ps_ids)).all()} if ps_ids else {}

    generated_notifs = []
    for c in recent_cases:
        st_name = stations.get(c.PoliceStationID, "KSP Precinct Station")
        reg_date_str = c.CrimeRegisteredDate.strftime('%Y-%m-%d') if c.CrimeRegisteredDate else '2026-07-19'
        
        n = Notification(
            UserID=current_user.UserID,
            Title=f"Incident Logged: FIR #{c.CaseNo or c.CaseMasterID}",
            Message=f"{c.BriefFacts[:85]}... (Precinct: {st_name}, Date: {reg_date_str})",
            CreatedAt=c.CrimeRegisteredDate or datetime.now(),
            IsRead=False
        )
        db.add(n)
        generated_notifs.append(n)

    try:
        db.commit()
        return generated_notifs
    except Exception:
        db.rollback()

    return db.query(Notification).filter(Notification.UserID == current_user.UserID).order_by(Notification.CreatedAt.desc()).all()


def mark_as_read(db: Session, notification_id: int, current_user: User) -> bool:
    """
    Marks a single notification as read in PostgreSQL.
    """
    n = db.query(Notification).filter(Notification.NotificationID == notification_id, Notification.UserID == current_user.UserID).first()
    if not n:
        return False
    n.IsRead = True
    db.commit()
    return True


def delete_notification(db: Session, notification_id: int, current_user: User) -> bool:
    """
    Deletes a single notification from PostgreSQL.
    """
    n = db.query(Notification).filter(Notification.NotificationID == notification_id, Notification.UserID == current_user.UserID).first()
    if not n:
        return False
    db.delete(n)
    db.commit()
    return True


def clear_all_notifications(db: Session, current_user: User) -> bool:
    """
    Deletes or marks all notifications as read for the current user.
    """
    db.query(Notification).filter(Notification.UserID == current_user.UserID).delete()
    db.commit()
    return True
