"""
SmartSchedule — Background Timetable Generation Job
Runs CP-SAT solver in a Celery worker process.
Updates job status in Redis at each stage.
Saves results to PostgreSQL via asyncio.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Job status keys in memory/Redis
_JOB_STORE: dict[str, dict] = {}


def update_job(job_id: str, status: str, stage: str, percent: int, message: str, result: dict | None = None):
    _JOB_STORE[job_id] = {
        'status': status,
        'progress_stage': stage,
        'progress_percent': percent,
        'message': message,
        'result': result,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }


def get_job(job_id: str) -> dict | None:
    return _JOB_STORE.get(job_id)


async def run_generation_job(
    job_id: str,
    department_id: str,
    semester_id: str,
    academic_year_id: str,
    user_id: str,
    version_name: str | None,
    time_limit_seconds: int = 300,
    preserve_locked: bool = True,
):
    """
    Full async generation pipeline:
    1. Validate data completeness
    2. Load solver input from DB
    3. Run CP-SAT engine  
    4. Persist results
    5. Calculate quality score
    """
    from app.db.session import AsyncSessionLocal
    from app.services.timetable_service import TimetableService
    from scheduler.engine import TimetableEngine, SolverInput, FacultyInput, SubjectInput, ClassInput, RoomInput, LabInput

    try:
        update_job(job_id, 'running', 'Initializing', 5, 'Starting generation...')

        async with AsyncSessionLocal() as db:
            service = TimetableService(db)

            # Stage 1: Validate
            update_job(job_id, 'running', 'Validating data', 15, 'Checking data completeness...')
            report = await service.validate_data_completeness(department_id, semester_id, academic_year_id)
            
            if not report.is_valid:
                error_msgs = [e['message'] for e in report.blocking_errors[:3]]
                update_job(
                    job_id, 'failed', 'Validation failed', 0,
                    f"Cannot generate: {'; '.join(error_msgs)}",
                    result={'success': False, 'blocking_errors': report.blocking_errors}
                )
                return

            # Stage 2: Load data
            update_job(job_id, 'running', 'Loading data', 30, 'Loading college data from database...')
            raw_data = await service.load_solver_input(department_id, semester_id, academic_year_id)

            # Stage 3: Build solver input
            update_job(job_id, 'running', 'Building model', 45, 'Building constraint model...')
            solver_input = SolverInput(
                department_id=department_id,
                semester_id=semester_id,
                academic_year_id=academic_year_id,
                college_id=raw_data['college_id'],
                faculty=[
                    FacultyInput(
                        id=f['id'], name=f['name'],
                        max_weekly_periods=f['max_weekly_periods'],
                        min_weekly_periods=f['min_weekly_periods'],
                        unavailable_slots=f['unavailable_slots'],
                    ) for f in raw_data['faculty']
                ],
                subjects=[
                    SubjectInput(
                        id=s['id'], code=s['code'], name=s['name'],
                        subject_type=s['subject_type'],
                        weekly_periods=s['weekly_periods'],
                        requires_lab=s['requires_lab'],
                        requires_consecutive=s['requires_consecutive'],
                        consecutive_count=s['consecutive_count'],
                        preferred_days=s['preferred_days'],
                        restricted_days=s['restricted_days'],
                        preferred_period_numbers=s['preferred_period_numbers'],
                        restricted_period_numbers=s['restricted_period_numbers'],
                    ) for s in raw_data['subjects']
                ],
                classes=[
                    ClassInput(
                        id=c['id'], section=c['section'],
                        year_level=c['year_level'],
                        strength=c['strength'],
                        batches=c['batches'],
                    ) for c in raw_data['classes']
                ],
                rooms=[
                    RoomInput(
                        id=r['id'], display_name=r['display_name'],
                        capacity=r['capacity'],
                        available_days=r['available_days'],
                    ) for r in raw_data['rooms']
                ],
                labs=[
                    LabInput(
                        id=l['id'], name=l['name'],
                        capacity=l['capacity'],
                        batch_capacity=l.get('batch_capacity'),
                        requires_consecutive=l['requires_consecutive'],
                        consecutive_count=l['consecutive_count'],
                        available_days=l['available_days'],
                    ) for l in raw_data.get('labs', [])
                ],
                working_days=raw_data['working_days'],
                periods=raw_data['periods'],
                assignments=[
                    asn
                    for s in raw_data['subjects']
                    for asn in s['faculty_assignments']
                ],
                time_limit_seconds=time_limit_seconds,
                preserve_locked=preserve_locked,
            )

            # Stage 4: Solve
            update_job(job_id, 'running', 'Solving (CP-SAT)', 55, 
                      f'Running constraint solver (up to {time_limit_seconds}s)...')
            
            # Run solver in thread pool to not block event loop
            loop = asyncio.get_event_loop()
            engine = TimetableEngine(solver_input)
            solver_result = await loop.run_in_executor(None, engine.solve)

            if not solver_result.success:
                update_job(
                    job_id, 'failed', 'Solver failed', 0,
                    solver_result.error_message or 'Solver could not find a valid timetable.',
                    result={
                        'success': False,
                        'solver_status': solver_result.solver_status,
                        'error': solver_result.error_message,
                    }
                )
                return

            # Stage 5: Save results
            update_job(job_id, 'running', 'Saving timetable', 80, 
                      f'Saving {len(solver_result.assignments)} entries...')
            
            version_id = await service.create_version(
                department_id=department_id,
                semester_id=semester_id,
                academic_year_id=academic_year_id,
                college_id=raw_data['college_id'],
                name=version_name,
                generated_by_user_id=user_id,
                generation_params={
                    'time_limit_seconds': time_limit_seconds,
                    'solver_status': solver_result.solver_status,
                }
            )

            # Convert assignments to dict for persist_result
            entries = [
                {
                    'class_id': a.class_id,
                    'subject_id': a.subject_id,
                    'faculty_id': a.faculty_id,
                    'room_id': a.room_id,
                    'lab_id': a.lab_id,
                    'batch_id': a.batch_id,
                    'day_of_week': a.day_of_week,
                    'period_number': a.period_number,
                }
                for a in solver_result.assignments
            ]
            
            count = await service.persist_result({'entries': entries}, version_id)

            # Update version with quality score
            from app.models.timetable import TimetableVersion
            from sqlalchemy import select
            v_result = await db.execute(select(TimetableVersion).where(TimetableVersion.id == version_id))
            version = v_result.scalar_one_or_none()
            if version:
                version.quality_score = solver_result.quality_score
                version.hard_violations = solver_result.hard_violations
                version.status = 'generated'
            
            await db.commit()

            # Stage 6: Done
            update_job(
                job_id, 'completed', 'Completed', 100,
                f'Timetable generated successfully! {count} entries, quality score: {solver_result.quality_score:.1f}/100',
                result={
                    'success': True,
                    'version_id': version_id,
                    'entries_count': count,
                    'quality_score': solver_result.quality_score,
                    'hard_violations': solver_result.hard_violations,
                    'solver_status': solver_result.solver_status,
                    'stats': solver_result.stats,
                }
            )

            logger.info(f"Generation job {job_id} completed: {count} entries, quality={solver_result.quality_score}")

    except Exception as e:
        logger.error(f"Generation job {job_id} crashed: {e}", exc_info=True)
        update_job(
            job_id, 'failed', 'Error', 0,
            'An unexpected error occurred during generation. Your data has not been changed.',
            result={'success': False, 'error': str(e)}
        )
