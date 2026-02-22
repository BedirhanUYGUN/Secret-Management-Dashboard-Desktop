"""Import / Export testleri."""

import json

from tests.conftest import (
    _assign_member,
    _auth_header,
    _login,
    _make_project,
    _make_user,
)

from app.db.models.enums import RoleEnum


class TestImportPreview:
    def test_preview_basarili(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/imports/preview",
            json={"content": "[Apollo API]\nSTRIPE_KEY=sk_xxx\nDB_HOST=localhost"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["heading"] == "Apollo API"
        assert data["totalPairs"] == 2
        assert data["skipped"] == 0
        assert len(data["preview"]) == 2

    def test_preview_bos_icerik(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/imports/preview",
            json={"content": ""},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["totalPairs"] == 0

    def test_preview_member_erisemez(self, client, db):
        _make_user(db, email="member@test.com", role=RoleEnum.member)
        token = _login(client, "member@test.com")

        resp = client.post(
            "/imports/preview",
            json={"content": "KEY=val"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403


class TestImportCommit:
    def test_commit_basarili(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/imports/commit",
            json={
                "projectId": "proj",
                "environment": "dev",
                "content": "API_KEY=value1\nDB_URL=postgres://",
                "provider": "Imported",
                "type": "key",
                "conflictStrategy": "skip",
                "tags": ["imported"],
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["inserted"] == 2
        assert data["total"] == 2

    def test_commit_conflict_skip(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        # Ilk commit
        client.post(
            "/imports/commit",
            json={
                "projectId": "proj",
                "environment": "dev",
                "content": "EXISTING_KEY=old_value",
                "provider": "Imported",
                "type": "key",
                "conflictStrategy": "skip",
                "tags": [],
            },
            headers=_auth_header(token),
        )

        # Ikinci commit ayni key ile skip stratejisi
        resp = client.post(
            "/imports/commit",
            json={
                "projectId": "proj",
                "environment": "dev",
                "content": "EXISTING_KEY=new_value",
                "provider": "Imported",
                "type": "key",
                "conflictStrategy": "skip",
                "tags": [],
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["skipped"] == 1
        assert data["inserted"] == 0

    def test_commit_conflict_overwrite(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        # Ilk commit
        client.post(
            "/imports/commit",
            json={
                "projectId": "proj",
                "environment": "dev",
                "content": "KEY=old",
                "provider": "Imported",
                "type": "key",
                "conflictStrategy": "skip",
                "tags": [],
            },
            headers=_auth_header(token),
        )

        # Overwrite stratejisi ile ikinci commit
        resp = client.post(
            "/imports/commit",
            json={
                "projectId": "proj",
                "environment": "dev",
                "content": "KEY=new",
                "provider": "Imported",
                "type": "key",
                "conflictStrategy": "overwrite",
                "tags": [],
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1


class TestExport:
    def _seed_secrets(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        # Secret'lari import ile yukle
        client.post(
            "/imports/commit",
            json={
                "projectId": "proj",
                "environment": "dev",
                "content": "KEY_A=val_a\nKEY_B=val_b",
                "provider": "Imported",
                "type": "key",
                "conflictStrategy": "skip",
                "tags": ["api"],
            },
            headers=_auth_header(token),
        )
        return token

    def test_export_env_formati(self, client, db):
        token = self._seed_secrets(client, db)

        resp = client.get(
            "/exports/proj?env=dev&format=env",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        text = resp.text
        assert "KEY_A=val_a" in text
        assert "KEY_B=val_b" in text

    def test_export_json_formati(self, client, db):
        token = self._seed_secrets(client, db)

        resp = client.get(
            "/exports/proj?env=dev&format=json",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = json.loads(resp.text)
        assert data["KEY_A"] == "val_a"
        assert data["KEY_B"] == "val_b"

    def test_export_all_envs(self, client, db):
        token = self._seed_secrets(client, db)

        resp = client.get(
            "/exports/proj/all?format=json",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = json.loads(resp.text)
        assert "dev" in data

    def test_export_viewer_erisemez(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        viewer = _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(
            db, project_id=project.id, user_id=viewer.id, role=RoleEnum.viewer
        )
        token = _login(client, "viewer@test.com")

        resp = client.get(
            "/exports/proj?env=dev&format=env",
            headers=_auth_header(token),
        )
        assert resp.status_code == 403

    def test_export_tag_filtresi(self, client, db):
        token = self._seed_secrets(client, db)

        resp = client.get(
            "/exports/proj?env=dev&format=json&tag=api",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = json.loads(resp.text)
        # Tum secret'lar "api" tag'ine sahip
        assert len(data) == 2

    def test_export_olmayan_tag(self, client, db):
        token = self._seed_secrets(client, db)

        resp = client.get(
            "/exports/proj?env=dev&format=json&tag=nonexistent",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = json.loads(resp.text)
        assert len(data) == 0
