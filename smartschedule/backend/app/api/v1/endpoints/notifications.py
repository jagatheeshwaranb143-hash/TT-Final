from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
import logging

from app.core.security import get_current_user, require_super_admin
from app.core.exceptions import DataNotFoundError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

class NotificationSend(BaseModel):
    user_ids: list[str]
    title: str
    message: str
    type: str = 'info'

class FCMTokenUpdate(BaseModel):
    token: str

@router.get("/")
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Notification
    query = (
        select(Notification)
        .where(Notification.user_id == current_user["id"])
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .offset(skip).limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Notification
    query = select(func.count(Notification.id)).where(
        Notification.user_id == current_user["id"],
        Notification.is_read == False
    )
    result = await db.execute(query)
    return {"unread_count": result.scalar() or 0}

@router.patch("/{id}/read")
async def mark_as_read(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Notification
    query = select(Notification).where(Notification.id == id, Notification.user_id == current_user["id"])
    result = await db.execute(query)
    notif = result.scalar_one_or_none()
    
    if not notif:
        raise DataNotFoundError("Notification not found")
        
    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}

@router.patch("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Notification
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user["id"], Notification.is_read == False)
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "All notifications marked as read"}

@router.post("/send")
async def send_notification(
    data: NotificationSend,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import Notification
    for uid in data.user_ids:
        n = Notification(
            user_id=uid,
            title=data.title,
            message=data.message,
            type=data.type,
            is_read=False
        )
        db.add(n)
        
    await db.commit()
    return {"message": f"Sent {len(data.user_ids)} notifications"}

@router.post("/fcm-token")
async def register_fcm_token(
    data: FCMTokenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import User
    query = select(User).where(User.id == current_user["id"])
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user:
        user.fcm_token = data.token
        await db.commit()
    return {"message": "FCM token updated"}
