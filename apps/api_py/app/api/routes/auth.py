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


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        parts = [item.strip() for item in forwarded_for.split(",") if item.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenPairOut)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db_session),
):
    client_ip = _resolve_client_ip(request)
    normalized_email = payload.email.strip().lower()

    per_ip_allowed = check_rate_limit(
        key=f"login:ip:{client_ip}",
        limit=30,
        window_seconds=60,
    )
    per_email_allowed = check_rate_limit(
        key=f"login:email:{client_ip}:{normalized_email}",
        limit=8,
        window_seconds=60,
    )
    if not (per_ip_allowed and per_email_allowed):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    return login_with_password(db, email=payload.email, password=payload.password)


@router.post("/refresh", response_model=TokenPairOut)
def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db_session),
):
    client_ip = _resolve_client_ip(request)
    allowed = check_rate_limit(
        key=f"refresh:{client_ip}",
        limit=20,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many refresh attempts. Please try again later.",
        )

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
    client_ip = _resolve_client_ip(request)
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
