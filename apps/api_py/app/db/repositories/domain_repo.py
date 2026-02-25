from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
from typing import Dict, List, Optional, Union, cast
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
    ProjectInvite,
    ProjectMember,
    ProjectTag,
    RoleEnum,
    Secret,
    SecretNote,
    SecretTag,
    SecretTypeEnum,
    SecretVersion,
    User,
)


def _to_uuid(value: str) -> UUID:
    return UUID(value)


INVITE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+"
INVITE_LENGTH = 12


def _generate_invite_code(length: int = INVITE_LENGTH) -> str:
    return "".join(secrets.choice(INVITE_CHARSET) for _ in range(length))


def _hash_invite_code(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _normalize_env(env: Union[EnvironmentEnum, str]) -> EnvironmentEnum:
    if isinstance(env, EnvironmentEnum):
        return env
    return EnvironmentEnum(env)


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
    db: Session, project_id: UUID, env: Union[EnvironmentEnum, str]
) -> Optional[UUID]:
    try:
        env_enum = _normalize_env(env)
    except ValueError:
        return None

    return db.scalar(
        select(Environment.id).where(
            Environment.project_id == project_id, Environment.name == env_enum
        )
    )


def has_project_access(db: Session, user_id: str, project_slug: str) -> bool:
    result = db.scalar(
        select(func.count(ProjectMember.id))
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == _to_uuid(user_id), Project.slug == project_slug)
    )
    return int(result or 0) > 0


def get_project_member_role(
    db: Session, user_id: str, project_slug: str
) -> Optional[RoleEnum]:
    return db.scalar(
        select(ProjectMember.role)
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == _to_uuid(user_id), Project.slug == project_slug)
    )


def is_project_admin(db: Session, user_id: str, project_slug: str) -> bool:
    role = get_project_member_role(db, user_id, project_slug)
    return role == RoleEnum.admin


def has_environment_read_access(
    db: Session,
    user_id: str,
    project_slug: str,
    env: Union[EnvironmentEnum, str],
) -> bool:
    try:
        env_enum = _normalize_env(env)
    except ValueError:
        return False

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return False

    env_id = resolve_environment_id(db, project_id, env_enum)
    if not env_id:
        return False

    if env_enum != EnvironmentEnum.prod:
        return has_project_access(db, user_id, project_slug)

    can_read = db.scalar(
        select(EnvironmentAccess.can_read).where(
            EnvironmentAccess.environment_id == env_id,
            EnvironmentAccess.user_id == _to_uuid(user_id),
        )
    )
    return bool(can_read)


def has_environment_export_access(
    db: Session,
    user_id: str,
    project_slug: str,
    env: Union[EnvironmentEnum, str],
) -> bool:
    try:
        env_enum = _normalize_env(env)
    except ValueError:
        return False

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return False

    env_id = resolve_environment_id(db, project_id, env_enum)
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

    # Son guncelleyen kullanici
    updated_by_name: Optional[str] = None
    if secret.updated_by:
        updated_by_name = db.scalar(
            select(User.display_name).where(User.id == secret.updated_by)
        )

    # Son kopyalanma tarihi (audit tablosundan)
    last_copied_at = db.scalar(
        select(AuditEvent.created_at)
        .where(
            AuditEvent.action == "secret_copied",
            AuditEvent.target_id == secret.id,
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(1)
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
        "updatedByName": updated_by_name,
        "lastCopiedAt": last_copied_at,
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

    if not has_environment_read_access(db, user_id, project_slug, payload["environment"]):
        raise PermissionError("Forbidden")

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
    env_for_output = (
        env_name
        if env_name is not None
        else _normalize_env(payload["environment"])
    )
    return _to_secret_out(db, secret, cast(EnvironmentEnum, env_for_output))


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
    env_for_output = env_name if env_name is not None else EnvironmentEnum.dev
    return _to_secret_out(db, secret, cast(EnvironmentEnum, env_for_output))


def delete_secret(db: Session, user_id: str, secret_id: str) -> Optional[Dict]:
    secret = get_secret_for_user(db, user_id, secret_id)
    if not secret:
        return None
    project_slug = resolve_project_slug(db, secret.project_id)
    secret_name = secret.name
    secret_identifier = str(secret.id)
    db.delete(secret)
    db.commit()
    return {"projectId": project_slug, "name": secret_name, "id": secret_identifier}


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
    db: Session,
    user_id: str,
    project_slug: str,
    environment: EnvironmentEnum,
    tag: Optional[str] = None,
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

    result: List[Dict] = []
    for row in rows:
        if tag:
            secret_tags = [
                t.tag
                for t in db.execute(
                    select(SecretTag).where(SecretTag.secret_id == row.id)
                ).scalars()
            ]
            if tag not in secret_tags:
                continue
        result.append(
            {
                "key_name": row.key_name,
                "value_plain": decrypt_secret_value(row.value_encrypted),
            }
        )
    return result


def export_secrets_all_envs(
    db: Session,
    user_id: str,
    project_slug: str,
    tag: Optional[str] = None,
) -> Dict[str, List[Dict]]:
    """Tum ortamlar icin secret'lari export eder."""
    output: Dict[str, List[Dict]] = {}
    for env in EnvironmentEnum:
        if not has_environment_read_access(db, user_id, project_slug, env):
            continue
        if not has_environment_export_access(db, user_id, project_slug, env):
            continue
        rows = export_secrets(db, user_id, project_slug, env, tag=tag)
        if rows:
            output[env.value] = rows
    return output


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
        meta=metadata or {},
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
            "secretName": (event.meta or {}).get("secretName", ""),
            "occurredAt": event.created_at,
        }
        for event, email, slug in rows
    ]


# ---------------------------------------------------------------------------
# Project CRUD (admin only)
# ---------------------------------------------------------------------------


def _project_detail(db: Session, project: Project) -> Dict:
    tags = [
        item.tag
        for item in db.execute(
            select(ProjectTag).where(ProjectTag.project_id == project.id)
        ).scalars()
    ]
    members_rows = db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project.id)
    ).all()
    members = [
        {
            "userId": str(pm.user_id),
            "email": u.email,
            "displayName": u.display_name,
            "role": pm.role,
        }
        for pm, u in members_rows
    ]
    return {
        "id": str(project.id),
        "slug": project.slug,
        "name": project.name,
        "description": project.description or "",
        "tags": tags,
        "members": members,
    }


def list_all_projects(db: Session) -> List[Dict]:
    projects = db.execute(select(Project).order_by(Project.name.asc())).scalars().all()
    return [_project_detail(db, p) for p in projects]


def create_project(
    db: Session,
    *,
    slug: str,
    name: str,
    description: str,
    tags: List[str],
    created_by: str,
) -> Dict:
    existing = db.scalar(select(Project).where(Project.slug == slug))
    if existing:
        raise ValueError("Bu slug zaten kullanilmaktadir")

    project = Project(
        slug=slug,
        name=name,
        description=description,
        created_by=_to_uuid(created_by),
    )
    db.add(project)
    db.flush()

    # Default ortamlar olustur (local, dev, prod)
    for env_name in EnvironmentEnum:
        db.add(
            Environment(
                project_id=project.id,
                name=env_name,
                restricted=(env_name == EnvironmentEnum.prod),
            )
        )

    for tag in tags:
        db.add(ProjectTag(project_id=project.id, tag=tag))

    db.commit()
    db.refresh(project)
    return _project_detail(db, project)


def update_project(
    db: Session,
    project_id: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
) -> Optional[Dict]:
    project = db.get(Project, _to_uuid(project_id))
    if not project:
        return None

    if name is not None:
        project.name = name
    if description is not None:
        project.description = description

    if tags is not None:
        db.query(ProjectTag).filter(ProjectTag.project_id == project.id).delete()
        for tag in tags:
            db.add(ProjectTag(project_id=project.id, tag=tag))

    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_detail(db, project)


def delete_project(db: Session, project_id: str) -> bool:
    project = db.get(Project, _to_uuid(project_id))
    if not project:
        return False
    db.delete(project)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Project member management
# ---------------------------------------------------------------------------


def add_member_to_project(
    db: Session, project_id: str, user_id: str, role: Union[str, RoleEnum]
) -> Optional[Dict]:
    project = db.get(Project, _to_uuid(project_id))
    if not project:
        return None

    user = db.get(User, _to_uuid(user_id))
    if not user:
        return None

    role_enum: RoleEnum = RoleEnum(role)

    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == _to_uuid(user_id),
        )
    )
    if existing:
        existing.role = role_enum
        db.add(existing)
    else:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=_to_uuid(user_id),
                role=role_enum,
            )
        )

    # Non-prod ortamlara otomatik erisim ver
    envs = (
        db.execute(select(Environment).where(Environment.project_id == project.id))
        .scalars()
        .all()
    )
    for env in envs:
        if env.restricted:
            continue
        existing_access = db.scalar(
            select(EnvironmentAccess).where(
                EnvironmentAccess.environment_id == env.id,
                EnvironmentAccess.user_id == _to_uuid(user_id),
            )
        )
        if not existing_access:
            db.add(
                EnvironmentAccess(
                    environment_id=env.id,
                    user_id=_to_uuid(user_id),
                    can_read=True,
                    can_export=True,
                )
            )

    db.commit()
    return {
        "userId": str(user.id),
        "email": user.email,
        "displayName": user.display_name,
        "role": role_enum,
    }


def remove_member_from_project(db: Session, project_id: str, user_id: str) -> bool:
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == _to_uuid(project_id),
            ProjectMember.user_id == _to_uuid(user_id),
        )
    )
    if not member:
        return False

    # Ortam erisimlerini de temizle
    envs = (
        db.execute(
            select(Environment).where(Environment.project_id == _to_uuid(project_id))
        )
        .scalars()
        .all()
    )
    for env in envs:
        access = db.scalar(
            select(EnvironmentAccess).where(
                EnvironmentAccess.environment_id == env.id,
                EnvironmentAccess.user_id == _to_uuid(user_id),
            )
        )
        if access:
            db.delete(access)

    db.delete(member)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Environment access management
# ---------------------------------------------------------------------------


def set_environment_access(
    db: Session,
    project_id: str,
    user_id: str,
    env: EnvironmentEnum,
    can_read: bool,
    can_export: bool,
) -> bool:
    project_uuid = _to_uuid(project_id)
    env_id = resolve_environment_id(db, project_uuid, env)
    if not env_id:
        return False

    existing = db.scalar(
        select(EnvironmentAccess).where(
            EnvironmentAccess.environment_id == env_id,
            EnvironmentAccess.user_id == _to_uuid(user_id),
        )
    )
    if existing:
        existing.can_read = can_read
        existing.can_export = can_export
        db.add(existing)
    else:
        db.add(
            EnvironmentAccess(
                environment_id=env_id,
                user_id=_to_uuid(user_id),
                can_read=can_read,
                can_export=can_export,
            )
        )
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Organization invite management
# ---------------------------------------------------------------------------


def _project_invite_to_out(invite: ProjectInvite) -> Dict:
    return {
        "id": str(invite.id),
        "projectId": str(invite.project_id),
        "isActive": invite.is_active,
        "maxUses": invite.max_uses,
        "usedCount": invite.used_count,
        "expiresAt": invite.expires_at,
        "lastUsedAt": invite.last_used_at,
        "createdAt": invite.created_at,
        "codePreview": "hidden",
    }


def list_managed_organizations_for_user(db: Session, user_id: str) -> List[Dict]:
    rows = (
        db.execute(
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(
                ProjectMember.user_id == _to_uuid(user_id),
                ProjectMember.role == RoleEnum.admin,
            )
            .order_by(Project.name.asc())
        )
        .scalars()
        .all()
    )

    output: List[Dict] = []
    for project in rows:
        member_count = int(
            db.scalar(
                select(func.count(ProjectMember.id)).where(
                    ProjectMember.project_id == project.id
                )
            )
            or 0
        )
        output.append(
            {
                "projectId": project.slug,
                "projectName": project.name,
                "memberCount": member_count,
            }
        )
    return output


def list_project_invites_for_admin(
    db: Session, user_id: str, project_slug: str
) -> Optional[List[Dict]]:
    if not is_project_admin(db, user_id, project_slug):
        return None

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return []

    invites = (
        db.execute(
            select(ProjectInvite)
            .where(ProjectInvite.project_id == project_id)
            .order_by(ProjectInvite.created_at.desc())
            .limit(100)
        )
        .scalars()
        .all()
    )
    return [_project_invite_to_out(inv) for inv in invites]


def create_project_invite_for_admin(
    db: Session,
    *,
    user_id: str,
    project_slug: str,
    expires_in_hours: Optional[int] = 720,
    max_uses: Optional[int] = 0,
) -> Optional[Dict]:
    if not is_project_admin(db, user_id, project_slug):
        return None

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return None

    expires_at = None
    if expires_in_hours and expires_in_hours > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

    code = _generate_invite_code()
    code_hash = _hash_invite_code(code)
    while db.scalar(select(ProjectInvite.id).where(ProjectInvite.code_hash == code_hash)):
        code = _generate_invite_code()
        code_hash = _hash_invite_code(code)

    invite = ProjectInvite(
        project_id=project_id,
        code_hash=code_hash,
        created_by=_to_uuid(user_id),
        is_active=True,
        max_uses=max(max_uses or 0, 0),
        used_count=0,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    out = _project_invite_to_out(invite)
    out["code"] = code
    return out


def revoke_project_invite_for_admin(
    db: Session, user_id: str, project_slug: str, invite_id: str
) -> Optional[bool]:
    if not is_project_admin(db, user_id, project_slug):
        return None

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return False

    invite = db.scalar(
        select(ProjectInvite).where(
            ProjectInvite.id == _to_uuid(invite_id),
            ProjectInvite.project_id == project_id,
        )
    )
    if not invite:
        return False

    invite.is_active = False
    db.add(invite)
    db.commit()
    return True


def rotate_project_invite_for_admin(
    db: Session,
    *,
    user_id: str,
    project_slug: str,
    expires_in_hours: Optional[int] = 720,
    max_uses: Optional[int] = 0,
) -> Optional[Dict]:
    if not is_project_admin(db, user_id, project_slug):
        return None

    project_id = resolve_project_id(db, project_slug)
    if not project_id:
        return None

    active_invites = (
        db.execute(
            select(ProjectInvite).where(
                ProjectInvite.project_id == project_id,
                ProjectInvite.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    for invite in active_invites:
        invite.is_active = False
        db.add(invite)
    db.commit()

    return create_project_invite_for_admin(
        db,
        user_id=user_id,
        project_slug=project_slug,
        expires_in_hours=expires_in_hours,
        max_uses=max_uses,
    )
