from app.core.crypto import encrypt_secret_value
from app.core.security import get_password_hash
from app.db.models import (
    Environment,
    EnvironmentAccess,
    EnvironmentEnum,
    Project,
    ProjectMember,
    ProjectTag,
    RoleEnum,
    Secret,
    SecretNote,
    SecretTag,
    SecretTypeEnum,
    User,
)
from app.db.session import SessionLocal


def ensure_user(db, email: str, name: str, role: RoleEnum, password: str):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    user = User(
        email=email,
        display_name=name,
        role=role,
        password_hash=get_password_hash(password),
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def ensure_project(db, slug: str, name: str, created_by):
    existing = db.query(Project).filter(Project.slug == slug).first()
    if existing:
        return existing
    row = Project(slug=slug, name=name, created_by=created_by.id)
    db.add(row)
    db.flush()
    return row


def ensure_environment(db, project_id, env_name: EnvironmentEnum, restricted: bool):
    existing = (
        db.query(Environment)
        .filter(Environment.project_id == project_id, Environment.name == env_name)
        .first()
    )
    if existing:
        return existing
    row = Environment(project_id=project_id, name=env_name, restricted=restricted)
    db.add(row)
    db.flush()
    return row


def upsert_access(db, env_id, user_id, can_read: bool, can_export: bool):
    row = (
        db.query(EnvironmentAccess)
        .filter(
            EnvironmentAccess.environment_id == env_id,
            EnvironmentAccess.user_id == user_id,
        )
        .first()
    )
    if row:
        row.can_read = can_read
        row.can_export = can_export
    else:
        row = EnvironmentAccess(
            environment_id=env_id,
            user_id=user_id,
            can_read=can_read,
            can_export=can_export,
        )
        db.add(row)


def run():
    db = SessionLocal()
    try:
        admin = ensure_user(
            db, "admin@company.local", "Aylin Admin", RoleEnum.admin, "admin123"
        )
        member = ensure_user(
            db, "member@company.local", "Deniz Dev", RoleEnum.member, "member123"
        )
        viewer = ensure_user(
            db, "viewer@company.local", "Mert Ops", RoleEnum.viewer, "viewer123"
        )

        apollo = ensure_project(db, "apollo", "Apollo API", admin)
        atlas = ensure_project(db, "atlas", "Atlas Core", admin)
        nova = ensure_project(db, "nova", "Nova Analytics", admin)

        for project, tags in [
            (apollo, ["payments", "critical"]),
            (atlas, ["backend"]),
            (nova, ["data", "internal"]),
        ]:
            for tag in tags:
                if (
                    not db.query(ProjectTag)
                    .filter(ProjectTag.project_id == project.id, ProjectTag.tag == tag)
                    .first()
                ):
                    db.add(ProjectTag(project_id=project.id, tag=tag))

        for project, user, role in [
            (apollo, admin, RoleEnum.admin),
            (atlas, admin, RoleEnum.admin),
            (nova, admin, RoleEnum.admin),
            (apollo, member, RoleEnum.member),
            (atlas, member, RoleEnum.member),
            (apollo, viewer, RoleEnum.viewer),
        ]:
            if (
                not db.query(ProjectMember)
                .filter(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                )
                .first()
            ):
                db.add(ProjectMember(project_id=project.id, user_id=user.id, role=role))

        env_map = {}
        for project in [apollo, atlas, nova]:
            env_map[(project.slug, "local")] = ensure_environment(
                db, project.id, EnvironmentEnum.local, False
            )
            env_map[(project.slug, "dev")] = ensure_environment(
                db, project.id, EnvironmentEnum.dev, False
            )
            env_map[(project.slug, "prod")] = ensure_environment(
                db, project.id, EnvironmentEnum.prod, True
            )

        for key, env in env_map.items():
            upsert_access(db, env.id, admin.id, True, True)

        upsert_access(db, env_map[("apollo", "local")].id, member.id, True, True)
        upsert_access(db, env_map[("apollo", "dev")].id, member.id, True, True)
        upsert_access(db, env_map[("apollo", "prod")].id, member.id, False, False)
        upsert_access(db, env_map[("atlas", "local")].id, member.id, True, True)
        upsert_access(db, env_map[("atlas", "dev")].id, member.id, True, True)
        upsert_access(db, env_map[("atlas", "prod")].id, member.id, True, True)

        upsert_access(db, env_map[("apollo", "local")].id, viewer.id, True, False)
        upsert_access(db, env_map[("apollo", "dev")].id, viewer.id, True, False)
        upsert_access(db, env_map[("apollo", "prod")].id, viewer.id, False, False)

        def ensure_secret(
            project, env, name, provider, stype, key_name, value, tags, notes
        ):
            row = (
                db.query(Secret)
                .filter(
                    Secret.project_id == project.id,
                    Secret.environment_id == env.id,
                    Secret.key_name == key_name,
                )
                .first()
            )
            if row:
                return row
            row = Secret(
                project_id=project.id,
                environment_id=env.id,
                name=name,
                provider=provider,
                type=stype,
                key_name=key_name,
                value_encrypted=encrypt_secret_value(value),
                key_version=1,
                created_by=admin.id,
                updated_by=admin.id,
            )
            db.add(row)
            db.flush()
            for tag in tags:
                db.add(SecretTag(secret_id=row.id, tag=tag))
            db.add(SecretNote(secret_id=row.id, content=notes, updated_by=admin.id))
            return row

        ensure_secret(
            apollo,
            env_map[("apollo", "prod")],
            "Stripe Payments",
            "Stripe",
            SecretTypeEnum.key,
            "STRIPE_API_KEY",
            "sk_live_51Mz_Real8Xy9",
            ["billing", "prod"],
            "Primary production key for billing.",
        )
        ensure_secret(
            apollo,
            env_map[("apollo", "dev")],
            "Vercel Deploy Hook",
            "Vercel",
            SecretTypeEnum.endpoint,
            "VERCEL_DEPLOY_HOOK",
            "https://api.vercel.com/v1/integrations/deploy/prj_123",
            ["deploy"],
            "Used for dev deploy trigger.",
        )
        ensure_secret(
            atlas,
            env_map[("atlas", "dev")],
            "Algolia Search",
            "Algolia",
            SecretTypeEnum.token,
            "ALGOLIA_SEARCH_KEY",
            "search_only_abc001",
            ["search"],
            "Search key for Atlas index.",
        )

        db.commit()
        print("Seed completed")
    finally:
        db.close()


if __name__ == "__main__":
    run()
