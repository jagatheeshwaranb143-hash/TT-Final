from fastapi import APIRouter
from app.api.v1.endpoints import auth, departments, faculty, subjects, classes, timetable, health

api_router = APIRouter()

api_router.include_router(auth.router,        prefix="/auth",        tags=["Auth"])
api_router.include_router(departments.router, prefix="/departments",  tags=["Departments"])
api_router.include_router(faculty.router,     prefix="/faculty",      tags=["Faculty"])
api_router.include_router(subjects.router,    prefix="/subjects",     tags=["Subjects"])
api_router.include_router(classes.router,     prefix="/classes",      tags=["Classes"])
api_router.include_router(timetable.router,   prefix="/timetable",    tags=["Timetable"])
api_router.include_router(health.router,      prefix="/health",       tags=["Health"])
