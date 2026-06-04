from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "autopost",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.publish_task"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry configuration
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Result expiry: keep results for 24 hours
    result_expires=86400,
    # Beat schedule (if using celery beat for polling)
    beat_schedule={},
)
