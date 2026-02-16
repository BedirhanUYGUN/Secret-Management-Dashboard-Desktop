from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret_value, encrypt_secret_value
from app.db.models import (
    AuditEvent,
    Environment,
    EnvironmentAccess,
    EnvironmentEnum,
    Project,
    ProjectMember,
    ProjectTag,
    Secret,
    SecretNote,
    SecretTag,
    SecretTypeEnum,
    SecretVersion,
    User,
)


def _to_uuid(value: str) -> UUID:
    return UUID(value)


def mask_value(value: str) -> str:
    if len(value) <= 6:
        return "*" * max(len(value), 3)
    return f"{value[:4]}...{value[-4:]}"


def resolve_project_id(db: Session, project_slug: str) -> Optional[UUID]:
    return db.scalar(select(Project.id).where(Project.slug == project_slug))


def resolve_project_slug(db: Session, project_id: UUID) -> str:
    return db.scalar(select(Project.slug).where(Project.id == project_id)) or str(
        project_id
    )


def resolve_environment_id(
    db: Session, project_id: UUID, env: EnvironmentEnum
) -> Optional[UUID]:
    return db.scalar(
        select(Environment.id).where(
            Environment.project_id == project_id, Environment.name == env
        )
    )


def has_project_access(db: Session, user_id: str, project_slug: str) -> bool:
    result = db.scalar(
        select(func.count(ProjectMember.id))
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == _to_uuid(user_id), Project.slug == project_slug)
    )
    return int(result or 0) > 0


def has_environment_read_access(
    db: Session, user_id: str, project_slug: str, env: EnvironmentEnum
) -> bool:
    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return False

    env_id = resolve_environment_id(db, project_id, env)
    if not env_id:
        return False

    if env != EnvironmentEnum.prod:
        return has_project_access(db, user_id, project_slug)

    can_read = db.scalar(
        select(EnvironmentAccess.can_read).where(
            EnvironmentAccess.environment_id == env_id,
            EnvironmentAccess.user_id == _to_uuid(user_id),
        )
    )
    return bool(can_read)


def has_environment_export_access(
    db: Session, user_id: str, project_slug: str, env: EnvironmentEnum
) -> bool:
    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return False

    env_id = resolve_environment_id(db, project_id, env)
    if not env_id:
        return False

    can_export = db.scalar(
        select(EnvironmentAccess.can_export).where(
            EnvironmentAccess.environment_id == env_id,
            EnvironmentAccess.user_id == _to_uuid(user_id),
        )
    )
    return bool(can_export)


def get_assignments(db: Session, user_id: str) -> List[Dict]:
    rows = db.execute(
        select(Project.slug, Project.id)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == _to_uuid(user_id))
    ).all()

    output: List[Dict] = []
    for row in rows:
        prod_env = db.scalar(
            select(Environment.id).where(
                Environment.project_id == row.id,
                Environment.name == EnvironmentEnum.prod,
            )
        )
        if not prod_env:
            prod_access = False
        else:
            prod_access = bool(
                db.scalar(
                    select(EnvironmentAccess.can_read).where(
                        EnvironmentAccess.environment_id == prod_env,
                        EnvironmentAccess.user_id == _to_uuid(user_id),
                    )
                )
            )
        output.append({"projectId": row.slug, "prodAccess": prod_access})

    return output


def list_projects_for_user(db: Session, user_id: str) -> List[Dict]:
    projects = db.execute(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == _to_uuid(user_id))
        .order_by(Project.name.asc())
    ).scalars()

    output: List[Dict] = []
    for project in projects:
        tags = [
            item.tag
            for item in db.execute(
                select(ProjectTag).where(ProjectTag.project_id == project.id)
            ).scalars()
        ]
        prod_access = has_environment_read_access(
            db, user_id, project.slug, EnvironmentEnum.prod
        )

        secret_rows = db.execute(
            select(Secret, Environment.name)
            .join(Environment, Environment.id == Secret.environment_id)
            .where(Secret.project_id == project.id)
        ).all()
        key_count = 0
        for _, env_name in secret_rows:
            if env_name == EnvironmentEnum.prod and not prod_access:
                continue
            key_count += 1

        output.append(
            {
                "id": project.slug,
                "name": project.name,
                "tags": tags,
                "keyCount": key_count,
                "prodAccess": prod_access,
            }
        )

    return output


def _to_secret_out(db: Session, secret: Secret, env_name: EnvironmentEnum) -> Dict:
    project_slug = resolve_project_slug(db, secret.project_id)
    tags = [
        item.tag
        for item in db.execute(
            select(SecretTag).where(SecretTag.secret_id == secret.id)
        ).scalars()
    ]
    note = (
        db.scalar(select(SecretNote.content).where(SecretNote.secret_id == secret.id))
        or ""
    )

    return {
        "id": str(secret.id),
        "projectId": project_slug,
        "name": secret.name,
        "provider": secret.provider,
        "type": secret.type,
        "environment": env_name,
        "keyName": secret.key_name,
        "valueMasked": mask_value(decrypt_secret_value(secret.value_encrypted)),
        "updatedAt": secret.updated_at,
        "tags": tags,
        "notes": note,
    }


def list_secrets(
    db: Session,
    user_id: str,
    *,
    project_slug: Optional[str] = None,
    env: Optional[EnvironmentEnum] = None,
    provider: Optional[str] = None,
    tag: Optional[str] = None,
    secret_type: Optional[SecretTypeEnum] = None,
    q: Optional[str] = None,
) -> List[Dict]:
    query = (
        select(Secret, Environment.name, Project.slug)
        .join(Project, Project.id == Secret.project_id)
        .join(
            ProjectMember,
            and_(
                ProjectMember.project_id == Project.id,
                ProjectMember.user_id == _to_uuid(user_id),
            ),
        )
        .join(Environment, Environment.id == Secret.environment_id)
    )

    if project_slug:
        query = query.where(Project.slug == project_slug)
    if env:
        query = query.where(Environment.name == env)
    if provider:
        query = query.where(Secret.provider == provider)
    if secret_type:
        query = query.where(Secret.type == secret_type)
    if q:
        like = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(Secret.name).like(like),
                func.lower(Secret.provider).like(like),
                func.lower(Secret.key_name).like(like),
            )
        )

    rows = db.execute(query.order_by(Secret.updated_at.desc())).all()

    output: List[Dict] = []
    for secret, env_name, slug in rows:
        if env_name == EnvironmentEnum.prod and not has_environment_read_access(
            db, user_id, slug, EnvironmentEnum.prod
        ):
            continue

        if tag:
            tags = [
                item.tag
                for item in db.execute(
                    select(SecretTag).where(SecretTag.secret_id == secret.id)
                ).scalars()
            ]
            if tag not in tags:
                continue

        output.append(_to_secret_out(db, secret, env_name))
    return output


def get_secret_for_user(db: Session, user_id: str, secret_id: str) -> Optional[Secret]:
    secret = db.get(Secret, _to_uuid(secret_id))
    if not secret:
        return None

    slug = resolve_project_slug(db, secret.project_id)
    env_name = db.scalar(
        select(Environment.name).where(Environment.id == secret.environment_id)
    )
    if not env_name:
        return None

    if not has_project_access(db, user_id, slug):
        return None
    if env_name == EnvironmentEnum.prod and not has_environment_read_access(
        db, user_id, slug, EnvironmentEnum.prod
    ):
        return None

    return secret


def get_secret_value(db: Session, user_id: str, secret_id: str) -> Optional[Dict]:
    secret = get_secret_for_user(db, user_id, secret_id)
    if not secret:
        return None
    return {
        "secretId": str(secret.id),
        "keyName": secret.key_name,
        "value": decrypt_secret_value(secret.value_encrypted),
    }


def create_secret(db: Session, user_id: str, project_slug: str, payload: Dict) -> Dict:
    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        raise ValueError("Project not found")

    env_id = resolve_environment_id(db, project_id, payload["environment"])
    if not env_id:
        raise ValueError("Environment not found")

    secret = Secret(
        project_id=project_id,
        environment_id=env_id,
        name=payload["name"],
        provider=payload["provider"],
        type=payload["type"],
        key_name=payload["keyName"],
        value_encrypted=encrypt_secret_value(payload["value"]),
        key_version=1,
        created_by=_to_uuid(user_id),
        updated_by=_to_uuid(user_id),
    )
    db.add(secret)
    db.flush()

    for item in payload.get("tags", []):
        db.add(SecretTag(secret_id=secret.id, tag=item))
    db.add(
        SecretNote(
            secret_id=secret.id,
            content=payload.get("notes", ""),
            updated_by=_to_uuid(user_id),
        )
    )
    db.commit()

    env_name = db.scalar(
        select(Environment.name).where(Environment.id == secret.environment_id)
    )
    return _to_secret_out(db, secret, env_name)


def update_secret(
    db: Session, user_id: str, secret_id: str, payload: Dict
) -> Optional[Dict]:
    secret = get_secret_for_user(db, user_id, secret_id)
    if not secret:
        return None

    if payload.get("name") is not None:
        secret.name = payload["name"]
    if payload.get("provider") is not None:
        secret.provider = payload["provider"]
    if payload.get("type") is not None:
        secret.type = payload["type"]
    if payload.get("keyName") is not None:
        secret.key_name = payload["keyName"]

    if payload.get("value") is not None:
        db.add(
            SecretVersion(
                secret_id=secret.id,
                version=secret.key_version,
                value_encrypted=secret.value_encrypted,
                created_by=_to_uuid(user_id),
            )
        )
        secret.key_version += 1
        secret.value_encrypted = encrypt_secret_value(payload["value"])

    secret.updated_by = _to_uuid(user_id)
    secret.updated_at = datetime.now(timezone.utc)

    if payload.get("tags") is not None:
        db.query(SecretTag).filter(SecretTag.secret_id == secret.id).delete()
        for item in payload["tags"]:
            db.add(SecretTag(secret_id=secret.id, tag=item))

    if payload.get("notes") is not None:
        note = db.scalar(select(SecretNote).where(SecretNote.secret_id == secret.id))
        if note:
            note.content = payload["notes"]
            note.updated_by = _to_uuid(user_id)
        else:
            db.add(
                SecretNote(
                    secret_id=secret.id,
                    content=payload["notes"],
                    updated_by=_to_uuid(user_id),
                )
            )

    db.add(secret)
    db.commit()

    env_name = db.scalar(
        select(Environment.name).where(Environment.id == secret.environment_id)
    )
    return _to_secret_out(db, secret, env_name)


def delete_secret(db: Session, user_id: str, secret_id: str) -> Optional[Dict]:
    secret = get_secret_for_user(db, user_id, secret_id)
    if not secret:
        return None
    project_slug = resolve_project_slug(db, secret.project_id)
    secret_name = secret.name
    db.delete(secret)
    db.commit()
    return {"projectId": project_slug, "name": secret_name}


def find_secret_by_key(
    db: Session,
    user_id: str,
    project_slug: str,
    environment: EnvironmentEnum,
    key_name: str,
) -> Optional[Secret]:
    if not has_environment_read_access(db, user_id, project_slug, environment):
        return None

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return None
    env_id = resolve_environment_id(db, project_id, environment)
    if not env_id:
        return None

    return db.scalar(
        select(Secret).where(
            Secret.environment_id == env_id, Secret.key_name == key_name
        )
    )


def export_secrets(
    db: Session, user_id: str, project_slug: str, environment: EnvironmentEnum
) -> List[Dict]:
    if not has_environment_read_access(db, user_id, project_slug, environment):
        return []

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return []
    env_id = resolve_environment_id(db, project_id, environment)
    if not env_id:
        return []

    rows = db.execute(
        select(Secret).where(
            Secret.project_id == project_id, Secret.environment_id == env_id
        )
    ).scalars()
    return [
        {
            "key_name": row.key_name,
            "value_plain": decrypt_secret_value(row.value_encrypted),
        }
        for row in rows
    ]


def add_audit_event(
    db: Session,
    *,
    actor_user_id: str,
    project_slug: Optional[str],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    metadata: Optional[Dict] = None,
) -> None:
    project_id = resolve_project_id(db, project_slug) if project_slug else None
    event = AuditEvent(
        actor_user_id=_to_uuid(actor_user_id),
        project_id=project_id,
        action=action,
        target_type=target_type,
        target_id=_to_uuid(target_id) if target_id else None,
        metadata=metadata or {},
    )
    db.add(event)
    db.commit()


def list_audit_events(
    db: Session,
    *,
    action: Optional[str] = None,
    project_slug: Optional[str] = None,
    user_email: Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
) -> List[Dict]:
    query = (
        select(AuditEvent, User.email, Project.slug)
        .join(User, User.id == AuditEvent.actor_user_id, isouter=True)
        .join(Project, Project.id == AuditEvent.project_id, isouter=True)
    )

    if action:
        query = query.where(AuditEvent.action == action)
    if project_slug:
        query = query.where(Project.slug == project_slug)
    if user_email:
        query = query.where(User.email == user_email)
    if from_dt:
        query = query.where(AuditEvent.created_at >= from_dt)
    if to_dt:
        query = query.where(AuditEvent.created_at <= to_dt)

    rows = db.execute(query.order_by(AuditEvent.created_at.desc()).limit(200)).all()
    return [
        {
            "id": str(event.id),
            "action": event.action,
            "actor": email or "unknown",
            "projectId": slug or "unknown",
            "secretName": (event.metadata or {}).get("secretName", ""),
            "occurredAt": event.created_at,
        }
        for event, email, slug in rows
    ]
