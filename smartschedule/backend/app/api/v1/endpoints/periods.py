from fastapi import APIRouter, Depends, Query
from typing import Optional, Any
from datetime import time as dtime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field
import logging
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import DataNotFoundError, ConflictError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

def parse_time_str(val: Any) -> dtime:
    if isinstance(val, dtime):
        return val
    if isinstance(val, str):
        val = val.strip()
        parts = val.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        second = int(parts[2]) if len(parts) > 2 else 0
        return dtime(hour, minute, second)
    return dtime(9, 0)

def format_time_str(t: Any) -> str:
    if isinstance(t, dtime):
        return t.strftime("%H:%M")
    return str(t) if t else "09:00"

class WorkingDayConfig(BaseModel):
    college_id: Optional[str] = None
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])

class PeriodConfigCreate(BaseModel):
    college_id: Optional[str] = None
    name: str = "Standard Bell Schedule"
    is_default: bool = True

class PeriodItem(BaseModel):
    id: Optional[str] = None
    number: Optional[int] = None
    period_number: Optional[int] = None
    start_time: str = "09:00"
    end_time: str = "09:50"
    is_break: bool = False
    break_name: Optional[str] = None
    label: Optional[str] = None

class FullSchedulePayload(BaseModel):
    college_id: Optional[str] = None
    configuration_id: Optional[str] = None
    configuration_name: Optional[str] = "Standard Bell Schedule"
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    periods: list[PeriodItem] = Field(default_factory=list)

@router.get("/working-days")
async def get_working_days(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import WorkingDay
    cid = current_user.get("college_id")
    if not cid:
        return {"college_id": None, "working_days": [1, 2, 3, 4, 5]}
    
    query = select(WorkingDay).where(WorkingDay.college_id == cid)
    result = await db.execute(query)
    rows = result.scalars().all()
    
    if not rows:
        # Saturday is optional and can be enabled in Period Configuration.
        default_days = [1, 2, 3, 4, 5]
        for d in default_days:
            db.add(WorkingDay(college_id=cid, day_of_week=d, is_working=True))
        await db.commit()
        return {"college_id": cid, "working_days": default_days}
    
    active_days = [r.day_of_week for r in rows if r.is_working]
    return {"college_id": cid, "working_days": sorted(active_days)}

@router.post("/working-days")
async def set_working_days(
    data: WorkingDayConfig,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import WorkingDay
    cid = data.college_id or current_user.get("college_id")
    if not cid:
        raise ConflictError("College ID is required")
        
    await db.execute(delete(WorkingDay).where(WorkingDay.college_id == cid))
    
    working_days = sorted(set(data.working_days))
    for day_num in working_days:
        db.add(WorkingDay(college_id=cid, day_of_week=day_num, is_working=True))
        
    await db.commit()
    return {"college_id": cid, "working_days": working_days, "message": "Working days updated successfully"}

@router.get("/configurations")
async def list_period_configurations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import PeriodConfiguration, Period
    cid = current_user.get("college_id")
    query = select(PeriodConfiguration)
    if cid:
        query = query.where(PeriodConfiguration.college_id == cid)
    result = await db.execute(query)
    configs = result.scalars().all()
    
    # If no configurations exist, bootstrap a default configuration
    if not configs and cid:
        default_conf = PeriodConfiguration(
            college_id=cid,
            name="Standard Daily Schedule",
            is_default=True
        )
        db.add(default_conf)
        await db.flush()
        
        default_slots = [
            (1, "09:00", "09:50", False, None),
            (2, "09:50", "10:40", False, None),
            (3, "10:40", "11:00", True, "Short Break"),
            (4, "11:00", "11:50", False, None),
            (5, "11:50", "12:40", False, None),
            (6, "12:40", "13:30", True, "Lunch Break"),
            (7, "13:30", "14:20", False, None),
            (8, "14:20", "15:10", False, None),
            (9, "15:10", "16:00", False, None),
        ]
        for num, st, et, is_brk, brk_name in default_slots:
            db.add(Period(
                configuration_id=default_conf.id,
                number=num,
                start_time=parse_time_str(st),
                end_time=parse_time_str(et),
                is_break=is_brk,
                break_name=brk_name,
            ))
        await db.commit()
        await db.refresh(default_conf)
        configs = [default_conf]
        
    return configs

@router.post("/configurations")
async def create_period_configuration(
    data: PeriodConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import PeriodConfiguration
    try:
        cid = data.college_id or current_user.get("college_id")
        new_conf = PeriodConfiguration(
            college_id=cid,
            name=data.name,
            is_default=data.is_default,
        )
        db.add(new_conf)
        await db.commit()
        await db.refresh(new_conf)
        return new_conf
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Configuration conflict.")

@router.get("/active")
async def get_active_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import PeriodConfiguration, Period, WorkingDay
    cid = current_user.get("college_id")
    
    # Fetch default config or first config
    q = select(PeriodConfiguration)
    if cid:
        q = q.where(PeriodConfiguration.college_id == cid)
    q = q.order_by(PeriodConfiguration.is_default.desc())
    res = await db.execute(q)
    conf = res.scalars().first()
    
    if not conf:
        # Create default
        conf = PeriodConfiguration(
            college_id=cid or "c1111111-1111-1111-1111-111111111111",
            name="Standard Daily Schedule",
            is_default=True
        )
        db.add(conf)
        await db.flush()
        
        slots = [
            (1, "09:00", "09:50", False, None),
            (2, "09:50", "10:40", False, None),
            (3, "10:40", "11:00", True, "Short Break"),
            (4, "11:00", "11:50", False, None),
            (5, "11:50", "12:40", False, None),
            (6, "12:40", "13:30", True, "Lunch Break"),
            (7, "13:30", "14:20", False, None),
            (8, "14:20", "15:10", False, None),
            (9, "15:10", "16:00", False, None),
        ]
        for num, st, et, is_brk, brk_name in slots:
            db.add(Period(
                configuration_id=conf.id,
                number=num,
                start_time=parse_time_str(st),
                end_time=parse_time_str(et),
                is_break=is_brk,
                break_name=brk_name,
            ))
        await db.commit()
        await db.refresh(conf)
        
    p_query = select(Period).where(Period.configuration_id == conf.id).order_by(Period.number)
    p_res = await db.execute(p_query)
    periods = p_res.scalars().all()
    
    # Working days
    wd_q = select(WorkingDay).where(WorkingDay.college_id == conf.college_id)
    wd_res = await db.execute(wd_q)
    wd_rows = wd_res.scalars().all()
    working_days = [r.day_of_week for r in wd_rows if r.is_working] if wd_rows else [1, 2, 3, 4, 5]
    
    formatted_periods = []
    for p in periods:
        lbl = p.break_name if p.is_break and p.break_name else f"Period {p.number}"
        formatted_periods.append({
            "id": str(p.id),
            "number": p.number,
            "start_time": format_time_str(p.start_time),
            "end_time": format_time_str(p.end_time),
            "is_break": p.is_break,
            "break_name": p.break_name,
            "label": lbl,
        })
        
    return {
        "configuration": {
            "id": str(conf.id),
            "name": conf.name,
            "is_default": conf.is_default,
            "college_id": str(conf.college_id),
        },
        "working_days": sorted(working_days),
        "periods": formatted_periods
    }

@router.post("/save-full-schedule")
async def save_full_schedule(
    payload: FullSchedulePayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import PeriodConfiguration, Period, WorkingDay
    cid = payload.college_id or current_user.get("college_id")
    if not cid:
        raise ConflictError("College ID is required")
        
    # 1. Update working days
    await db.execute(delete(WorkingDay).where(WorkingDay.college_id == cid))
    for d in payload.working_days:
        db.add(WorkingDay(college_id=cid, day_of_week=d, is_working=True))
        
    # 2. Get or create PeriodConfiguration
    conf = None
    if payload.configuration_id:
        c_res = await db.execute(select(PeriodConfiguration).where(PeriodConfiguration.id == payload.configuration_id))
        conf = c_res.scalar_one_or_none()
        
    if not conf:
        c_res = await db.execute(select(PeriodConfiguration).where(PeriodConfiguration.college_id == cid).order_by(PeriodConfiguration.is_default.desc()))
        conf = c_res.scalars().first()
        
    if not conf:
        conf = PeriodConfiguration(
            college_id=cid,
            name=payload.configuration_name or "Standard Bell Schedule",
            is_default=True,
        )
        db.add(conf)
        await db.flush()
    else:
        if payload.configuration_name:
            conf.name = payload.configuration_name
            
    # 3. Replace periods
    await db.execute(delete(Period).where(Period.configuration_id == conf.id))
    
    for idx, p in enumerate(payload.periods, start=1):
        num = p.number or p.period_number or idx
        brk_name = p.break_name or p.label if p.is_break else None
        db.add(Period(
            configuration_id=conf.id,
            number=num,
            start_time=parse_time_str(p.start_time),
            end_time=parse_time_str(p.end_time),
            is_break=p.is_break,
            break_name=brk_name,
        ))
        
    await db.commit()
    await db.refresh(conf)
    return {"message": "Full schedule (working days and periods) saved successfully", "configuration_id": str(conf.id)}

@router.get("/configurations/{id}")
async def get_period_configuration(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import PeriodConfiguration, Period
    query = select(PeriodConfiguration).where(PeriodConfiguration.id == id)
    result = await db.execute(query)
    conf = result.scalar_one_or_none()
    if not conf:
        raise DataNotFoundError("Configuration not found")
        
    p_query = select(Period).where(Period.configuration_id == id).order_by(Period.number)
    p_res = await db.execute(p_query)
    periods = p_res.scalars().all()
    
    formatted_periods = [
        {
            "id": str(p.id),
            "number": p.number,
            "start_time": format_time_str(p.start_time),
            "end_time": format_time_str(p.end_time),
            "is_break": p.is_break,
            "break_name": p.break_name,
            "label": p.break_name if p.is_break and p.break_name else f"Period {p.number}",
        }
        for p in periods
    ]
    
    return {
        "id": str(conf.id),
        "name": conf.name,
        "is_default": conf.is_default,
        "college_id": str(conf.college_id),
        "periods": formatted_periods
    }

@router.patch("/configurations/{id}")
async def update_period_configuration(
    id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import PeriodConfiguration
    query = select(PeriodConfiguration).where(PeriodConfiguration.id == id)
    result = await db.execute(query)
    conf = result.scalar_one_or_none()
    if not conf:
        raise DataNotFoundError("Configuration not found")
    for k, v in data.items():
        if hasattr(conf, k):
            setattr(conf, k, v)
    await db.commit()
    await db.refresh(conf)
    return conf

@router.delete("/configurations/{id}")
async def delete_period_configuration(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import PeriodConfiguration
    query = select(PeriodConfiguration).where(PeriodConfiguration.id == id)
    result = await db.execute(query)
    conf = result.scalar_one_or_none()
    if not conf:
        raise DataNotFoundError("Configuration not found")
    await db.delete(conf)
    await db.commit()
    return {"message": "Configuration deleted successfully"}

@router.get("/configurations/{id}/periods")
async def list_periods_in_order(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Period
    query = select(Period).where(Period.configuration_id == id).order_by(Period.number)
    result = await db.execute(query)
    periods = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "number": p.number,
            "start_time": format_time_str(p.start_time),
            "end_time": format_time_str(p.end_time),
            "is_break": p.is_break,
            "break_name": p.break_name,
            "label": p.break_name if p.is_break and p.break_name else f"Period {p.number}",
        }
        for p in periods
    ]

@router.post("/configurations/{id}/periods")
async def add_period(
    id: str,
    data: PeriodItem,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Period
    try:
        num = data.number or data.period_number or 1
        brk_name = data.break_name or data.label if data.is_break else None
        new_period = Period(
            configuration_id=id,
            number=num,
            start_time=parse_time_str(data.start_time),
            end_time=parse_time_str(data.end_time),
            is_break=data.is_break,
            break_name=brk_name,
        )
        db.add(new_period)
        await db.commit()
        await db.refresh(new_period)
        return {
            "id": str(new_period.id),
            "number": new_period.number,
            "start_time": format_time_str(new_period.start_time),
            "end_time": format_time_str(new_period.end_time),
            "is_break": new_period.is_break,
            "break_name": new_period.break_name,
            "label": new_period.break_name if new_period.is_break and new_period.break_name else f"Period {new_period.number}",
        }
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Period conflict (possibly duplicate number).")

@router.patch("/configurations/{id}/periods/{period_id}")
async def update_period(
    id: str,
    period_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Period
    query = select(Period).where(Period.id == period_id, Period.configuration_id == id)
    result = await db.execute(query)
    period = result.scalar_one_or_none()
    
    if not period:
        raise DataNotFoundError("Period not found")
        
    for k, v in data.items():
        if k in ("start_time", "end_time"):
            setattr(period, k, parse_time_str(v))
        elif k in ("number", "period_number"):
            period.number = int(v)
        elif k in ("break_name", "label"):
            period.break_name = str(v) if v else None
        elif hasattr(period, k):
            setattr(period, k, v)
        
    try:
        await db.commit()
        await db.refresh(period)
        return {
            "id": str(period.id),
            "number": period.number,
            "start_time": format_time_str(period.start_time),
            "end_time": format_time_str(period.end_time),
            "is_break": period.is_break,
            "break_name": period.break_name,
            "label": period.break_name if period.is_break and period.break_name else f"Period {period.number}",
        }
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Period update conflict.")

@router.delete("/configurations/{id}/periods/{period_id}")
async def delete_period(
    id: str,
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Period
    query = select(Period).where(Period.id == period_id, Period.configuration_id == id)
    result = await db.execute(query)
    period = result.scalar_one_or_none()
    
    if not period:
        raise DataNotFoundError("Period not found")
        
    await db.delete(period)
    await db.commit()
    return {"message": "Period deleted successfully"}
