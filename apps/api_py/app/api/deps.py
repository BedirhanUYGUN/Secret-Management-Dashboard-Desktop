from datetime import datetime
from typing import Generator, List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.repositories.domain_repo import get_assignments
from app.db.repositories.users_repo import get_user_by_id
from app.db.session import get_db
from app.services.supabase_auth import resolve_user_from_supabase_token
from app.core.config import get_settings


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_session)
):
    settings = get_settings()
    if settings.SUPABASE_AUTH_ENABLED:
        return resolve_user_from_supabase_token(db, token)

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


def require_roles(allowed: List[str]):
    def checker(user=Depends(get_current_user)):
        if user.role.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        return user

    return checker


def parse_optional_datetime(value: Optional[str] = None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid datetime format"
        )


def user_profile_response(user, db: Session):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.display_name,
        "role": user.role,
        "assignments": get_assignments(db, str(user.id)),
        "preferences": user.preferences or {},
    }
