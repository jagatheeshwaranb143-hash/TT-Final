"""
SmartSchedule — Notification Service
Sends FCM push notifications and creates in-app notification records.
NEVER sends fake/test notifications.
"""
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def notify_timetable_published(
        self,
        version_id: str,
        department_id: str,
        college_id: str,
    ):
        """
        Notify all faculty and students in the department that a new timetable is published.
        """
        from app.models.user import User
        from app.models.faculty import Faculty

        # Get faculty in department
        faculty_result = await self.db.execute(
            select(Faculty).where(Faculty.department_id == department_id, Faculty.is_active == True)
        )
        faculty_list = faculty_result.scalars().all()

        faculty_user_ids = [str(f.user_id) for f in faculty_list]

        # Create in-app notifications for each user
        for user_id in faculty_user_ids:
            await self._create_notification(
                user_id=user_id,
                title='New Timetable Published',
                body='Your department timetable has been published. Tap to view your schedule.',
                notification_type='timetable_published',
                reference_type='timetable_version',
                reference_id=version_id,
            )

        # Send FCM push notifications
        await self._send_fcm_to_users(
            user_ids=faculty_user_ids,
            title='Timetable Published',
            body='Your new timetable is ready. Tap to view your schedule.',
            data={'type': 'timetable_published', 'version_id': version_id},
        )

        logger.info(f"Published timetable notifications sent to {len(faculty_user_ids)} users")

    async def notify_approval_required(
        self,
        version_id: str,
        approver_user_id: str,
        dept_name: str,
        next_step: str,
    ):
        """Notify the next approver that their action is needed."""
        await self._create_notification(
            user_id=approver_user_id,
            title=f'Timetable Approval Required',
            body=f'The {dept_name} timetable requires your {next_step} approval.',
            notification_type='approval_required',
            reference_type='timetable_version',
            reference_id=version_id,
        )

    async def _create_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
        reference_type: str | None = None,
        reference_id: str | None = None,
    ):
        """Insert a notification record in the database."""
        import uuid
        from app.models.notification import Notification

        notification = Notification(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            title=title,
            body=body,
            notification_type=notification_type,
            reference_type=reference_type,
            reference_id=reference_id,
            is_read=False,
            sent_at=datetime.now(timezone.utc),
        )
        self.db.add(notification)
        await self.db.flush()

    async def _send_fcm_to_users(self, user_ids: list[str], title: str, body: str, data: dict):
        """Send FCM push notification to a list of user IDs."""
        from app.core.config import settings
        from app.models.notification import FCMToken

        if not settings.FCM_PROJECT_ID:
            logger.debug('FCM not configured — skipping push notifications')
            return

        # Get all FCM tokens for these users
        tokens_result = await self.db.execute(
            select(FCMToken).where(FCMToken.user_id.in_(user_ids))
        )
        tokens = tokens_result.scalars().all()

        if not tokens:
            logger.debug(f'No FCM tokens found for {len(user_ids)} users')
            return

        try:
            import firebase_admin
            from firebase_admin import messaging

            messages = [
                messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data=data,
                    token=token.token,
                )
                for token in tokens
            ]

            if messages:
                response = messaging.send_each(messages)
                logger.info(f'FCM: {response.success_count}/{len(messages)} messages sent')

        except Exception as e:
            logger.error(f'FCM send failed: {e}', exc_info=True)
