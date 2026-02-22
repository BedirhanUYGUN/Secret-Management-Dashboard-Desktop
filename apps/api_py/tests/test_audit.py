"""Audit log testleri."""

from tests.conftest import (
    _assign_member,
    _auth_header,
    _login,
    _make_project,
    _make_user,
)

from app.db.models.enums import RoleEnum


class TestAuditCopy:
    def test_copy_event_kaydedilir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        # Bir secret olustur
        create_resp = client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "AWS_KEY",
                "value": "secret",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(token),
        )
        secret_id = create_resp.json()["id"]

        # Copy event gonder
        resp = client.post(
            "/audit/copy",
            json={"projectId": "proj", "secretId": secret_id},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_erisim_olmayan_proje_icin_copy_engellenir(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        member = _make_user(db, email="member@test.com", role=RoleEnum.member)
        admin = _make_user(db, email="admin2@test.com", role=RoleEnum.admin)
        project = _make_project(
            db, slug="gizli", name="Gizli", created_by=str(admin.id)
        )
        token = _login(client, "member@test.com")

        resp = client.post(
            "/audit/copy",
            json={"projectId": "gizli", "secretId": "fake-id"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403


class TestAuditList:
    def test_admin_audit_listeler(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        # Secret olustur (audit event uretir)
        client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "TEST_KEY",
                "value": "val",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(token),
        )

        resp = client.get("/audit", headers=_auth_header(token))
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) >= 1
        assert events[0]["action"] == "secret_created"

    def test_member_audit_erisemez(self, client, db):
        _make_user(db, email="member@test.com", role=RoleEnum.member)
        token = _login(client, "member@test.com")

        resp = client.get("/audit", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_audit_filtreleme(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        # Secret olustur
        client.post(
            "/projects/proj/secrets",
            json={
                "name": "Key",
                "provider": "AWS",
                "type": "key",
                "environment": "dev",
                "keyName": "FK",
                "value": "v",
                "tags": [],
                "notes": "",
            },
            headers=_auth_header(token),
        )

        # Action filtresi
        resp = client.get("/audit?action=secret_created", headers=_auth_header(token))
        assert resp.status_code == 200
        assert all(e["action"] == "secret_created" for e in resp.json())

        # Olmayan action
        resp2 = client.get("/audit?action=nonexistent", headers=_auth_header(token))
        assert resp2.status_code == 200
        assert len(resp2.json()) == 0
