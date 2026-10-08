from sqlalchemy.orm import Session
from app.models.notification import Notification
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
    """The caller's notifications, newest first. Notifications are created by events (case assignment,
    task appointment); an empty list means nothing has happened for this user."""
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
