from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

def get_current_user(): pass
def get_db(): pass

router = APIRouter()

@router.get("", status_code=status.HTTP_200_OK)
async def search(q: str = Query(...), type: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Search across faculty, subjects, rooms, classes."""
    return []
