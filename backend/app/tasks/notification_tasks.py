import logging
from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.notification import Notification

logger = logging.getLogger("ksp_backend")

@celery_app.task(name="app.tasks.notification_tasks.create_notification_task")
def create_notification_task(user_id: int, title: str, message: str):
    """
    Asynchronously creates a new notification record in the database for the specified user.
    """
    db = SessionLocal()
    try:
        notification = Notification(
            UserID=user_id,
            Title=title,
            Message=message,
            IsRead=False
        )
        db.add(notification)
        db.commit()
        logger.info(f"Async notification created for UserID {user_id}: {title}")
    except Exception as e:
        logger.error(f"Error in create_notification_task: {e}", exc_info=True)
    finally:
        db.close()
