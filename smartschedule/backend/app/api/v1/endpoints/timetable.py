"""Timetable endpoint — generate, view master, view faculty, manual edit."""
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import (
    Class, ClassSubject, FacultySubject, TimetableEntry, Subject, Faculty, Department, WorkspaceSettings
)
from app.core.security import get_current_user, require_hod_or_above

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────
class GenerateRequest(BaseModel):
    department_id: str
    year: Optional[int] = None       # None = all years in dept
    semester: Optional[int] = None
    section: Optional[str] = None
    # In the semester-by-semester workflow, only these earlier semesters are
    # treated as fixed allocation references.  This keeps odd and even cycles
    # independent and avoids a later semester constraining an earlier one when
    # the earlier stage is regenerated.
    reference_semesters: Optional[list[int]] = None


class EntryOut(BaseModel):
    id: str
    class_id: str
    class_label: str
    subject_id: str
    subject_name: str
    subject_code: str
    subject_type: str
    faculty_id: Optional[str]
    faculty_name: Optional[str]
    day: int
    period: int
    is_locked: bool

    model_config = {"from_attributes": True}


class EntryEdit(BaseModel):
    day: Optional[int] = None
    period: Optional[int] = None
    faculty_id: Optional[str] = None
    subject_id: Optional[str] = None
    is_locked: Optional[bool] = None


class ManualEntryCreate(BaseModel):
    class_id: str
    subject_id: str
    day: int
    period: int


class GenerateResponse(BaseModel):
    status: str
    message: str
    entries_created: int
    elapsed_seconds: float


# ─── Helpers ────────────────────────────────────────────────
def _class_label(c: Class) -> str:
    dept = c.department.code if c.department else "?"
    return f"{dept} Yr{c.year} Sem{c.semester}"


def _faculty_busy_message(faculty_name: str, clash: TimetableEntry, day: int, period: int) -> str:
    day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
    class_label = _class_label(clash.class_) if clash.class_ else "another class"
    return (
        f"{faculty_name} is attending {class_label} on {day_name}, Period {period}. "
        "Choose another free period or another faculty member."
    )


async def _get_entries(
    db: AsyncSession,
    class_ids: Optional[list[str]] = None,
    faculty_id: Optional[str] = None,
    semester_cycle: Optional[str] = None,
) -> list[EntryOut]:
    q = select(TimetableEntry).options(
        selectinload(TimetableEntry.class_).selectinload(Class.department),
        selectinload(TimetableEntry.subject),
        selectinload(TimetableEntry.faculty),
    )
    if class_ids is not None:
        q = q.where(TimetableEntry.class_id.in_(class_ids))
    if faculty_id is not None:
        q = q.where(TimetableEntry.faculty_id == faculty_id)
    if semester_cycle is not None:
        parity = 1 if semester_cycle == "odd" else 0
        q = q.join(Class, Class.id == TimetableEntry.class_id).where(Class.semester % 2 == parity)
    result = await db.execute(q.order_by(TimetableEntry.day, TimetableEntry.period))
    entries = result.scalars().all()
    return [
        EntryOut(
            id=e.id,
            class_id=e.class_id,
            class_label=_class_label(e.class_) if e.class_ else e.class_id,
            subject_id=e.subject_id,
            subject_name=e.subject.name if e.subject else "",
            subject_code=e.subject.code if e.subject else "",
            subject_type=e.subject.type.value if e.subject else "theory",
            faculty_id=e.faculty_id,
            faculty_name=e.faculty.name if e.faculty else None,
            day=e.day,
            period=e.period,
            is_locked=e.is_locked,
        )
        for e in entries
    ]


# ─── Routes ────────────────────────────────────────────────
@router.post("/generate", response_model=GenerateResponse)
async def generate_timetable(
    req: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above()),
):
    """Run the CP-SAT solver for the given filter and store results."""
    # Validate workflow references before doing database work. A stage may use
    # only earlier stages from its own odd/even cycle.
    reference_semesters = req.reference_semesters
    if reference_semesters is None and req.semester is not None:
        reference_semesters = [
            semester for semester in range(1, req.semester)
            if semester % 2 == req.semester % 2
        ]
    elif reference_semesters is not None and req.semester is not None:
        invalid_references = sorted({
            semester for semester in reference_semesters
            if semester < 1
            or semester > 8
            or semester >= req.semester
            or semester % 2 != req.semester % 2
        })
        if invalid_references:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Reference semesters must be earlier semesters in the same "
                    f"odd/even cycle. Invalid values: {invalid_references}"
                ),
            )
        reference_semesters = sorted(set(reference_semesters))

    # Import here to avoid circular at startup
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

    try:
        from scheduler.engine import generate_timetable as run_solver, ClassInput, SubjectInput
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Timetable solver is unavailable: {exc.name or 'missing dependency'}",
        )

    # 1. Fetch matching classes
    q = select(Class).where(Class.department_id == req.department_id).options(
        selectinload(Class.department),
        selectinload(Class.class_subjects).selectinload(ClassSubject.subject),
        selectinload(Class.class_subjects).selectinload(ClassSubject.faculty),
    )
    if req.year is not None:
        q = q.where(Class.year == req.year)
    if req.semester is not None:
        q = q.where(Class.semester == req.semester)
    if req.section is not None:
        q = q.where(Class.section == req.section.upper())
    result = await db.execute(q)
    classes = result.scalars().all()

    if not classes:
        raise HTTPException(status_code=404, detail="No classes found for the given filters")

    # Enforce the selected academic cycle on the server as well as in the UI.
    # Semester 3/5/7 must follow 1, and semester 4/6/8 must follow 2. A caller
    # cannot skip a stage or use an opposite-cycle timetable as a reference.
    if req.semester is not None:
        required_references = [
            semester for semester in range(1, req.semester)
            if semester % 2 == req.semester % 2
        ]
        if set(reference_semesters or []) != set(required_references):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Generate this workflow in order. Semester {req.semester} "
                    f"requires completed semesters {required_references or 'none'}."
                ),
            )
        if required_references:
            completed_result = await db.execute(
                select(Class.semester)
                .join(TimetableEntry, TimetableEntry.class_id == Class.id)
                .where(
                    Class.department_id == req.department_id,
                    Class.semester.in_(required_references),
                )
                .distinct()
            )
            completed_references = {semester for semester, in completed_result.all()}
            missing_references = [
                semester for semester in required_references
                if semester not in completed_references
            ]
            if missing_references:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Complete Semester {missing_references[0]} before generating "
                        f"Semester {req.semester}. Odd and even workflows are independent."
                    ),
                )

    # The streamlined UI manages subjects at department level. For a new class,
    # create its initial subject/faculty assignments from that department's
    # eligible faculty mappings before running the solver.
    assignments_added = False
    for c in classes:
        if c.class_subjects:
            continue
        subject_result = await db.execute(
            select(Subject).where(
                Subject.department_id == c.department_id,
                Subject.year == c.year,
                Subject.semester == c.semester,
            ).order_by(Subject.name)
        )
        department_subjects = subject_result.scalars().all()
        if not department_subjects:
            raise HTTPException(
                status_code=400,
                detail=f"Class '{_class_label(c)}' has no subjects for Year {c.year}, Semester {c.semester}. Add semester subjects first.",
            )
        for subject in department_subjects:
            faculty_result = await db.execute(
                select(FacultySubject)
                .where(FacultySubject.subject_id == subject.id)
                .order_by(FacultySubject.id)
            )
            eligible = faculty_result.scalars().first()
            if not eligible:
                raise HTTPException(
                    status_code=400,
                    detail=f"Assign an eligible faculty member to subject '{subject.name}' before generating.",
                )
            db.add(ClassSubject(
                id=str(uuid.uuid4()),
                class_id=c.id,
                subject_id=subject.id,
                faculty_id=eligible.faculty_id,
            ))
            assignments_added = True

    if assignments_added:
        # Keep automatically created mappings in the same transaction as the
        # generated timetable. A failed solve must not leave partial setup.
        await db.flush()
        db.expire_all()
        result = await db.execute(q)
        classes = result.scalars().all()

    # Validate: each class must have at least one subject with a faculty assigned
    for c in classes:
        if not c.class_subjects:
            raise HTTPException(
                status_code=400,
                detail=f"Class '{_class_label(c)}' has no subjects assigned. Add subjects first."
            )
        for cs in c.class_subjects:
            if not cs.faculty_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Subject '{cs.subject.name if cs.subject else cs.subject_id}' in class '{_class_label(c)}' has no faculty assigned."
                )
            if cs.faculty and cs.faculty.department_id != c.department_id:
                home_schedule_exists = (await db.execute(
                    select(TimetableEntry.id)
                    .join(Class, Class.id == TimetableEntry.class_id)
                    .where(
                        TimetableEntry.faculty_id == cs.faculty_id,
                        Class.department_id == cs.faculty.department_id,
                        Class.semester % 2 == c.semester % 2,
                    )
                    .limit(1)
                )).scalar_one_or_none()
                if not home_schedule_exists:
                    home_department = await db.get(Department, cs.faculty.department_id)
                    cycle = "odd" if c.semester % 2 else "even"
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Generate {home_department.code if home_department else 'the faculty home department'} "
                            f"{cycle}-semester timetable first. {cs.faculty.name}'s home timetable must be "
                            "fixed before assigning their free periods to another department."
                        ),
                    )

    # 2. Build solver input
    class_inputs = [
        ClassInput(
            class_id=c.id,
            class_label=_class_label(c),
            subjects=[
                SubjectInput(
                    subject_id=cs.subject_id,
                    subject_name=cs.subject.name if cs.subject else "",
                    subject_type=cs.subject.type.value if cs.subject else "theory",
                    periods_per_week=cs.subject.periods_per_week if cs.subject else 4,
                    lab_block_size=cs.subject.lab_block_size if cs.subject else 2,
                    faculty_id=cs.faculty_id,
                    faculty_name=cs.faculty.name if cs.faculty else None,
                )
                for cs in c.class_subjects
            ],
        )
        for c in classes
    ]

    # Reserve faculty periods only from earlier stages in the selected cycle.
    # Odd and even timetables are separate academic terms.
    class_ids = [c.id for c in classes]
    blocking_semesters = set(reference_semesters or [])

    occupied_query = (
        select(TimetableEntry.faculty_id, TimetableEntry.day, TimetableEntry.period)
        .join(Class, Class.id == TimetableEntry.class_id)
        .where(
            TimetableEntry.faculty_id.is_not(None),
            ~TimetableEntry.class_id.in_(class_ids),
        )
    )
    if req.semester is not None:
        # Shared faculty must not be double-booked across departments. Odd and
        # even semester cycles are separate academic terms.
        occupied_query = occupied_query.where(Class.semester % 2 == req.semester % 2)

    occupied_result = await db.execute(occupied_query)
    occupied_rows = occupied_result.all()
    blocked_faculty_slots = {
        (faculty_id, day, period)
        for faculty_id, day, period in occupied_rows
        if faculty_id is not None
    }

    # 3. Run solver
    settings_record = await db.get(WorkspaceSettings, "default")
    saved_settings = json.loads(settings_record.settings_json or "{}") if settings_record else {}
    timetable_settings = saved_settings.get("timetable", {})
    configured_working_days = timetable_settings.get("workingDays", [1, 2, 3, 4, 5])
    available_days = [day - 1 for day in configured_working_days if 1 <= day <= 6] or list(range(5))
    periods_per_day = max(1, min(12, int(timetable_settings.get("periodsPerDay", 7))))
    weekly_capacity = len(available_days) * periods_per_day

    # Reject impossible class and faculty workloads before asking CP-SAT to
    # solve. Workload is cycle-aware: Odd and Even semesters are separate
    # academic terms, while departments in the same cycle share faculty.
    target_faculty_workload: dict[str, int] = {}
    for class_input in class_inputs:
        class_total = sum(subject.periods_per_week for subject in class_input.subjects)
        if class_total > weekly_capacity:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{class_input.class_label} requires {class_total} periods but only "
                    f"{weekly_capacity} weekly slots are configured. Reduce subject periods."
                ),
            )
        for subject in class_input.subjects:
            if subject.faculty_id:
                target_faculty_workload[subject.faculty_id] = (
                    target_faculty_workload.get(subject.faculty_id, 0)
                    + subject.periods_per_week
                )

    occupied_counts: dict[tuple[str, int, int], int] = {}
    for faculty_id, day, period in occupied_rows:
        if faculty_id in target_faculty_workload:
            key = (faculty_id, day, period)
            occupied_counts[key] = occupied_counts.get(key, 0) + 1
    existing_duplicate = next((key for key, count in occupied_counts.items() if count > 1), None)
    if existing_duplicate:
        faculty = await db.get(Faculty, existing_duplicate[0])
        raise HTTPException(
            status_code=409,
            detail=(
                f"{faculty.name if faculty else 'Faculty'} already has conflicting "
                "classes in this semester cycle. Resolve the existing timetable first."
            ),
        )

    occupied_by_faculty: dict[str, int] = {}
    for faculty_id, _day, _period in blocked_faculty_slots:
        if faculty_id in target_faculty_workload:
            occupied_by_faculty[faculty_id] = occupied_by_faculty.get(faculty_id, 0) + 1
    for faculty_id, required in target_faculty_workload.items():
        occupied = occupied_by_faculty.get(faculty_id, 0)
        if occupied + required > weekly_capacity:
            faculty = await db.get(Faculty, faculty_id)
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{faculty.name if faculty else 'Faculty'} requires {required} new periods "
                    f"and already has {occupied} occupied slots in this semester cycle, "
                    f"but only {weekly_capacity} slots are available. Reassign at least "
                    f"{occupied + required - weekly_capacity} periods."
                ),
            )

    schedule = run_solver(
        class_inputs,
        blocked_faculty_slots=blocked_faculty_slots,
        available_days=available_days,
        available_periods=list(range(1, periods_per_day + 1)),
    )

    if schedule.status == "INFEASIBLE":
        raise HTTPException(status_code=422, detail=schedule.message)
    if schedule.status == "ERROR":
        raise HTTPException(status_code=500, detail=schedule.message)

    # Final safety gate: never persist a faculty collision, even if a caller
    # races another generation request or solver input becomes stale.
    generated_faculty_slots: set[tuple[str, int, int]] = set()
    for generated_entry in schedule.entries:
        if not generated_entry.faculty_id:
            continue
        slot = (generated_entry.faculty_id, generated_entry.day, generated_entry.period)
        if slot in blocked_faculty_slots:
            faculty = await db.get(Faculty, generated_entry.faculty_id)
            day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][generated_entry.day]
            raise HTTPException(
                status_code=409,
                detail=(
                    f"{faculty.name if faculty else 'Faculty'} is attending another class on "
                    f"{day_name}, Period {generated_entry.period}. Regenerate using the latest faculty timetable."
                ),
            )
        if slot in generated_faculty_slots:
            faculty = await db.get(Faculty, generated_entry.faculty_id)
            raise HTTPException(
                status_code=409,
                detail=f"{faculty.name if faculty else 'Faculty'} was allocated to two generated classes in the same period.",
            )
        generated_faculty_slots.add(slot)

    # A regenerated stage may choose different faculty periods. Any later
    # later stage in the same cycle calculated from old reservations is stale.
    if req.semester is not None:
        later_class_ids = select(Class.id).where(
            Class.department_id == req.department_id,
            Class.semester > req.semester,
            Class.semester % 2 == req.semester % 2,
        )
        await db.execute(
            delete(TimetableEntry).where(
                TimetableEntry.class_id.in_(later_class_ids),
                TimetableEntry.is_locked == False,
            )
        )

    # 4. Delete existing (unlocked) entries for these classes, then insert new ones
    await db.execute(
        delete(TimetableEntry).where(
            TimetableEntry.class_id.in_(class_ids),
            TimetableEntry.is_locked == False,
        )
    )

    for entry in schedule.entries:
        db.add(TimetableEntry(
            id=str(uuid.uuid4()),
            class_id=entry.class_id,
            subject_id=entry.subject_id,
            faculty_id=entry.faculty_id,
            day=entry.day,
            period=entry.period,
            is_locked=False,
        ))

    # Validate the database state produced by the transaction, not only the
    # in-memory solver result. This protects against stale inputs and future
    # solver regressions. Only the active Odd/Even cycle is compared.
    await db.flush()
    impacted_faculty_ids = list(target_faculty_workload)
    if impacted_faculty_ids and req.semester is not None:
        collision_result = await db.execute(
            select(
                TimetableEntry.faculty_id,
                TimetableEntry.day,
                TimetableEntry.period,
                func.count(TimetableEntry.id).label("entry_count"),
            )
            .join(Class, Class.id == TimetableEntry.class_id)
            .where(
                TimetableEntry.faculty_id.in_(impacted_faculty_ids),
                Class.semester % 2 == req.semester % 2,
            )
            .group_by(TimetableEntry.faculty_id, TimetableEntry.day, TimetableEntry.period)
            .having(func.count(TimetableEntry.id) > 1)
            .limit(1)
        )
        collision = collision_result.first()
        if collision:
            await db.rollback()
            faculty = await db.get(Faculty, collision.faculty_id)
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Master validation blocked the save: {faculty.name if faculty else 'Faculty'} "
                    f"has multiple classes on day {collision.day + 1}, Period {collision.period}."
                ),
            )

    await db.commit()

    return GenerateResponse(
        status=schedule.status,
        message=schedule.message,
        entries_created=len(schedule.entries),
        elapsed_seconds=round(schedule.elapsed_seconds, 2),
    )


@router.get("/master", response_model=list[EntryOut])
async def master_timetable(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    """Return all timetable entries (optionally filtered by department)."""
    if department_id:
        # Get class IDs for this department
        result = await db.execute(select(Class.id).where(Class.department_id == department_id))
        class_ids = [r for r, in result.all()]
        return await _get_entries(db, class_ids=class_ids)
    return await _get_entries(db)


@router.get("/class/{class_id}", response_model=list[EntryOut])
async def class_timetable(
    class_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return timetable entries for one class."""
    class_ = await db.get(Class, class_id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    return await _get_entries(db, class_ids=[class_id])


@router.get("/unassigned")
async def unassigned_faculty_slots(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return class-subject assignments that do not yet have a faculty member."""
    result = await db.execute(
        select(ClassSubject)
        .where(ClassSubject.faculty_id.is_(None))
        .options(selectinload(ClassSubject.subject), selectinload(ClassSubject.class_))
    )
    return [
        {
            "id": item.id,
            "class_id": item.class_id,
            "subject_id": item.subject_id,
            "subject_name": item.subject.name if item.subject else "",
        }
        for item in result.scalars().all()
    ]


@router.get("/faculty/{faculty_id}", response_model=list[EntryOut])
async def faculty_timetable(
    faculty_id: str,
    semester_cycle: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return a faculty timetable, optionally filtered to odd or even semesters."""
    f = await db.get(Faculty, faculty_id)
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    if semester_cycle not in (None, "odd", "even"):
        raise HTTPException(status_code=400, detail="semester_cycle must be 'odd' or 'even'")
    return await _get_entries(db, faculty_id=faculty_id, semester_cycle=semester_cycle)


@router.put("/entry/{entry_id}", response_model=EntryOut)
async def edit_entry(
    entry_id: str,
    body: EntryEdit,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    """Manually edit a timetable entry with conflict re-validation."""
    result = await db.execute(
        select(TimetableEntry).where(TimetableEntry.id == entry_id)
        .options(
            selectinload(TimetableEntry.class_).selectinload(Class.department),
            selectinload(TimetableEntry.subject),
            selectinload(TimetableEntry.faculty),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.is_locked:
        raise HTTPException(status_code=400, detail="This entry is locked and cannot be edited")

    new_day = body.day if body.day is not None else entry.day
    new_period = body.period if body.period is not None else entry.period
    if new_day not in range(6) or new_period not in range(1, 8):
        raise HTTPException(status_code=400, detail="Day or period is outside the timetable grid")
    new_subject_id = body.subject_id if body.subject_id is not None else entry.subject_id
    assignment = None
    if new_subject_id != entry.subject_id:
        assignment = (await db.execute(select(ClassSubject).where(
            ClassSubject.class_id == entry.class_id,
            ClassSubject.subject_id == new_subject_id,
        ))).scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=400, detail="Choose a subject assigned to this class")
        subject = await db.get(Subject, new_subject_id)
        scheduled_count = (await db.execute(
            select(func.count()).select_from(TimetableEntry).where(
                TimetableEntry.class_id == entry.class_id,
                TimetableEntry.subject_id == new_subject_id,
                TimetableEntry.id != entry_id,
            )
        )).scalar_one()
        weekly_limit = subject.periods_per_week if subject else 0
        if scheduled_count >= weekly_limit:
            raise HTTPException(status_code=409, detail=f"{subject.name if subject else 'Subject'} already has its {weekly_limit} periods for this week")
    new_faculty_id = body.faculty_id if body.faculty_id is not None else (assignment.faculty_id if assignment else entry.faculty_id)

    # Conflict check: class slot
    if new_day != entry.day or new_period != entry.period:
        clash = await db.execute(
            select(TimetableEntry).where(
                TimetableEntry.class_id == entry.class_id,
                TimetableEntry.day == new_day,
                TimetableEntry.period == new_period,
                TimetableEntry.id != entry_id,
            )
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Class already has a subject in that slot")

    # Conflict check: faculty slot
    if new_faculty_id and (new_day != entry.day or new_period != entry.period or new_faculty_id != entry.faculty_id):
        clash = await db.execute(
            select(TimetableEntry).join(Class, Class.id == TimetableEntry.class_id).where(
                TimetableEntry.faculty_id == new_faculty_id,
                TimetableEntry.day == new_day,
                TimetableEntry.period == new_period,
                TimetableEntry.id != entry_id,
                Class.semester % 2 == entry.class_.semester % 2,
            ).options(
                selectinload(TimetableEntry.class_).selectinload(Class.department),
                selectinload(TimetableEntry.faculty),
            )
        )
        clash_entry = clash.scalar_one_or_none()
        if clash_entry:
            faculty_name = clash_entry.faculty.name if clash_entry.faculty else "Faculty"
            raise HTTPException(status_code=409, detail=_faculty_busy_message(faculty_name, clash_entry, new_day, new_period))

    entry.day = new_day
    entry.period = new_period
    entry.subject_id = new_subject_id
    entry.faculty_id = new_faculty_id
    if body.is_locked is not None:
        entry.is_locked = body.is_locked

    await db.commit()

    result2 = await db.execute(
        select(TimetableEntry).where(TimetableEntry.id == entry_id)
        .options(
            selectinload(TimetableEntry.class_).selectinload(Class.department),
            selectinload(TimetableEntry.subject),
            selectinload(TimetableEntry.faculty),
        )
    )
    updated = result2.scalar_one()
    return EntryOut(
        id=updated.id,
        class_id=updated.class_id,
        class_label=_class_label(updated.class_) if updated.class_ else updated.class_id,
        subject_id=updated.subject_id,
        subject_name=updated.subject.name if updated.subject else "",
        subject_code=updated.subject.code if updated.subject else "",
        subject_type=updated.subject.type.value if updated.subject else "theory",
        faculty_id=updated.faculty_id,
        faculty_name=updated.faculty.name if updated.faculty else None,
        day=updated.day,
        period=updated.period,
        is_locked=updated.is_locked,
    )


@router.post("/entry", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
async def create_manual_entry(
    body: ManualEntryCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    """Fill an empty timetable cell with a subject assigned to the class."""
    if body.day not in range(6) or body.period not in range(1, 8):
        raise HTTPException(status_code=400, detail="Day or period is outside the timetable grid")
    assignment = (await db.execute(
        select(ClassSubject).where(
            ClassSubject.class_id == body.class_id,
            ClassSubject.subject_id == body.subject_id,
        ).options(selectinload(ClassSubject.subject), selectinload(ClassSubject.faculty))
    )).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=400, detail="Choose a subject assigned to this class")
    scheduled_count = (await db.execute(
        select(func.count()).select_from(TimetableEntry).where(
            TimetableEntry.class_id == body.class_id,
            TimetableEntry.subject_id == body.subject_id,
        )
    )).scalar_one()
    weekly_limit = assignment.subject.periods_per_week if assignment.subject else 0
    if scheduled_count >= weekly_limit:
        raise HTTPException(status_code=409, detail=f"{assignment.subject.name if assignment.subject else 'Subject'} already has its {weekly_limit} periods for this week")
    occupied = (await db.execute(select(TimetableEntry).where(
        TimetableEntry.class_id == body.class_id,
        TimetableEntry.day == body.day,
        TimetableEntry.period == body.period,
    ))).scalar_one_or_none()
    if occupied:
        raise HTTPException(status_code=409, detail="This class already has a subject in that slot")
    class_ = (await db.execute(
        select(Class).where(Class.id == body.class_id).options(selectinload(Class.department))
    )).scalar_one_or_none()
    if assignment.faculty_id and class_:
        faculty_clash = (await db.execute(select(TimetableEntry).join(
            Class, Class.id == TimetableEntry.class_id,
        ).where(
            TimetableEntry.faculty_id == assignment.faculty_id,
            TimetableEntry.day == body.day,
            TimetableEntry.period == body.period,
            Class.semester % 2 == class_.semester % 2,
        ).options(
            selectinload(TimetableEntry.class_).selectinload(Class.department),
            selectinload(TimetableEntry.faculty),
        ))).scalar_one_or_none()
        if faculty_clash:
            faculty_name = faculty_clash.faculty.name if faculty_clash.faculty else "Faculty"
            raise HTTPException(
                status_code=409,
                detail=_faculty_busy_message(faculty_name, faculty_clash, body.day, body.period),
            )

    entry = TimetableEntry(
        id=str(uuid.uuid4()), class_id=body.class_id, subject_id=body.subject_id,
        faculty_id=assignment.faculty_id, day=body.day, period=body.period,
    )
    db.add(entry)
    subject_name = assignment.subject.name if assignment.subject else ""
    subject_code = assignment.subject.code if assignment.subject else ""
    subject_type = assignment.subject.type.value if assignment.subject else "theory"
    faculty_name = assignment.faculty.name if assignment.faculty else None
    await db.commit()
    return EntryOut(
        id=entry.id, class_id=entry.class_id,
        class_label=_class_label(class_) if class_ else entry.class_id,
        subject_id=entry.subject_id, subject_name=subject_name,
        subject_code=subject_code, subject_type=subject_type,
        faculty_id=entry.faculty_id,
        faculty_name=faculty_name,
        day=entry.day, period=entry.period, is_locked=False,
    )


@router.delete("/entry/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manual_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    entry = await db.get(TimetableEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    if entry.is_locked:
        raise HTTPException(status_code=400, detail="This entry is locked and cannot be removed")
    await db.delete(entry)
    await db.commit()


@router.delete("/class/{class_id}/entries")
async def clear_class_timetable(
    class_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    """Clear this class and later schedules that depend on its occupied slots."""
    class_ = await db.get(Class, class_id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    dependent_classes = await db.execute(
        select(Class.id).where(
            Class.department_id == class_.department_id,
            Class.semester % 2 == class_.semester % 2,
            Class.semester >= class_.semester,
        )
    )
    class_ids = list(dependent_classes.scalars().all())
    result = await db.execute(
        delete(TimetableEntry)
        .where(TimetableEntry.class_id.in_(class_ids))
        .returning(TimetableEntry.id)
    )
    deleted = len(result.scalars().all())
    await db.commit()
    return {
        "class_id": class_id,
        "classes_cleared": len(class_ids),
        "entries_deleted": deleted,
        "from_semester": class_.semester,
        "semester_cycle": "even" if class_.semester % 2 == 0 else "odd",
    }


@router.get("/stats")
async def timetable_stats(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Quick stats for dashboard."""
    from sqlalchemy import func
    dept_count = (await db.execute(select(func.count()).select_from(Department))).scalar()
    faculty_count = (await db.execute(select(func.count()).select_from(Faculty))).scalar()
    entry_count = (await db.execute(select(func.count()).select_from(TimetableEntry))).scalar()
    class_count = (await db.execute(select(func.count()).select_from(Class))).scalar()
    return {
        "departments": dept_count,
        "faculty": faculty_count,
        "classes": class_count,
        "timetable_entries": entry_count,
    }
