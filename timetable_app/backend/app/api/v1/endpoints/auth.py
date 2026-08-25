from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.schemas.schemas import LoginRequest, TokenResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    if form.username != settings.ADMIN_USERNAME or not verify_password(form.password, _hash_admin()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=form.username)
    return TokenResponse(access_token=token)


@router.post("/login/json", response_model=TokenResponse)
async def login_json(body: LoginRequest):
    if body.username != settings.ADMIN_USERNAME or body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=body.username)
    return TokenResponse(access_token=token)


def _hash_admin():
    from app.core.security import hash_password
    return hash_password(settings.ADMIN_PASSWORD)
