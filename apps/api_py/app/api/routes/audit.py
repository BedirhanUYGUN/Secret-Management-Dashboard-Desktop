from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db_session,
    parse_optional_datetime,
    require_roles,
)
from app.db.repositories.domain_repo import (
    add_audit_event,
    has_project_access,
    list_audit_events,
)
from app.schemas.audit import AuditCopyRequest, AuditEventOut


router = APIRouter(prefix="/audit", tags=["audit"])


@router.post("/copy")
def track_copy(
    payload: AuditCopyRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    project_id = payload.projectId or "unknown"
    if payload.projectId and not has_project_access(
        db, str(user.id), payload.projectId
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=payload.projectId,
        action="secret_copied",
        target_type="secret",
        target_id=payload.secretId,
        metadata={"secretName": payload.secretId, "projectId": project_id},
    )
    return {"ok": True}


@router.get("", response_model=list[AuditEventOut])
def get_audit_events(
    action: Optional[str] = Query(default=None),
    projectId: Optional[str] = Query(default=None),
    userEmail: Optional[str] = Query(default=None),
    from_dt: Optional[str] = Query(default=None, alias="from"),
    to_dt: Optional[str] = Query(default=None, alias="to"),
    user=Depends(require_roles(["admin"])),
    db: Session = Depends(get_db_session),
):
    return list_audit_events(
        db,
        action=action,
        project_slug=projectId,
        user_email=userEmail,
        from_dt=parse_optional_datetime(from_dt),
        to_dt=parse_optional_datetime(to_dt),
    )
