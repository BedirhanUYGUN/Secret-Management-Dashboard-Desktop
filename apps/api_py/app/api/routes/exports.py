import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.db.models.enums import EnvironmentEnum, RoleEnum
from app.db.repositories.domain_repo import (
    add_audit_event,
    export_secrets,
    export_secrets_all_envs,
    has_environment_export_access,
)


router = APIRouter(tags=["exports"])


@router.get("/exports/{project_id}")
def export_project(
    project_id: str,
    env: EnvironmentEnum = Query(...),
    format: str = Query(...),
    tag: Optional[str] = Query(None),
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

    rows = export_secrets(db, str(user.id), project_id, env, tag=tag)

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
            "tag": tag,
        },
    )

    if format == "env":
        payload = "\n".join(
            f"{item['key_name']}={item['value_plain']}" for item in rows
        )
        return Response(content=payload, media_type="text/plain")

    if format == "json":
        payload = {item["key_name"]: item["value_plain"] for item in rows}
        return Response(
            content=json.dumps(payload, indent=2), media_type="application/json"
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format"
    )


@router.get("/exports/{project_id}/all")
def export_project_all_envs(
    project_id: str,
    format: str = Query(...),
    tag: Optional[str] = Query(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Tum ortamlar icin secret'lari export eder."""
    if user.role == RoleEnum.viewer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer cannot export by default",
        )

    env_data = export_secrets_all_envs(db, str(user.id), project_id, tag=tag)

    total_count = sum(len(rows) for rows in env_data.values())

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=project_id,
        action="secret_exported",
        target_type="project",
        metadata={
            "secretName": f"{project_id}:all",
            "format": format,
            "count": total_count,
            "tag": tag,
            "environments": list(env_data.keys()),
        },
    )

    if format == "env":
        sections = []
        for env_name, rows in env_data.items():
            section_lines = [f"# --- {env_name.upper()} ---"]
            for item in rows:
                section_lines.append(f"{item['key_name']}={item['value_plain']}")
            sections.append("\n".join(section_lines))
        payload = "\n\n".join(sections)
        return Response(content=payload, media_type="text/plain")

    if format == "json":
        payload = {}
        for env_name, rows in env_data.items():
            payload[env_name] = {item["key_name"]: item["value_plain"] for item in rows}
        return Response(
            content=json.dumps(payload, indent=2), media_type="application/json"
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format"
    )
