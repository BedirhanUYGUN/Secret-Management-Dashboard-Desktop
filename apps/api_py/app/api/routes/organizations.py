from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.db.repositories.domain_repo import (
    add_audit_event,
    create_project_invite_for_admin,
    list_managed_organizations_for_user,
    list_project_invites_for_admin,
    revoke_project_invite_for_admin,
    rotate_project_invite_for_admin,
)
from app.schemas.projects import (
    InviteCreateOut,
    InviteCreateRequest,
    InviteOut,
    OrganizationSummaryOut,
)
from app.core.rate_limit import check_rate_limit


router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/managed", response_model=List[OrganizationSummaryOut])
def list_managed_organizations(
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    return list_managed_organizations_for_user(db, str(user.id))


@router.get("/{project_id}/invites", response_model=List[InviteOut])
def list_invites(
    project_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    result = list_project_invites_for_admin(db, str(user.id), project_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return result


@router.post("/{project_id}/invites", response_model=InviteCreateOut)
def create_invite(
    project_id: str,
    payload: InviteCreateRequest,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(
        key=f"invite-create:{project_id}:{client_ip}",
        limit=20,
        window_seconds=60,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invite operations. Please try again later.",
        )

    result = create_project_invite_for_admin(
        db,
        user_id=str(user.id),
        project_slug=project_id,
        expires_in_hours=payload.expiresInHours,
        max_uses=payload.maxUses,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=project_id,
        action="invite_created",
        target_type="project_invite",
        metadata={
            "maxUses": payload.maxUses,
            "expiresInHours": payload.expiresInHours,
        },
    )
    return result


@router.post("/{project_id}/invites/rotate", response_model=InviteCreateOut)
def rotate_invite(
    project_id: str,
    payload: InviteCreateRequest,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(
        key=f"invite-rotate:{project_id}:{client_ip}",
        limit=20,
        window_seconds=60,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invite operations. Please try again later.",
        )

    result = rotate_project_invite_for_admin(
        db,
        user_id=str(user.id),
        project_slug=project_id,
        expires_in_hours=payload.expiresInHours,
        max_uses=payload.maxUses,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=project_id,
        action="invite_rotated",
        target_type="project_invite",
        metadata={
            "maxUses": payload.maxUses,
            "expiresInHours": payload.expiresInHours,
        },
    )
    return result


@router.delete("/{project_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    project_id: str,
    invite_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    result = revoke_project_invite_for_admin(db, str(user.id), project_id, invite_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if result is False:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=project_id,
        action="invite_revoked",
        target_type="project_invite",
        target_id=invite_id,
    )
