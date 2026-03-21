from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.db.models import (
    AuditEvent,
    Environment,
    Project,
    ProjectMember,
    Secret,
    User,
)
from app.db.models.enums import RoleEnum
from app.schemas.dashboard import DashboardStatsOut, RecentActivityOut


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    is_admin = user.role == RoleEnum.admin
    user_id = user.id

    # --- Total secrets ---
    if is_admin:
        total_secrets = int(
            db.scalar(select(func.count(Secret.id))) or 0
        )
    else:
        total_secrets = int(
            db.scalar(
                select(func.count(Secret.id))
                .join(ProjectMember, ProjectMember.project_id == Secret.project_id)
                .where(ProjectMember.user_id == user_id)
            )
            or 0
        )

    # --- Total projects ---
    if is_admin:
        total_projects = int(
            db.scalar(select(func.count(Project.id))) or 0
        )
    else:
        total_projects = int(
            db.scalar(
                select(func.count(ProjectMember.id)).where(
                    ProjectMember.user_id == user_id
                )
            )
            or 0
        )

    # --- Total members (distinct users across accessible projects) ---
    if is_admin:
        total_members = int(
            db.scalar(
                select(func.count(func.distinct(ProjectMember.user_id)))
            )
            or 0
        )
    else:
        accessible_project_ids = select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id
        )
        total_members = int(
            db.scalar(
                select(func.count(func.distinct(ProjectMember.user_id))).where(
                    ProjectMember.project_id.in_(accessible_project_ids)
                )
            )
            or 0
        )

    # --- Recent activity (last 10 audit events) ---
    if is_admin:
        audit_query = (
            select(AuditEvent, User.email, Project.slug)
            .join(User, User.id == AuditEvent.actor_user_id, isouter=True)
            .join(Project, Project.id == AuditEvent.project_id, isouter=True)
            .order_by(AuditEvent.created_at.desc())
            .limit(10)
        )
    else:
        accessible_project_ids_sub = select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id
        )
        audit_query = (
            select(AuditEvent, User.email, Project.slug)
            .join(User, User.id == AuditEvent.actor_user_id, isouter=True)
            .join(Project, Project.id == AuditEvent.project_id, isouter=True)
            .where(AuditEvent.project_id.in_(accessible_project_ids_sub))
            .order_by(AuditEvent.created_at.desc())
            .limit(10)
        )

    audit_rows = db.execute(audit_query).all()
    recent_activity: List[Dict] = [
        {
            "id": str(event.id),
            "action": event.action,
            "actor": email or "unknown",
            "projectId": slug or "unknown",
            "secretName": (event.meta or {}).get("secretName", ""),
            "occurredAt": event.created_at,
        }
        for event, email, slug in audit_rows
    ]

    # --- Secrets by environment ---
    if is_admin:
        env_query = (
            select(Environment.name, func.count(Secret.id))
            .join(Secret, Secret.environment_id == Environment.id)
            .group_by(Environment.name)
        )
    else:
        env_query = (
            select(Environment.name, func.count(Secret.id))
            .join(Secret, Secret.environment_id == Environment.id)
            .join(ProjectMember, ProjectMember.project_id == Secret.project_id)
            .where(ProjectMember.user_id == user_id)
            .group_by(Environment.name)
        )

    env_rows = db.execute(env_query).all()
    secrets_by_environment: Dict[str, int] = {
        env_name.value: count for env_name, count in env_rows
    }

    # --- Secrets by provider ---
    if is_admin:
        provider_query = (
            select(Secret.provider, func.count(Secret.id)).group_by(Secret.provider)
        )
    else:
        provider_query = (
            select(Secret.provider, func.count(Secret.id))
            .join(ProjectMember, ProjectMember.project_id == Secret.project_id)
            .where(ProjectMember.user_id == user_id)
            .group_by(Secret.provider)
        )

    provider_rows = db.execute(provider_query).all()
    secrets_by_provider: Dict[str, int] = {
        provider: count for provider, count in provider_rows
    }

    return DashboardStatsOut(
        totalSecrets=total_secrets,
        totalProjects=total_projects,
        totalMembers=total_members,
        recentActivity=recent_activity,
        secretsByEnvironment=secrets_by_environment,
        secretsByProvider=secrets_by_provider,
    )
