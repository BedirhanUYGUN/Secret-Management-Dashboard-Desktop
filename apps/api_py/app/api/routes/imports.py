from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.db.repositories.domain_repo import (
    add_audit_event,
    create_secret,
    find_secret_by_key,
    has_environment_read_access,
    update_secret,
)
from app.schemas.imports import (
    ImportCommitOut,
    ImportCommitRequest,
    ImportPreviewOut,
    ImportPreviewRequest,
)
from app.services.import_parser import parse_txt_import


router = APIRouter(prefix="/imports", tags=["imports"])


def _key_to_name(key: str) -> str:
    return " ".join(part.capitalize() for part in key.lower().split("_"))


@router.post("/preview", response_model=ImportPreviewOut)
def preview_import(
    payload: ImportPreviewRequest,
    user=Depends(require_roles(["admin"])),
):
    parsed = parse_txt_import(payload.content)
    return {
        "heading": parsed.project_heading,
        "totalPairs": len(parsed.pairs),
        "skipped": parsed.skipped,
        "preview": [
            {"key": item.key, "value": item.value} for item in parsed.pairs[:50]
        ],
    }


@router.post("/commit", response_model=ImportCommitOut)
def commit_import(
    payload: ImportCommitRequest,
    user=Depends(require_roles(["admin"])),
    db: Session = Depends(get_db_session),
):
    if not has_environment_read_access(
        db, str(user.id), payload.projectId, payload.environment
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    parsed = parse_txt_import(payload.content)
    inserted = 0
    updated = 0
    skipped = parsed.skipped

    for pair in parsed.pairs:
        existing = find_secret_by_key(
            db, str(user.id), payload.projectId, payload.environment, pair.key
        )
        if existing is None:
            create_secret(
                db,
                str(user.id),
                payload.projectId,
                {
                    "name": _key_to_name(pair.key),
                    "provider": payload.provider,
                    "type": payload.type,
                    "environment": payload.environment,
                    "keyName": pair.key,
                    "value": pair.value,
                    "tags": payload.tags,
                    "notes": "Imported from TXT",
                },
            )
            inserted += 1
            continue

        if payload.conflictStrategy == "skip":
            skipped += 1
            continue

        update_secret(
            db,
            str(user.id),
            str(existing.id),
            {
                "provider": payload.provider,
                "type": payload.type,
                "value": pair.value,
            },
        )
        updated += 1

    add_audit_event(
        db,
        actor_user_id=str(user.id),
        project_slug=payload.projectId,
        action="secret_updated",
        target_type="import",
        metadata={
            "secretName": f"Import {payload.environment.value.upper()}",
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "conflictStrategy": payload.conflictStrategy,
        },
    )

    return {
        "projectId": payload.projectId,
        "environment": payload.environment,
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total": len(parsed.pairs),
    }
