"""
SmartSchedule — Celery App Stub
In local dev (no Redis), this module provides a no-op Celery app
so imports don't fail. Background tasks run synchronously instead.
"""
import logging

logger = logging.getLogger(__name__)

try:
    from celery import Celery
    from app.core.config import settings

    celery_app = Celery(
        "smartschedule",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        result_expires=3600,
    )
    logger.info("Celery app initialized with Redis broker.")
except Exception as e:
    logger.warning(f"Celery not available (Redis probably not running): {e}")
    
    class _StubCelery:
        """No-op Celery stub when Redis is unavailable."""
        def task(self, *args, **kwargs):
            def decorator(func):
                func.delay = func
                func.apply_async = lambda args=None, kwargs=None, **kw: func(*(args or []), **(kwargs or {}))
                return func
            return decorator
        
        def conf(self):
            pass

    celery_app = _StubCelery()
