from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.db.repositories.domain_repo import (
    add_member_to_project,
    can_manage_project,
    create_project,
    delete_project,
    list_all_projects,
    list_managed_projects_for_user,
    remove_member_from_project,
    set_environment_access,
    update_project,
)
from app.schemas.projects import (
    EnvironmentAccessRequest,
    ProjectCreateRequest,
    ProjectDetailOut,
    ProjectMemberAddRequest,
    ProjectMemberOut,
    ProjectUpdateRequest,
)


router = APIRouter(prefix="/projects/manage", tags=["project-management"])


@router.get("", response_model=List[ProjectDetailOut])
def get_all_projects(
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    if user.role.value == "admin":
        return list_all_projects(db)
    return list_managed_projects_for_user(db, str(user.id))


@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_new_project(
    payload: ProjectCreateRequest,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    try:
        return create_project(
            db,
            slug=payload.slug,
            name=payload.name,
            description=payload.description,
            tags=payload.tags,
            created_by=str(user.id),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc


@router.patch("/{project_id}", response_model=ProjectDetailOut)
def patch_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    if user.role.value != "admin" and not can_manage_project(db, str(user.id), project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    data = payload.model_dump(exclude_unset=True)
    updated = update_project(
        db,
        project_id,
        name=data.get("name"),
        description=data.get("description"),
        tags=data.get("tags"),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return updated


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project(
    project_id: str,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    if user.role.value != "admin" and not can_manage_project(db, str(user.id), project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not delete_project(db, project_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )


# ---------------------------------------------------------------------------
# Member management
# ---------------------------------------------------------------------------


@router.post("/{project_id}/members", response_model=ProjectMemberOut)
def add_member(
    project_id: str,
    payload: ProjectMemberAddRequest,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    if user.role.value != "admin" and not can_manage_project(db, str(user.id), project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    result = add_member_to_project(db, project_id, payload.userId, payload.role.value)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project or user not found",
        )
    return result


@router.delete(
    "/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_member(
    project_id: str,
    user_id: str,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    if user.role.value != "admin" and not can_manage_project(db, str(user.id), project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not remove_member_from_project(db, project_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )


# ---------------------------------------------------------------------------
# Environment access
# ---------------------------------------------------------------------------


@router.post("/{project_id}/access")
def set_access(
    project_id: str,
    payload: EnvironmentAccessRequest,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    if user.role.value != "admin" and not can_manage_project(db, str(user.id), project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    success = set_environment_access(
        db,
        project_id,
        payload.userId,
        payload.environment,
        payload.canRead,
        payload.canExport,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project or environment not found",
        )
    return {"ok": True}
