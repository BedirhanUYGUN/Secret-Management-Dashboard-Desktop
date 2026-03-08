from datetime import datetime, timezone
from typing import Dict, List, Optional, Union, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import RefreshToken, User
from app.db.models.enums import RoleEnum


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == email))


def get_user_by_supabase_user_id(db: Session, supabase_user_id: str) -> Optional[User]:
    return db.scalar(select(User).where(User.supabase_user_id == supabase_user_id))


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.get(User, user_id)


def create_refresh_token(
    db: Session,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
    *,
    session_label: Optional[str] = None,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
    last_used_at: Optional[datetime] = None,
) -> RefreshToken:
    token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        session_label=session_label,
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=expires_at,
        last_used_at=last_used_at,
    )
    db.add(token)
    db.flush()
    return token


def get_valid_refresh_token(db: Session, token_hash: str) -> Optional[RefreshToken]:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if not token:
        return None
    if token.revoked_at is not None:
        return None
    expires = token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        return None
    return token


def revoke_refresh_token(db: Session, token: RefreshToken) -> None:
    token.revoked_at = datetime.now(timezone.utc)
    db.add(token)


def list_active_sessions_for_user(db: Session, user_id: str) -> List[RefreshToken]:
    now = datetime.now(timezone.utc)
    rows = (
        db.execute(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
            .order_by(RefreshToken.created_at.desc())
        )
        .scalars()
        .all()
    )
    return list(rows)


def get_active_session_by_id(
    db: Session, user_id: str, session_id: str
) -> Optional[RefreshToken]:
    return db.scalar(
        select(RefreshToken).where(
            RefreshToken.id == session_id,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )


def revoke_other_refresh_tokens(db: Session, user_id: str, keep_token_hash: str) -> int:
    tokens = (
        db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.token_hash != keep_token_hash,
            )
        )
        .scalars()
        .all()
    )
    for token in tokens:
        token.revoked_at = datetime.now(timezone.utc)
        db.add(token)
    return len(tokens)


def revoke_all_refresh_tokens_for_user(db: Session, user_id: str) -> int:
    tokens = (
        db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for token in tokens:
        token.revoked_at = datetime.now(timezone.utc)
        db.add(token)
    return len(tokens)


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------


def _user_to_dict(user: User) -> Dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "displayName": user.display_name,
        "role": user.role,
        "isActive": user.is_active,
        "createdAt": user.created_at,
    }


def list_users(db: Session) -> List[Dict]:
    rows = db.execute(select(User).order_by(User.display_name.asc())).scalars().all()
    return [_user_to_dict(u) for u in rows]


def create_user(
    db: Session,
    *,
    email: str,
    display_name: str,
    role: Union[str, RoleEnum],
    password: str,
) -> Dict:
    existing = get_user_by_email(db, email)
    if existing:
        raise ValueError("Bu e-posta adresi zaten kullanilmaktadir")

    user = User(
        email=email,
        display_name=display_name,
        role=cast(RoleEnum, RoleEnum(role)),
        password_hash=get_password_hash(password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_dict(user)


def update_user(
    db: Session,
    user_id: str,
    *,
    display_name: Optional[str] = None,
    role: Optional[Union[str, RoleEnum]] = None,
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
) -> Optional[Dict]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    if display_name is not None:
        user.display_name = display_name
    if role is not None:
        user.role = cast(RoleEnum, RoleEnum(role))
    if is_active is not None:
        user.is_active = is_active
    if password is not None:
        user.password_hash = get_password_hash(password)

    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_dict(user)
