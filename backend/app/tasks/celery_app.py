from app.core.config import settings

redis_url = settings.REDIS_URL.strip() if (settings.REDIS_URL and isinstance(settings.REDIS_URL, str)) else ""

if redis_url and "redis" in redis_url:
    try:
        from celery import Celery
        celery_app = Celery(
            "tasks",
            broker=redis_url,
            backend=redis_url,
            include=["app.tasks.report_tasks", "app.tasks.notification_tasks"]
        )
        celery_app.conf.update(
            task_serializer="json",
            accept_content=["json"],
            result_serializer="json",
            timezone="UTC",
            enable_utc=True,
        )
    except Exception:
        class DummyCelery:
            def task(self, *args, **kwargs):
                def decorator(func):
                    return func
                return decorator
            def update(self, *args, **kwargs):
                pass

        celery_app = DummyCelery()
        celery_app.conf = DummyCelery()
else:
    class DummyCelery:
        def task(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
        def update(self, *args, **kwargs):
            pass

    celery_app = DummyCelery()
    celery_app.conf = DummyCelery()
