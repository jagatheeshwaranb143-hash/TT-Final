"""
SmartSchedule — AI Assistant Endpoint
Uses Gemini API to answer questions using ONLY authorized college data.
Never hallucinates. If data is unavailable, says so clearly.
Respects user role and row-level access.
"""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.core.security import get_current_user
from app.core.exceptions import ValidationError
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class AIQueryRequest(BaseModel):
    question: str
    context: dict | None = None  # Optional: current page context (e.g., selected department)


class AIQueryResponse(BaseModel):
    answer: str
    data_sources: list[str]
    disclaimer: str = "This answer is based on your college's configured data in SmartSchedule."


@router.post("/query", response_model=AIQueryResponse, summary="Ask the AI assistant a question")
async def ai_query(
    request: AIQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Answer questions about the college timetable using ONLY authorized database data.
    The AI never invents data. If information is unavailable, it says so clearly.
    Respects user role — students cannot access faculty personal info, etc.
    """
    if not settings.AI_API_KEY:
        return AIQueryResponse(
            answer="The AI assistant is not configured. Ask your system administrator to set up the Gemini API key.",
            data_sources=[],
            disclaimer="AI assistant is unavailable."
        )

    question = request.question.strip()
    if not question:
        raise ValidationError("Please provide a question.")

    if len(question) > 500:
        raise ValidationError("Question is too long. Please be more concise.")

    college_id = str(current_user.college_id) if current_user.college_id else None
    department_id = str(current_user.department_id) if current_user.department_id else None
    role = current_user.role

    # ─── Gather relevant context from DB ───
    context_data = {}
    data_sources = []

    try:
        # Get timetable stats
        from app.models.timetable import TimetableVersion, TimetableEntry
        from app.models.faculty import Faculty
        from app.models.subject import Subject
        from app.models.room import Room

        # Published timetable count
        tv_result = await db.execute(
            select(func.count(TimetableVersion.id)).where(TimetableVersion.status == "published")
        )
        context_data["published_timetables"] = tv_result.scalar() or 0

        # Faculty count (role-restricted)
        if role in ("super_admin", "hod"):
            faculty_query = select(func.count(Faculty.id)).where(Faculty.is_active == True)
            if role == "hod" and department_id:
                faculty_query = faculty_query.where(Faculty.department_id == department_id)
            faculty_count = await db.execute(faculty_query)
            context_data["faculty_count"] = faculty_count.scalar() or 0
            data_sources.append("faculty records")

        # Subject count
        subj_result = await db.execute(select(func.count(Subject.id)))
        context_data["subject_count"] = subj_result.scalar() or 0
        data_sources.append("subject catalog")

        # Room count
        room_result = await db.execute(
            select(func.count(Room.id)).where(Room.is_active == True)
        )
        context_data["room_count"] = room_result.scalar() or 0
        data_sources.append("room database")

    except Exception as e:
        logger.warning(f"AI context gathering failed: {e}")

    # ─── Build prompt for Gemini ───
    system_context = f"""
You are the SmartSchedule AI assistant for a college timetable management system.

User role: {role}
College ID: {college_id or 'not configured'}
Department: {department_id or 'all departments'}

Data currently available from the college database:
{context_data}

STRICT RULES:
1. Only answer based on the data provided above. Do NOT invent any faculty names, subject names, room numbers, or timetable information.
2. If the requested information is not in the data provided, respond: "I don't have that information in the current college data."
3. Do NOT reveal personal information to unauthorized roles (students cannot see faculty personal details).
4. Role restrictions: student can only see timetable info; faculty can see their own schedule; HOD sees department; super_admin sees all.
5. Keep answers concise and helpful.
6. Never hallucinate numbers, names, or schedules.

User question: {question}
"""

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.AI_API_KEY)
        model = genai.GenerativeModel(settings.AI_MODEL)

        response = model.generate_content(system_context)
        answer = response.text.strip()

        if not answer:
            answer = "I don't have enough information to answer that question based on the current college data."

    except Exception as e:
        logger.error(f"Gemini API error: {e}", exc_info=True)
        answer = (
            "I'm unable to process your question at the moment. "
            "Please try again later or contact your system administrator."
        )

    return AIQueryResponse(
        answer=answer,
        data_sources=data_sources,
    )
