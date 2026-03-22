from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, user_profile_response
from app.core.config import get_settings
from app.core.cookies import clear_auth_cookies, set_auth_cookies
from app.schemas.auth import (
    AuthUserOut,
    LoginRequest,
    RefreshRequest,
    RegisterPurposeEnum,
    RegisterOut,
    RegisterRequest,
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


def _resolve_session_context(request: Request) -> tuple[str, str]:
    return _resolve_client_ip(request), request.headers.get("user-agent", "").strip()


def _resolve_refresh_token(
    payload: Optional[RefreshRequest], request: Request
) -> str:
    if payload and payload.refreshToken:
        return payload.refreshToken

    settings = get_settings()
    cookie_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No refresh token provided",
    )


@router.post("/login")
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

    ip_address, user_agent = _resolve_session_context(request)
    token_data = login_with_password(
        db,
        email=payload.email,
        password=payload.password,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    settings = get_settings()
    response = JSONResponse(content={
        "accessToken": token_data["accessToken"],
        "refreshToken": token_data["refreshToken"],
        "tokenType": token_data["tokenType"],
        "expiresAt": token_data["expiresAt"].isoformat(),
    })

    set_auth_cookies(
        response,
        access_token=token_data["accessToken"],
        refresh_token=token_data["refreshToken"],
        access_max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    return response


@router.post("/refresh")
def refresh(
    request: Request,
    payload: Optional[RefreshRequest] = Body(default=None),
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

    refresh_token = _resolve_refresh_token(payload, request)

    ip_address, user_agent = _resolve_session_context(request)
    token_data = refresh_access_token(
        db,
        refresh_token=refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    settings = get_settings()
    response = JSONResponse(content={
        "accessToken": token_data["accessToken"],
        "refreshToken": token_data["refreshToken"],
        "tokenType": token_data["tokenType"],
        "expiresAt": token_data["expiresAt"].isoformat(),
    })

    set_auth_cookies(
        response,
        access_token=token_data["accessToken"],
        refresh_token=token_data["refreshToken"],
        access_max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    return response


@router.post("/logout")
def logout(
    request: Request,
    payload: Optional[RefreshRequest] = Body(default=None),
    db: Session = Depends(get_db_session),
):
    try:
        refresh_token = _resolve_refresh_token(payload, request)
        logout_refresh_token(db, refresh_token=refresh_token)
    except HTTPException:
        pass

    response = JSONResponse(content={"message": "logged_out"})
    clear_auth_cookies(response)
    return response


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
