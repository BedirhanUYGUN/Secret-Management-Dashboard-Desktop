import json
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.db.models.enums import EnvironmentEnum
from app.db.repositories.domain_repo import add_audit_event, export_secrets_with_service_token


router = APIRouter(prefix="/service-access", tags=["service-access"])


@router.get("/projects/{project_id}/exports")
def service_export_project(
    project_id: str,
    env: EnvironmentEnum = Query(...),
    format: str = Query(...),
    tag: Optional[str] = Query(default=None),
    x_service_token: Optional[str] = Header(default=None, alias="X-Service-Token"),
    db: Session = Depends(get_db_session),
):
    if not x_service_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Service-Token header is required",
        )

    rows = export_secrets_with_service_token(
        db,
        service_token=x_service_token,
        project_slug=project_id,
        environment=env,
        tag=tag,
    )
    if rows is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token",
        )

    add_audit_event(
        db,
        actor_user_id=None,
        project_slug=project_id,
        action="service_exported",
        target_type="service_token",
        metadata={
            "secretName": f"{project_id}:{env.value}",
            "format": format,
            "count": len(rows),
            "tag": tag,
        },
    )

    if format == "env":
        payload = "\n".join(f"{item['key_name']}={item['value_plain']}" for item in rows)
        return Response(content=payload, media_type="text/plain")

    if format == "json":
        payload = {item["key_name"]: item["value_plain"] for item in rows}
        return Response(content=json.dumps(payload, indent=2), media_type="application/json")

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported format",
    )
