from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from datetime import datetime
import logging

from app.core.security import require_super_admin
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
async def list_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import AuditLog
    query = select(AuditLog)
    
    if user_id: query = query.where(AuditLog.user_id == user_id)
    if action: query = query.where(AuditLog.action == action)
    if entity_type: query = query.where(AuditLog.entity_type == entity_type)
    if date_from: query = query.where(AuditLog.created_at >= date_from)
    if date_to: query = query.where(AuditLog.created_at <= date_to)
        
    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/actions")
async def list_actions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import AuditLog
    query = select(AuditLog.action).distinct()
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/entities")
async def list_entities(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import AuditLog
    query = select(AuditLog.entity_type).distinct()
    result = await db.execute(query)
    return result.scalars().all()
