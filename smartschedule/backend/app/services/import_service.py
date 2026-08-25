"""
SmartSchedule — Import Service  
Handles Excel/CSV import for all entity types.
NEVER imports without explicit user confirmation.
"""
import io
import logging
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def import_faculty_rows(rows: list[dict], college_id: str, db: AsyncSession) -> tuple[int, list[str]]:
    """
    Import faculty rows from validated Excel/CSV data.
    Creates User records (without Supabase auth — admin must invite separately).
    Then creates Faculty records linked to users.
    Returns (imported_count, error_messages).
    """
    import uuid
    from app.models.user import User
    from app.models.faculty import Faculty
    from app.models.department import Department
    from sqlalchemy import select, and_

    imported = 0
    errors = []

    for row in rows:
        try:
            # Find department by code
            dept_result = await db.execute(
                select(Department).where(
                    and_(
                        Department.college_id == college_id,
                        Department.code == row.get('department_code', '').strip().upper()
                    )
                )
            )
            dept = dept_result.scalar_one_or_none()
            if not dept:
                errors.append(f"Department '{row.get('department_code')}' not found for row with employee_id '{row.get('employee_id')}'")
                continue

            # Check duplicate employee_id
            existing_faculty = await db.execute(
                select(Faculty).where(Faculty.employee_id == row.get('employee_id', '').strip())
            )
            if existing_faculty.scalar_one_or_none():
                errors.append(f"Faculty with employee_id '{row.get('employee_id')}' already exists")
                continue

            # Check duplicate email
            existing_user = await db.execute(
                select(User).where(User.email == row.get('email', '').strip().lower())
            )
            if existing_user.scalar_one_or_none():
                errors.append(f"User with email '{row.get('email')}' already exists")
                continue

            user_id = uuid.uuid4()
            user = User(
                id=user_id,
                email=row.get('email', '').strip().lower(),
                full_name=row.get('full_name', '').strip(),
                role='faculty',
                college_id=uuid.UUID(college_id),
                department_id=dept.id,
                employee_id=row.get('employee_id', '').strip(),
                is_active=True,
            )
            db.add(user)

            faculty = Faculty(
                id=uuid.uuid4(),
                user_id=user_id,
                department_id=dept.id,
                employee_id=row.get('employee_id', '').strip(),
                designation=row.get('designation', 'Lecturer').strip(),
                specialization=row.get('specialization', '').strip() or None,
                max_weekly_periods=int(row.get('max_weekly_periods', 18)),
                min_weekly_periods=int(row.get('min_weekly_periods', 0)),
                is_active=True,
            )
            db.add(faculty)
            imported += 1

        except Exception as e:
            errors.append(f"Row error (employee_id={row.get('employee_id', '?')}): {str(e)[:100]}")

    return imported, errors


async def import_subject_rows(rows: list[dict], department_id: str, db: AsyncSession) -> tuple[int, list[str]]:
    """Import subjects from validated data."""
    import uuid
    from app.models.subject import Subject
    from sqlalchemy import select
    
    imported = 0
    errors = []
    
    for row in rows:
        try:
            existing = await db.execute(
                select(Subject).where(Subject.code == row.get('code', '').strip().upper())
            )
            if existing.scalar_one_or_none():
                errors.append(f"Subject code '{row.get('code')}' already exists")
                continue

            subject = Subject(
                id=uuid.uuid4(),
                department_id=uuid.UUID(department_id),
                code=row.get('code', '').strip().upper(),
                name=row.get('name', '').strip(),
                subject_type=row.get('subject_type', 'theory').strip().lower(),
                credits=int(row.get('credits', 3)),
                weekly_periods=int(row.get('weekly_periods', 3)),
                lecture_periods=int(row.get('lecture_periods', 0)),
                tutorial_periods=int(row.get('tutorial_periods', 0)),
                practical_periods=int(row.get('practical_periods', 0)),
                semester_number=int(row.get('semester_number', 1)),
                requires_lab=str(row.get('requires_lab', 'false')).upper() == 'TRUE',
                requires_consecutive_periods=str(row.get('requires_consecutive', 'false')).upper() == 'TRUE',
                consecutive_count=int(row.get('consecutive_count', 2)),
            )
            db.add(subject)
            imported += 1
        except Exception as e:
            errors.append(f"Subject '{row.get('code', '?')}': {str(e)[:100]}")
    
    return imported, errors


async def import_room_rows(rows: list[dict], college_id: str, db: AsyncSession) -> tuple[int, list[str]]:
    """Import rooms from validated data."""
    import uuid
    from app.models.room import Room
    from sqlalchemy import select, and_
    
    imported = 0
    errors = []
    
    for row in rows:
        try:
            building = row.get('building', '').strip()
            room_number = row.get('room_number', '').strip()
            
            existing = await db.execute(
                select(Room).where(and_(
                    Room.college_id == college_id,
                    Room.building == building,
                    Room.room_number == room_number,
                ))
            )
            if existing.scalar_one_or_none():
                errors.append(f"Room '{building}/{room_number}' already exists")
                continue

            room = Room(
                id=uuid.uuid4(),
                college_id=uuid.UUID(college_id),
                building=building,
                room_number=room_number,
                display_name=row.get('display_name', '').strip() or f"{building}-{room_number}",
                capacity=int(row.get('capacity', 60)),
                has_projector=str(row.get('has_projector', 'false')).upper() == 'TRUE',
                has_ac=str(row.get('has_ac', 'false')).upper() == 'TRUE',
                available_days=[1, 2, 3, 4, 5],  # Mon-Fri default
                is_active=True,
            )
            db.add(room)
            imported += 1
        except Exception as e:
            errors.append(f"Room '{row.get('room_number', '?')}': {str(e)[:100]}")
    
    return imported, errors
