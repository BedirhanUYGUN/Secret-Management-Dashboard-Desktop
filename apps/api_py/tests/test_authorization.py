"""Yetkilendirme testleri: rol bazli erisim kontrolleri."""

from tests.conftest import (
    _assign_member,
    _auth_header,
    _login,
    _make_project,
    _make_user,
)

from app.db.models.enums import RoleEnum


class TestViewerKisitlamalari:
    """Viewer rolu: sadece okuma, CRUD yapamaz."""

    def test_viewer_secret_olusturamaz(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        viewer = _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(
            db, project_id=project.id, user_id=viewer.id, role=RoleEnum.viewer
        )
        token = _login(client, "viewer@test.com")

        resp = client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "K",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 403

    def test_viewer_secret_guncelleyemez(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        viewer = _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        _assign_member(
            db, project_id=project.id, user_id=viewer.id, role=RoleEnum.viewer
        )

        admin_token = _login(client, "admin@test.com")
        resp = client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "K",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(admin_token),
        )
        secret_id = resp.json()["id"]

        viewer_token = _login(client, "viewer@test.com")
        resp2 = client.patch(
            f"/secrets/{secret_id}",
            json={"name": "Hacked"},
            headers=_auth_header(viewer_token),
        )
        assert resp2.status_code == 403

    def test_viewer_secret_silemez(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        viewer = _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)

        admin_token = _login(client, "admin@test.com")
        resp = client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "K",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(admin_token),
        )
        secret_id = resp.json()["id"]

        viewer_token = _login(client, "viewer@test.com")
        resp2 = client.delete(
            f"/secrets/{secret_id}", headers=_auth_header(viewer_token)
        )
        assert resp2.status_code == 403

    def test_viewer_kullanici_yonetemez(self, client, db):
        _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        token = _login(client, "viewer@test.com")

        resp = client.get("/users", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_viewer_proje_yonetemez(self, client, db):
        _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        token = _login(client, "viewer@test.com")

        resp = client.get("/projects/manage", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_viewer_import_yapamaz(self, client, db):
        _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        token = _login(client, "viewer@test.com")

        resp = client.post(
            "/imports/preview",
            json={"content": "KEY=val"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403


class TestMemberKisitlamalari:
    """Member rolu: secret CRUD yapabilir, kullanici/proje yonetemez."""

    def test_member_secret_olusturabilir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        member = _make_user(db, email="member@test.com", role=RoleEnum.member)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(
            db, project_id=project.id, user_id=member.id, role=RoleEnum.member
        )
        token = _login(client, "member@test.com")

        resp = client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "MK",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

    def test_member_secret_silemez(self, client, db):
        """Sadece admin secret silebilir."""
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        member = _make_user(db, email="member@test.com", role=RoleEnum.member)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        _assign_member(
            db, project_id=project.id, user_id=member.id, role=RoleEnum.member
        )

        admin_token = _login(client, "admin@test.com")
        resp = client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "K2",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(admin_token),
        )
        secret_id = resp.json()["id"]

        member_token = _login(client, "member@test.com")
        resp2 = client.delete(
            f"/secrets/{secret_id}", headers=_auth_header(member_token)
        )
        assert resp2.status_code == 403

    def test_member_kullanici_yonetemez(self, client, db):
        _make_user(db, email="member@test.com", role=RoleEnum.member)
        token = _login(client, "member@test.com")

        resp = client.get("/users", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_member_proje_yonetemez(self, client, db):
        _make_user(db, email="member@test.com", role=RoleEnum.member)
        token = _login(client, "member@test.com")

        resp = client.post(
            "/projects/manage",
            json={"name": "Hack", "slug": "hack"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403

    def test_uye_olmadigi_projeye_secret_olusturamaz(self, client, db):
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)
        stranger = _make_user(db, email="stranger@test.com", role=RoleEnum.member)
        _make_project(db, slug="gizli", name="Gizli", created_by=str(owner.id))
        token = _login(client, "stranger@test.com")

        resp = client.post(
            "/projects/gizli/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "HIDDEN_KEY",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 403


class TestTokensuzErisim:
    def test_tokensuz_projects(self, client):
        resp = client.get("/projects")
        assert resp.status_code in (401, 403)

    def test_tokensuz_secrets(self, client):
        resp = client.get("/projects/proj/secrets")
        assert resp.status_code in (401, 403)

    def test_tokensuz_users(self, client):
        resp = client.get("/users")
        assert resp.status_code in (401, 403)

    def test_tokensuz_audit(self, client):
        resp = client.get("/audit")
        assert resp.status_code in (401, 403)
