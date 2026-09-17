from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services import notification_service

router = APIRouter()


@router.get("", response_model=List[NotificationOut], summary="Get Notifications")
def read_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves dynamic in-app alerts and notification events for the active user.
    """
    notifications = notification_service.list_notifications(db, current_user)
    return [
        NotificationOut(
            id=n.NotificationID,
            user_id=n.UserID,
            title=n.Title,
            message=n.Message,
            created_at=n.CreatedAt,
            is_read=n.IsRead
        )
        for n in notifications
    ]


@router.put("/{notification_id}/read", summary="Mark Notification as Read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Marks a single notification as read and updates unread badge counts.
    """
    success = notification_service.mark_as_read(db, notification_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@router.delete("/{notification_id}", summary="Delete Notification")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes a single notification from PostgreSQL.
    """
    success = notification_service.delete_notification(db, notification_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}


@router.delete("", summary="Clear All Notifications")
def clear_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Clears all notifications for the current user.
    """
    notification_service.clear_all_notifications(db, current_user)
    return {"message": "All notifications cleared"}
