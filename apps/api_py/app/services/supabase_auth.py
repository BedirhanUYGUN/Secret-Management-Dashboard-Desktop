import secrets
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.models import User
from app.db.models.enums import RoleEnum
from app.db.repositories.users_repo import get_user_by_email


def _fetch_supabase_user_profile(access_token: str) -> Optional[Dict[str, Any]]:
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth is enabled but credentials are missing",
        )

    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {access_token}",
    }

    try:
        response = httpx.get(url, headers=headers, timeout=8.0)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase auth service is unreachable",
        ) from exc

    if response.status_code != status.HTTP_200_OK:
        return None

    payload = response.json()
    if not payload.get("email"):
        return None
    return payload


def resolve_user_from_supabase_token(db: Session, access_token: str):
    settings = get_settings()
    profile = _fetch_supabase_user_profile(access_token)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    email = profile["email"].strip().lower()
    user = get_user_by_email(db, email)

    if not user and settings.SUPABASE_AUTO_PROVISION_USERS:
        metadata = profile.get("user_metadata") or {}
        display_name = (
            metadata.get("full_name")
            or metadata.get("name")
            or email.split("@")[0]
        )

        user = User(
            email=email,
            display_name=display_name,
            role=RoleEnum(settings.SUPABASE_DEFAULT_ROLE),
            password_hash=get_password_hash(secrets.token_urlsafe(48)),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user
