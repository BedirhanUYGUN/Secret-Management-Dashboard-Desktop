import re
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.models import (
    AuditEvent,
    Environment,
    EnvironmentAccess,
    EnvironmentEnum,
    Project,
    ProjectInvite,
    ProjectMember,
    RoleEnum,
    User,
)
from app.db.repositories.users_repo import get_user_by_email
from app.schemas.auth import (
    RegisterOut,
    RegisterPurposeEnum,
    RegisterRequest,
)
from app.services.supabase_auth import create_supabase_user


INVITE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+"
INVITE_LENGTH = 12


def _hash_invite_code(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _generate_invite_code(length: int = INVITE_LENGTH) -> str:
    return "".join(secrets.choice(INVITE_CHARSET) for _ in range(length))


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "workspace"


def _unique_project_slug(db: Session, preferred: str) -> str:
    base = _slugify(preferred)
    candidate = base
    while db.scalar(select(Project.id).where(Project.slug == candidate)):
        suffix = secrets.token_hex(2)
        candidate = f"{base}-{suffix}"
    return candidate


def _create_default_environments(db: Session, project_id):
    for env_name in EnvironmentEnum:
        db.add(
            Environment(
                project_id=project_id,
                name=env_name,
                restricted=(env_name == EnvironmentEnum.prod),
            )
        )
    db.flush()


def _grant_owner_access(db: Session, project_id, user_id):
    envs = (
        db.execute(select(Environment).where(Environment.project_id == project_id))
        .scalars()
        .all()
    )
    for env in envs:
        db.add(
            EnvironmentAccess(
                environment_id=env.id,
                user_id=user_id,
                can_read=True,
                can_export=True,
            )
        )


def _grant_joined_viewer_access(db: Session, project_id, user_id):
    envs = (
        db.execute(select(Environment).where(Environment.project_id == project_id))
        .scalars()
        .all()
    )
    for env in envs:
        db.add(
            EnvironmentAccess(
                environment_id=env.id,
                user_id=user_id,
                can_read=not env.restricted,
                can_export=False,
            )
        )


def _create_project_with_owner(
    db: Session,
    *,
    user: User,
    project_name: str,
    description: str = "",
) -> Project:
    project = Project(
        slug=_unique_project_slug(db, project_name),
        name=project_name,
        description=description,
        created_by=user.id,
    )
    db.add(project)
    db.flush()

    _create_default_environments(db, project.id)
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role=RoleEnum.admin))
    _grant_owner_access(db, project.id, user.id)
    return project


def _create_project_invite(db: Session, *, project_id, created_by) -> str:
    code = _generate_invite_code()
    code_hash = _hash_invite_code(code)
    while db.scalar(select(ProjectInvite.id).where(ProjectInvite.code_hash == code_hash)):
        code = _generate_invite_code()
        code_hash = _hash_invite_code(code)

    db.add(
        ProjectInvite(
            project_id=project_id,
            code_hash=code_hash,
            created_by=created_by,
            is_active=True,
            max_uses=0,
            used_count=0,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=720),
        )
    )
    return code


def _join_project_by_invite(db: Session, *, user: User, invite_code: str) -> Project:
    if len(invite_code.strip()) != INVITE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code is invalid",
        )

    code_hash = _hash_invite_code(invite_code.strip())
    invite = db.scalar(
        select(ProjectInvite).where(
            ProjectInvite.code_hash == code_hash,
            ProjectInvite.is_active.is_(True),
        )
    )
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code is invalid",
        )

    now = datetime.now(timezone.utc)
    if invite.expires_at:
        expires_at = invite.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invite code is expired",
            )
    if invite.max_uses > 0 and invite.used_count >= invite.max_uses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code usage limit reached",
        )

    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == invite.project_id,
            ProjectMember.user_id == user.id,
        )
    )
    if existing:
        project = db.get(Project, invite.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        return project

    db.add(
        ProjectMember(project_id=invite.project_id, user_id=user.id, role=RoleEnum.viewer)
    )
    _grant_joined_viewer_access(db, invite.project_id, user.id)
    invite.used_count += 1
    invite.last_used_at = now
    db.add(invite)

    project = db.get(Project, invite.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def register_with_profile(db: Session, payload: RegisterRequest) -> RegisterOut:
    email = payload.email.strip().lower()
    first_name = payload.firstName.strip()
    last_name = payload.lastName.strip()
    display_name = f"{first_name} {last_name}".strip()

    if not first_name or not last_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="firstName and lastName are required",
        )

    existing = get_user_by_email(db, email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    settings = get_settings()
    supabase_user_id = None
    if settings.SUPABASE_AUTH_ENABLED:
        supabase_user = create_supabase_user(
            email=email,
            password=payload.password,
            display_name=display_name,
        )
        supabase_user_id = str(supabase_user["id"])

    user_role = (
        RoleEnum.viewer
        if (
            payload.purpose == RegisterPurposeEnum.organization
            and payload.organizationMode == "join"
        )
        else RoleEnum.member
    )

    user = User(
        supabase_user_id=supabase_user_id,
        email=email,
        display_name=display_name,
        role=user_role,
        password_hash=get_password_hash(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    invite_code = None
    membership_role = RoleEnum.admin

    if payload.purpose == RegisterPurposeEnum.personal:
        project = _create_project_with_owner(
            db,
            user=user,
            project_name=f"{display_name} Workspace",
            description="Personal workspace",
        )
    elif payload.organizationMode == "create":
        project = _create_project_with_owner(
            db,
            user=user,
            project_name=(payload.organizationName or "").strip(),
            description="Organization workspace",
        )
        invite_code = _create_project_invite(db, project_id=project.id, created_by=user.id)
        db.add(
            AuditEvent(
                actor_user_id=user.id,
                project_id=project.id,
                action="invite_created",
                target_type="project_invite",
                meta={"source": "register", "maxUses": 0, "expiresInHours": 720},
            )
        )
    else:
        project = _join_project_by_invite(
            db,
            user=user,
            invite_code=(payload.inviteCode or "").strip(),
        )
        membership_role = RoleEnum.viewer
        db.add(
            AuditEvent(
                actor_user_id=user.id,
                project_id=project.id,
                action="member_joined",
                target_type="project_member",
                target_id=user.id,
                meta={"source": "invite", "role": "viewer"},
            )
        )

    db.commit()

    return RegisterOut(
        userId=str(user.id),
        name=user.display_name,
        email=user.email,
        role=user.role,
        projectId=project.slug,
        projectName=project.name,
        membershipRole=membership_role,
        inviteCode=invite_code,
    )
