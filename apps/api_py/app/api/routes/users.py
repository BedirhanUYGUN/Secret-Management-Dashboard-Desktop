from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.db.repositories.users_repo import create_user, list_users, update_user
from app.schemas.users import UserCreateRequest, UserOut, UserUpdateRequest


router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserOut])
def get_users(
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    return list_users(db)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_new_user(
    payload: UserCreateRequest,
    user=Depends(require_roles(["admin"])),
    db: Session = Depends(get_db_session),
):
    try:
        return create_user(
            db,
            email=payload.email,
            display_name=payload.displayName,
            role=payload.role.value,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc


@router.patch("/{user_id}", response_model=UserOut)
def patch_user(
    user_id: str,
    payload: UserUpdateRequest,
    user=Depends(require_roles(["admin"])),
    db: Session = Depends(get_db_session),
):
    data = payload.model_dump(exclude_unset=True)
    role_raw = data.get("role")
    role_value = getattr(role_raw, "value", role_raw)
    updated = update_user(
        db,
        user_id,
        display_name=data.get("displayName"),
        role=role_value,
        is_active=data.get("isActive"),
        password=data.get("password"),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return updated
