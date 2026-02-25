from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, user_profile_response
from app.schemas.auth import (
    AuthUserOut,
    LoginRequest,
    RefreshRequest,
    RegisterPurposeEnum,
    RegisterOut,
    RegisterRequest,
    TokenPairOut,
)
from app.core.rate_limit import check_rate_limit
from app.services.auth_service import (
    login_with_password,
    logout_refresh_token,
    refresh_access_token,
)
from app.services.registration_service import register_with_profile


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


@router.post("/register", response_model=RegisterOut, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db_session),
):
    client_ip = request.client.host if request.client else "unknown"
    is_join_flow = (
        payload.purpose == RegisterPurposeEnum.organization
        and payload.organizationMode == "join"
    )

    allowed = check_rate_limit(
        key=f"register:{'join' if is_join_flow else 'create'}:{client_ip}",
        limit=8 if is_join_flow else 12,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
        )

    return register_with_profile(db, payload)
