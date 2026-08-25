"""
SmartSchedule — Audit Service
Logs all significant actions to audit_logs table.
"""
import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        user_id: str,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        previous_value: dict | None = None,
        new_value: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ):
        """Log an action to the audit_logs table."""
        from app.models.audit import AuditLog

        try:
            log_entry = AuditLog(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                previous_value=previous_value,
                new_value=new_value,
                ip_address=ip_address,
                user_agent=user_agent,
                created_at=datetime.now(timezone.utc),
            )
            self.db.add(log_entry)
            await self.db.flush()
        except Exception as e:
            # Never let audit logging break the main operation
            logger.error(f'Audit log failed: {e}', exc_info=True)
