"""Classes CRUD + class-subject assignment."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, Literal

from app.db.session import get_db
from app.models.models import Class, ClassSubject, FacultySubject, Subject, Faculty, Department, TimetableEntry
from app.core.security import get_current_user, require_hod_or_above

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────
class ClassCreate(BaseModel):
    department_id: str
    year: int
    semester: int
    section: str = "A"


class ClassSetup(BaseModel):
    department_id: str
    semester_cycle: Literal["odd", "even", "both"] = "both"
    sections_by_year: dict[int, int]
    confirm_removals: bool = False


class ClassSubjectAssign(BaseModel):
    subject_id: str
    faculty_id: Optional[str] = None
    periods_per_week: Optional[int] = None


class ClassSubjectOut(BaseModel):
    id: str
    subject_id: str
    subject_name: str
    subject_code: str
    subject_type: str
    periods_per_week: int
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None


class ClassOut(BaseModel):
    id: str
    department_id: str
    department_name: Optional[str] = None
    year: int
    semester: int
    section: str
    subjects: list[ClassSubjectOut] = []

    model_config = {"from_attributes": True}


async def _initialize_class_subjects_from_catalog(db: AsyncSession, class_: Class) -> int:
    """Copy the existing department/year/semester curriculum into an empty class."""
    result = await db.execute(
        select(Subject)
        .where(
            Subject.department_id == class_.department_id,
            Subject.year == class_.year,
            Subject.semester == class_.semester,
        )
        .order_by(Subject.code, Subject.name)
    )
    subjects = result.scalars().all()
    for subject in subjects:
        eligible_result = await db.execute(
            select(FacultySubject.faculty_id)
            .where(FacultySubject.subject_id == subject.id)
            .order_by(FacultySubject.id)
            .limit(1)
        )
        db.add(ClassSubject(
            id=str(uuid.uuid4()),
            class_id=class_.id,
            subject_id=subject.id,
            faculty_id=eligible_result.scalar_one_or_none(),
            periods_per_week=subject.periods_per_week,
        ))
    return len(subjects)


# ─── Routes ────────────────────────────────────────────────
@router.get("", response_model=list[ClassOut])
async def list_classes(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Class).options(
        selectinload(Class.department),
        selectinload(Class.class_subjects).selectinload(ClassSubject.subject),
        selectinload(Class.class_subjects).selectinload(ClassSubject.faculty),
    )
    if department_id:
        q = q.where(Class.department_id == department_id)
    result = await db.execute(q.order_by(Class.year, Class.semester, Class.section))
    classes = result.scalars().all()

    out = []
    for c in classes:
        subjs = [
            ClassSubjectOut(
                id=cs.id,
                subject_id=cs.subject_id,
                subject_name=cs.subject.name if cs.subject else "",
                subject_code=cs.subject.code if cs.subject else "",
                subject_type=cs.subject.type.value if cs.subject else "theory",
                periods_per_week=cs.periods_per_week if cs.periods_per_week is not None else (cs.subject.periods_per_week if cs.subject else 0),
                faculty_id=cs.faculty_id,
                faculty_name=cs.faculty.name if cs.faculty else None,
            )
            for cs in c.class_subjects
        ]
        out.append(ClassOut(
            id=c.id,
            department_id=c.department_id,
            department_name=c.department.name if c.department else None,
            year=c.year,
            semester=c.semester,
            section=c.section,
            subjects=subjs,
        ))
    return out


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(body: ClassCreate, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    dept = await db.get(Department, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    normalized_section = body.section.upper()
    existing = await db.execute(select(Class.id).where(
        Class.department_id == body.department_id,
        Class.year == body.year,
        Class.semester == body.semester,
        Class.section == normalized_section,
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Year {body.year}, Semester {body.semester}, Section {normalized_section} already exists for {dept.name}.",
        )
    c = Class(
        id=str(uuid.uuid4()),
        department_id=body.department_id,
        year=body.year,
        semester=body.semester,
        section=normalized_section,
    )
    db.add(c)
    await _initialize_class_subjects_from_catalog(db, c)
    await db.commit()
    return await get_class(c.id, db, None)


@router.post("/setup")
async def save_class_setup(body: ClassSetup, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    """Match a department's class sections to its saved year counts."""
    dept = await db.get(Department, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if any(year not in {1, 2, 3, 4} for year in body.sections_by_year):
        raise HTTPException(status_code=422, detail="Year keys must be between 1 and 4")
    if any(count < 0 or count > 26 for count in body.sections_by_year.values()):
        raise HTTPException(status_code=422, detail="Section counts must be between 0 and 26")

    existing_rows = await db.execute(select(Class).where(Class.department_id == body.department_id))
    existing_classes = existing_rows.scalars().all()
    semesters_for_year = lambda year: ([year * 2 - 1] if body.semester_cycle == "odd" else [year * 2] if body.semester_cycle == "even" else [year * 2 - 1, year * 2])
    new_classes = []
    removed_classes = []
    target_keys = set()
    for year in (4, 3, 2, 1):
        count = body.sections_by_year.get(year, 0)
        for semester in semesters_for_year(year):
            for index in range(count):
                section = chr(ord("A") + index)
                target_keys.add((year, semester, section))
                if not any(item.year == year and item.semester == semester and item.section.upper() == section for item in existing_classes):
                    new_classes.append(Class(
                        id=str(uuid.uuid4()), department_id=body.department_id,
                        year=year, semester=semester, section=section,
                    ))
    selected_semesters = {semester for year in (1, 2, 3, 4) for semester in semesters_for_year(year)}
    removed_classes = [item for item in existing_classes if item.semester in selected_semesters and (item.year, item.semester, item.section.upper()) not in target_keys]
    if removed_classes and not body.confirm_removals:
        return {
            "confirmation_required": True,
            "classes_to_remove": [
                {"id": item.id, "year": item.year, "semester": item.semester, "section": item.section}
                for item in removed_classes
            ],
        }
    if removed_classes:
        removed_ids = [item.id for item in removed_classes]
        await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(removed_ids)))
        await db.execute(delete(ClassSubject).where(ClassSubject.class_id.in_(removed_ids)))
        await db.execute(delete(Class).where(Class.id.in_(removed_ids)))
    if new_classes:
        db.add_all(new_classes)

    removed_ids = {item.id for item in removed_classes}
    classes_to_initialize = [
        item for item in existing_classes
        if item.id not in removed_ids
        and (item.year, item.semester, item.section.upper()) in target_keys
    ] + new_classes
    initialized_allocations = 0
    for class_ in classes_to_initialize:
        allocation_result = await db.execute(
            select(ClassSubject.id).where(ClassSubject.class_id == class_.id).limit(1)
        )
        if allocation_result.scalar_one_or_none() is None:
            initialized_allocations += await _initialize_class_subjects_from_catalog(db, class_)

    if removed_classes or new_classes or initialized_allocations:
        await db.commit()
    return {
        "department_id": body.department_id,
        "semester_cycle": body.semester_cycle,
        "classes_created": len(new_classes),
        "classes_removed": len(removed_classes),
        "classes_preserved": len(existing_classes) - len(removed_classes),
        "sections_by_year": body.sections_by_year,
    }


@router.get("/{class_id}", response_model=ClassOut)
async def get_class(class_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Class).where(Class.id == class_id).options(
            selectinload(Class.department),
            selectinload(Class.class_subjects).selectinload(ClassSubject.subject),
            selectinload(Class.class_subjects).selectinload(ClassSubject.faculty),
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    subjs = [
        ClassSubjectOut(
            id=cs.id,
            subject_id=cs.subject_id,
            subject_name=cs.subject.name if cs.subject else "",
            subject_code=cs.subject.code if cs.subject else "",
            subject_type=cs.subject.type.value if cs.subject else "theory",
            periods_per_week=cs.periods_per_week if cs.periods_per_week is not None else (cs.subject.periods_per_week if cs.subject else 0),
            faculty_id=cs.faculty_id,
            faculty_name=cs.faculty.name if cs.faculty else None,
        )
        for cs in c.class_subjects
    ]
    return ClassOut(
        id=c.id, department_id=c.department_id,
        department_name=c.department.name if c.department else None,
        year=c.year, semester=c.semester, section=c.section, subjects=subjs,
    )


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(class_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    c = await db.get(Class, class_id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    # Timetable entries require a class_id. Delete generated periods and class
    # subject assignments before removing the class to avoid NULL foreign keys.
    await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id == class_id))
    await db.execute(delete(ClassSubject).where(ClassSubject.class_id == class_id))
    await db.execute(delete(Class).where(Class.id == class_id))
    await db.commit()


@router.post("/{class_id}/subjects", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def assign_subjects_to_class(
    class_id: str,
    body: list[ClassSubjectAssign],
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    """Replace all subject-faculty assignments for a class."""
    c = await db.get(Class, class_id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    affected_class_ids = select(Class.id).where(
        Class.department_id == c.department_id,
        Class.semester % 2 == c.semester % 2,
    )
    await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(affected_class_ids)))
    await db.execute(delete(ClassSubject).where(ClassSubject.class_id == class_id))
    for item in body:
        s = await db.get(Subject, item.subject_id)
        if not s:
            continue
        db.add(ClassSubject(
            id=str(uuid.uuid4()),
            class_id=class_id,
            subject_id=item.subject_id,
            faculty_id=item.faculty_id,
            periods_per_week=item.periods_per_week,
        ))
    await db.commit()
    return await get_class(class_id, db)
