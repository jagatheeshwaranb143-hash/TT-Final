import logging
import sys
import os
from contextlib import asynccontextmanager
from pathlib import Path

# Add backend root and scheduler to path
backend_dir = Path(__file__).resolve().parent.parent
scheduler_dir = backend_dir / "scheduler"
for d in (str(backend_dir), str(backend_dir.parent)):
    if d not in sys.path:
        sys.path.insert(0, d)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import engine
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Timetable Generator API starting...")
    # Keep older local demo databases compatible with the current auth model.
    if settings.DATABASE_URL.startswith("sqlite"):
        async with engine.begin() as conn:
            from app.models import models  # noqa: F401 - registers active metadata
            # Older databases enforced faculty/day/period globally. Odd and
            # even semester workflows represent different academic terms, so
            # that constraint incorrectly made a valid even slot conflict with
            # an odd slot (and vice versa). Rebuild this one table once while
            # preserving all existing timetable rows and the class-slot rule.
            timetable_sql = (await conn.execute(text(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='timetable_entries'"
            ))).scalar_one_or_none()
            if timetable_sql and "uq_faculty_slot" in timetable_sql:
                await conn.execute(text("ALTER TABLE timetable_entries RENAME TO timetable_entries_legacy"))
                await conn.run_sync(models.TimetableEntry.__table__.create)
                await conn.execute(text("""
                    INSERT INTO timetable_entries
                        (id, class_id, subject_id, faculty_id, day, period, is_locked, created_at)
                    SELECT id, class_id, subject_id, faculty_id, day, period, is_locked, created_at
                    FROM timetable_entries_legacy
                """))
                await conn.execute(text("DROP TABLE timetable_entries_legacy"))
                logger.info("Migrated timetable slots for independent odd/even workflows")
            await conn.run_sync(models.Base.metadata.create_all)
            columns = (await conn.execute(text("PRAGMA table_info(users)"))).mappings().all()
            names = {column["name"] for column in columns}
            for name, definition in (
                ("role", "VARCHAR(20) NOT NULL DEFAULT 'super_admin'"),
                ("college_id", "VARCHAR(36)"),
                ("department_id", "VARCHAR(36)"),
            ):
                if names and name not in names:
                    await conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {definition}"))
            subject_columns = (await conn.execute(text("PRAGMA table_info(subjects)"))).mappings().all()
            subject_names = {column["name"] for column in subject_columns}
            for name in ("year", "semester"):
                if subject_names and name not in subject_names:
                    await conn.execute(text(f"ALTER TABLE subjects ADD COLUMN {name} INTEGER"))
            await conn.execute(text("""
                UPDATE subjects
                SET year = (
                    SELECT classes.year FROM class_subjects
                    JOIN classes ON classes.id = class_subjects.class_id
                    WHERE class_subjects.subject_id = subjects.id LIMIT 1
                ),
                semester = (
                    SELECT classes.semester FROM class_subjects
                    JOIN classes ON classes.id = class_subjects.class_id
                    WHERE class_subjects.subject_id = subjects.id LIMIT 1
                )
                WHERE year IS NULL OR semester IS NULL
            """))
    yield
    logger.info("🛑 Shutting down...")
    await engine.dispose()


app = FastAPI(
    title="College Timetable Generator",
    description="Generate conflict-free academic timetables with OR-Tools CP-SAT",
    version="2.0.0",
    openapi_url="/api/docs/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
        "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def root_health():
    return {"status": "ok", "api": "Timetable Generator v2.0"}
