from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, require_roles
from app.db.models.enums import EnvironmentEnum, SecretTypeEnum
from app.db.repositories.domain_repo import (
    add_audit_event,
    create_secret,
    delete_secret,
    get_secret_value,
    has_project_access,
    list_secret_versions,
    list_secrets,
    restore_secret_version,
    update_secret,
)
from app.schemas.secrets import (
    SecretCreateRequest,
    SecretOut,
    SecretRevealOut,
    SecretVersionOut,
    SecretUpdateRequest,
)


router = APIRouter(tags=["secrets"])


@router.get("/projects/{project_id}/secrets", response_model=List[SecretOut])
def get_project_secrets(
    project_id: str,
    env: Optional[EnvironmentEnum] = Query(default=None),
    provider: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    type: Optional[SecretTypeEnum] = Query(default=None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if not has_project_access(db, str(user.id), project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return list_secrets(
        db,
        str(user.id),
        project_slug=project_id,
        env=env,
        provider=provider,
        tag=tag,
        secret_type=type,
    )


@router.post("/projects/{project_id}/secrets", response_model=SecretOut)
def create_project_secret(
    project_id: str,
    payload: SecretCreateRequest,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    try:
        created = create_secret(db, str(user.id), project_id, payload.model_dump())
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=project_id,
        action="secret_created",
        target_type="secret",
        target_id=created["id"],
        metadata={"secretName": created["name"]},
    )
    return created


@router.patch("/secrets/{secret_id}", response_model=SecretOut)
def patch_secret(
    secret_id: str,
    payload: SecretUpdateRequest,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    updated = update_secret(
        db, str(user.id), secret_id, payload.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found"
        )
    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=updated["projectId"],
        action="secret_updated",
        target_type="secret",
        target_id=updated["id"],
        metadata={"secretName": updated["name"]},
    )
    return updated


@router.delete("/secrets/{secret_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_secret(
    secret_id: str,
    user=Depends(require_roles(["admin"])),
    db: Session = Depends(get_db_session),
):
    deleted = delete_secret(db, str(user.id), secret_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found"
        )
    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=deleted["projectId"],
        action="secret_deleted",
        target_type="secret",
        target_id=deleted["id"],
        metadata={"secretName": deleted["name"], "event": "deleted"},
    )


@router.get("/secrets/{secret_id}/reveal", response_model=SecretRevealOut)
def reveal_secret(
    secret_id: str,
    reason: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
): 
    normalized_reason = (reason or "").strip()
    if len(normalized_reason) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reveal reason is required",
        )

    value = get_secret_value(db, str(user.id), secret_id)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found"
        )

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=value["projectId"],
        action="secret_revealed",
        target_type="secret",
        target_id=secret_id,
        metadata={"secretName": value["keyName"], "reason": normalized_reason},
    )
    return value


@router.get("/secrets/{secret_id}/versions", response_model=List[SecretVersionOut])
def get_versions(
    secret_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    versions = list_secret_versions(db, str(user.id), secret_id)
    if versions is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found"
        )
    return versions


@router.post("/secrets/{secret_id}/versions/{version}/restore", response_model=SecretOut)
def restore_version(
    secret_id: str,
    version: int,
    user=Depends(require_roles(["admin", "member"])),
    db: Session = Depends(get_db_session),
):
    try:
        restored = restore_secret_version(db, str(user.id), secret_id, version)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found"
        )

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=restored["projectId"],
        action="secret_restored",
        target_type="secret",
        target_id=restored["id"],
        metadata={"secretName": restored["name"], "restoredVersion": version},
    )
    return restored
