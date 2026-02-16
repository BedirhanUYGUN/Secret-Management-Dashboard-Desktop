from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.db.models.enums import EnvironmentEnum, RoleEnum
from app.db.repositories.domain_repo import (
    add_audit_event,
    export_secrets,
    has_environment_export_access,
)


router = APIRouter(tags=["exports"])


@router.get("/exports/{project_id}")
def export_project(
    project_id: str,
    env: EnvironmentEnum = Query(...),
    format: str = Query(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if user.role == RoleEnum.viewer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer cannot export by default",
        )

    if not has_environment_export_access(db, str(user.id), project_id, env):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    rows = export_secrets(db, str(user.id), project_id, env)

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=project_id,
        action="secret_exported",
        target_type="project",
        metadata={
            "secretName": f"{project_id}:{env.value}",
            "format": format,
            "count": len(rows),
        },
    )

    if format == "env":
        payload = "\n".join(
            f"{item['key_name']}={item['value_plain']}" for item in rows
        )
        return Response(content=payload, media_type="text/plain")

    if format == "json":
        import json

        payload = {item["key_name"]: item["value_plain"] for item in rows}
        return Response(
            content=json.dumps(payload, indent=2), media_type="application/json"
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format"
    )
