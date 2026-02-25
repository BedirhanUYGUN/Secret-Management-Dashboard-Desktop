from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, user_profile_response
from app.api.router import api_router
from app.core.config import get_settings
from app.schemas.auth import PreferencesUpdateRequest


settings = get_settings()
IS_PRODUCTION = settings.APP_ENV.strip().lower() == "production"

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
