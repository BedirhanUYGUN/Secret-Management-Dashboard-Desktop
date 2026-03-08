from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
    verify_password,
)
from app.db.repositories.users_repo import (
    create_refresh_token as create_refresh_token_record,
    get_user_by_email,
    get_user_by_id,
    get_valid_refresh_token,
    revoke_refresh_token,
)
from app.services.supabase_auth import (
    create_supabase_user,
    login_with_supabase_password,
    resolve_user_from_supabase_token,
)


def _build_session_label(user_agent: Optional[str]) -> str:
    if not user_agent:
        return "Unknown device"

    agent = user_agent.lower()
    if "edg" in agent:
        browser = "Edge"
    elif "chrome" in agent:
        browser = "Chrome"
    elif "firefox" in agent:
        browser = "Firefox"
    elif "safari" in agent:
        browser = "Safari"
    else:
        browser = "Browser"

    if "windows" in agent:
        os_name = "Windows"
    elif "mac os" in agent or "macintosh" in agent:
        os_name = "macOS"
    elif "linux" in agent:
        os_name = "Linux"
    elif "android" in agent:
        os_name = "Android"
    elif "iphone" in agent or "ipad" in agent or "ios" in agent:
        os_name = "iOS"
    else:
        os_name = "Unknown OS"

    return f"{browser} on {os_name}"


def login_with_password(
    db: Session,
    *,
    email: str,
    password: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
):
    settings = get_settings()
    normalized_email = email.strip().lower()

    if settings.SUPABASE_AUTH_ENABLED:
        try:
            supabase_session = login_with_supabase_password(
                email=normalized_email, password=password
            )
        except HTTPException as exc:
            user = get_user_by_email(db, normalized_email)
            can_bridge_local_user = (
                exc.status_code == status.HTTP_401_UNAUTHORIZED
                and user is not None
                and user.is_active
                and not user.supabase_user_id
                and verify_password(password, user.password_hash)
            )
            if not can_bridge_local_user:
                raise

            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                )

            try:
                supabase_user = create_supabase_user(
                    email=normalized_email,
                    password=password,
                    display_name=user.display_name,
                )
                user.supabase_user_id = str(supabase_user["id"])
                db.add(user)
                db.commit()
                db.refresh(user)
            except HTTPException as bridge_exc:
                if bridge_exc.status_code != status.HTTP_409_CONFLICT:
                    raise

            supabase_session = login_with_supabase_password(
                email=normalized_email, password=password
            )

        user = resolve_user_from_supabase_token(db, supabase_session["accessToken"])

        access_token = create_access_token(str(user.id), user.role.value, user.email)
        refresh_token = create_refresh_token(str(user.id), user.role.value, user.email)

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        create_refresh_token_record(
            db,
            str(user.id),
            hash_token(refresh_token),
            expires_at + timedelta(days=7),
            session_label=_build_session_label(user_agent),
            user_agent=user_agent,
            ip_address=ip_address,
            last_used_at=datetime.now(timezone.utc),
        )
        db.commit()

        return {
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "tokenType": "bearer",
            "expiresAt": expires_at,
        }

    user = get_user_by_email(db, normalized_email)
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    access_token = create_access_token(str(user.id), user.role.value, user.email)
    refresh_token = create_refresh_token(str(user.id), user.role.value, user.email)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    create_refresh_token_record(
        db,
        str(user.id),
        hash_token(refresh_token),
        expires_at + timedelta(days=7),
        session_label=_build_session_label(user_agent),
        user_agent=user_agent,
        ip_address=ip_address,
        last_used_at=datetime.now(timezone.utc),
    )
    db.commit()

    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "tokenType": "bearer",
        "expiresAt": expires_at,
    }


def refresh_access_token(
    db: Session,
    *,
    refresh_token: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
):
    from app.core.security import decode_token

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    token_row = get_valid_refresh_token(db, hash_token(refresh_token))
    if not token_row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or revoked",
        )

    user = get_user_by_id(db, str(token_row.user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    revoke_refresh_token(db, token_row)

    access_token = create_access_token(str(user.id), user.role.value, user.email)
    new_refresh_token = create_refresh_token(str(user.id), user.role.value, user.email)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    create_refresh_token_record(
        db,
        str(user.id),
        hash_token(new_refresh_token),
        expires_at + timedelta(days=7),
        session_label=_build_session_label(user_agent or token_row.user_agent),
        user_agent=user_agent or token_row.user_agent,
        ip_address=ip_address or token_row.ip_address,
        last_used_at=datetime.now(timezone.utc),
    )
    db.commit()

    return {
        "accessToken": access_token,
        "refreshToken": new_refresh_token,
        "tokenType": "bearer",
        "expiresAt": expires_at,
    }


def logout_refresh_token(db: Session, *, refresh_token: str):
    token_row = get_valid_refresh_token(db, hash_token(refresh_token))
    if not token_row:
        return
    revoke_refresh_token(db, token_row)
    db.commit()
