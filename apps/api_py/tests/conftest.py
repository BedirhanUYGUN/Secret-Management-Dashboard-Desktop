"""
Test altyapisi: SQLite in-memory DB ile FastAPI TestClient.

PostgreSQL bagimliligi olmadan tum endpoint'leri test eder.
JSONB -> JSON uyumu icin SQLite event listener kullanir.
"""

import base64
import os
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# --- Ortam degiskenleri (modul import'larindan ONCE ayarlanmali) ---
_test_encryption_key = base64.urlsafe_b64encode(os.urandom(32)).decode()

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-that-is-at-least-32-chars-long!!"
os.environ["SECRET_ENCRYPTION_KEY"] = _test_encryption_key
os.environ["APP_ENV"] = "test"

# --- Simdi guvenle import edebiliriz ---
from app.core.config import get_settings  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.models import (  # noqa: E402
    Environment,
    EnvironmentAccess,
    EnvironmentEnum,
    Project,
    ProjectMember,
    RoleEnum,
    User,
)
from app.main import app  # noqa: E402

# lru_cache temizle ki test settings kullanilsin
get_settings.cache_clear()

# ---------------------------------------------------------------------------
# SQLite uyumu: JSONB -> JSON (compiler seviyesinde)
# ---------------------------------------------------------------------------

from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


# ---------------------------------------------------------------------------
# SQLite uyumu: Uuid -> CHAR(32) olarak sakla (native_uuid=False)
# ---------------------------------------------------------------------------

import uuid as _uuid_mod  # noqa: E402

from sqlalchemy import Uuid  # noqa: E402


@compiles(Uuid, "sqlite")
def _compile_uuid_sqlite(element, compiler, **kw):
    """SQLite'da UUID'leri CHAR(32) string olarak sakla."""
    return "CHAR(32)"


# Uuid tipinin bind_processor'ini override ederek string kabul etmesini sagla
_original_uuid_bind_processor = Uuid.bind_processor


def _patched_uuid_bind_processor(self, dialect):
    if dialect.name == "sqlite":

        def process(value):
            if value is None:
                return value
            if isinstance(value, _uuid_mod.UUID):
                return value.hex
            if isinstance(value, str):
                return _uuid_mod.UUID(value).hex
            if isinstance(value, bytes):
                return _uuid_mod.UUID(bytes=value).hex
            return value

        return process
    return _original_uuid_bind_processor(self, dialect)


Uuid.bind_processor = _patched_uuid_bind_processor  # type: ignore[assignment]


# Uuid tipinin result_processor'ini de override ederek hex -> UUID donusumu sagla
_original_uuid_result_processor = Uuid.result_processor


def _patched_uuid_result_processor(self, dialect, coltype):
    if dialect.name == "sqlite":

        def process(value):
            if value is None:
                return value
            if isinstance(value, _uuid_mod.UUID):
                return value
            if isinstance(value, str):
                try:
                    return _uuid_mod.UUID(value)
                except ValueError:
                    return _uuid_mod.UUID(hex=value)
            if isinstance(value, bytes):
                return _uuid_mod.UUID(bytes=value)
            return value

        return process
    return _original_uuid_result_processor(self, dialect)


Uuid.result_processor = _patched_uuid_result_processor  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Test engine & session
# ---------------------------------------------------------------------------

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# SQLite foreign key desteğini aktif et
@event.listens_for(TEST_ENGINE, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSession = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)


def _override_get_db() -> Generator[Session, None, None]:
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """Test oturumu basinda tablolari olustur, sonunda kaldir."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def _clean_tables():
    """Her testten sonra tum tablolari temizle."""
    yield
    db = TestSession()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    """Testler icin veritabani oturumu."""
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client() -> TestClient:
    """FastAPI test istemcisi (DB override ile)."""
    from app.api.deps import get_db_session

    app.dependency_overrides[get_db_session] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Seed data helpers
# ---------------------------------------------------------------------------


def _make_user(
    db: Session,
    *,
    email: str = "admin@test.com",
    display_name: str = "Test Admin",
    role: RoleEnum = RoleEnum.admin,
    password: str = "testpass123",
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        role=role,
        password_hash=get_password_hash(password),
        is_active=is_active,
        preferences={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_project(
    db: Session,
    *,
    slug: str = "test-project",
    name: str = "Test Project",
    created_by,
) -> Project:
    """created_by: UUID nesnesi veya string kabul eder."""
    import uuid as _uuid

    if isinstance(created_by, str):
        created_by = _uuid.UUID(created_by)
    project = Project(slug=slug, name=name, created_by=created_by)
    db.add(project)
    db.flush()

    for env_name in EnvironmentEnum:
        db.add(
            Environment(
                project_id=project.id,
                name=env_name,
                restricted=(env_name == EnvironmentEnum.prod),
            )
        )
    db.commit()
    db.refresh(project)
    return project


def _assign_member(
    db: Session,
    *,
    project_id,
    user_id,
    role: RoleEnum = RoleEnum.admin,
    grant_envs: bool = True,
) -> None:
    db.add(ProjectMember(project_id=project_id, user_id=user_id, role=role))
    db.flush()

    if grant_envs:
        from sqlalchemy import select

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
    db.commit()


def _login(
    client: TestClient, email: str = "admin@test.com", password: str = "testpass123"
) -> str:
    """Login yapip access token dondurur."""
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Convenience fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def admin_user(db: Session) -> User:
    return _make_user(
        db, email="admin@test.com", display_name="Admin User", role=RoleEnum.admin
    )


@pytest.fixture()
def member_user(db: Session) -> User:
    return _make_user(
        db, email="member@test.com", display_name="Member User", role=RoleEnum.member
    )


@pytest.fixture()
def viewer_user(db: Session) -> User:
    return _make_user(
        db, email="viewer@test.com", display_name="Viewer User", role=RoleEnum.viewer
    )


@pytest.fixture()
def project_with_admin(db: Session, admin_user: User) -> Project:
    project = _make_project(
        db, slug="apollo-api", name="Apollo API", created_by=str(admin_user.id)
    )
    _assign_member(
        db, project_id=project.id, user_id=admin_user.id, role=RoleEnum.admin
    )
    return project


@pytest.fixture()
def admin_token(client: TestClient, admin_user: User) -> str:
    return _login(client, "admin@test.com")


@pytest.fixture()
def member_token(client: TestClient, member_user: User) -> str:
    return _login(client, "member@test.com")


@pytest.fixture()
def viewer_token(client: TestClient, viewer_user: User) -> str:
    return _login(client, "viewer@test.com")
