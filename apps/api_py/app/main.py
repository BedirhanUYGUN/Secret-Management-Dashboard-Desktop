from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, user_profile_response
from app.api.router import api_router
from app.core.config import get_settings
from app.schemas.auth import PreferencesUpdateRequest


settings = get_settings()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


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
