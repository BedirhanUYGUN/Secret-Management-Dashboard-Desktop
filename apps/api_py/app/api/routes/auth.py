from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, user_profile_response
from app.schemas.auth import AuthUserOut, LoginRequest, RefreshRequest, TokenPairOut
from app.services.auth_service import (
    login_with_password,
    logout_refresh_token,
    refresh_access_token,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPairOut)
def login(payload: LoginRequest, db: Session = Depends(get_db_session)):
    return login_with_password(db, email=payload.email, password=payload.password)


@router.post("/refresh", response_model=TokenPairOut)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db_session)):
    return refresh_access_token(db, refresh_token=payload.refreshToken)


@router.post("/logout")
def logout(payload: RefreshRequest, db: Session = Depends(get_db_session)):
    logout_refresh_token(db, refresh_token=payload.refreshToken)
    return {"message": "logged_out"}


@router.get("/me", response_model=AuthUserOut)
def me(user=Depends(get_current_user), db: Session = Depends(get_db_session)):
    return user_profile_response(user, db)
