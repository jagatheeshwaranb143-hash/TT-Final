"""Routes backed by the active timetable data model.

Legacy feature modules target an older, incompatible SQLAlchemy model and must
be migrated to ``app.models.models`` before they can be exposed safely.
"""
from fastapi import APIRouter
from app.api.v1.endpoints import (
    analytics, auth, classes, departments, faculty, health, search, subjects,
    timetable, timetable_editor, settings,
)

api_router = APIRouter()

api_router.include_router(auth.router,        prefix="/auth",        tags=["Auth"])
api_router.include_router(departments.router, prefix="/departments",  tags=["Departments"])
api_router.include_router(faculty.router,     prefix="/faculty",      tags=["Faculty"])
api_router.include_router(subjects.router,    prefix="/subjects",     tags=["Subjects"])
api_router.include_router(classes.router,     prefix="/classes",      tags=["Classes"])
api_router.include_router(timetable.router,   prefix="/timetable",    tags=["Timetable"])
api_router.include_router(health.router,      prefix="/health",       tags=["Health"])
api_router.include_router(timetable_editor.router, prefix="/timetable/editor", tags=["Timetable editor"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
