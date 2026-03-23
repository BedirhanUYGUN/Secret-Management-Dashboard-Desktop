from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, user_profile_response
from app.api.router import api_router
from app.core.config import get_settings
from app.core.security import get_password_hash, verify_password
from app.db.repositories.users_repo import (
    get_active_session_by_id,
    list_active_sessions_for_user,
    revoke_all_refresh_tokens_for_user,
    revoke_refresh_token,
)
from app.schemas.auth import (
    PasswordChangeRequest,
    PreferencesUpdateRequest,
    ProfileUpdateRequest,
    SessionOut,
)


import logging as _logging

settings = get_settings()
IS_PRODUCTION = settings.APP_ENV.strip().lower() == "production"

if IS_PRODUCTION and not settings.RESEND_API_KEY and not settings.SMTP_HOST:
    _logging.getLogger(__name__).warning(
        "UYARI: E-posta gonderimi yapilandirilmamis. "
        "Sifre sifirlama e-postalari gonderilemeyecek. "
        "RESEND_API_KEY veya SMTP_HOST ayarlayin."
    )

app = FastAPI(
    title=settings.APP_NAME,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    )
    if IS_PRODUCTION:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


@app.get("/health")
def health(db: Session = Depends(get_db_session)):
    db.execute(text("SELECT 1"))
    return {"ok": True}


@app.get("/me")
def me(user=Depends(get_current_user), db: Session = Depends(get_db_session)):
    return user_profile_response(user, db)


@app.patch("/me/preferences")
def update_preferences(
    payload: PreferencesUpdateRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    current = dict(user.preferences or {})
    if payload.maskValues is not None:
        current["maskValues"] = payload.maskValues
    if payload.clipboardSeconds is not None:
        bounded = max(5, min(300, payload.clipboardSeconds))
        current["clipboardSeconds"] = bounded
    user.preferences = current
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_profile_response(user, db)


@app.patch("/me/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    display_name = payload.displayName.strip()
    if not display_name:
        return JSONResponse(
            status_code=400,
            content={"detail": "displayName is required"},
        )

    user.display_name = display_name
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_profile_response(user, db)


@app.patch("/me/password")
def change_password(
    payload: PasswordChangeRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if len(payload.newPassword) < 8:
        return JSONResponse(
            status_code=400,
            content={"detail": "New password must be at least 8 characters"},
        )

    if not verify_password(payload.currentPassword, user.password_hash):
        return JSONResponse(
            status_code=400,
            content={"detail": "Current password is incorrect"},
        )

    user.password_hash = get_password_hash(payload.newPassword)
    db.add(user)
    db.commit()
    return {"ok": True}


def _session_to_out(session_row) -> SessionOut:
    return SessionOut(
        id=str(session_row.id),
        sessionLabel=session_row.session_label or "Unknown device",
        userAgent=session_row.user_agent,
        ipAddress=session_row.ip_address,
        createdAt=session_row.created_at,
        lastUsedAt=session_row.last_used_at,
        expiresAt=session_row.expires_at,
    )


@app.get("/me/sessions", response_model=list[SessionOut])
def list_my_sessions(
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    rows = list_active_sessions_for_user(db, str(user.id))
    return [_session_to_out(item) for item in rows]


@app.delete("/me/sessions")
def revoke_my_sessions(
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    revoked_count = revoke_all_refresh_tokens_for_user(db, str(user.id))
    db.commit()
    return {"revokedCount": revoked_count}


@app.delete("/me/sessions/{session_id}")
def revoke_my_session(
    session_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    token_row = get_active_session_by_id(db, str(user.id), session_id)
    if not token_row:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})

    revoke_refresh_token(db, token_row)
    db.commit()
    return {"ok": True}
