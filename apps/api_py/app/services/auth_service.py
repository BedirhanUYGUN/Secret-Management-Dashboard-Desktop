from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

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


def login_with_password(db: Session, *, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    access_token = create_access_token(str(user.id), user.role.value, user.email)
    refresh_token = create_refresh_token(str(user.id), user.role.value, user.email)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    create_refresh_token_record(
        db, str(user.id), hash_token(refresh_token), expires_at + timedelta(days=7)
    )
    db.commit()

    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "tokenType": "bearer",
        "expiresAt": expires_at,
    }


def refresh_access_token(db: Session, *, refresh_token: str):
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
        db, str(user.id), hash_token(new_refresh_token), expires_at + timedelta(days=7)
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
