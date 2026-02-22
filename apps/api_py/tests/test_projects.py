"""Proje CRUD testleri."""

from tests.conftest import (
    _assign_member,
    _auth_header,
    _login,
    _make_project,
    _make_user,
)

from app.db.models.enums import RoleEnum


class TestProjectList:
    def test_kullaniciya_atanmis_projeleri_listeler(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(
            db, slug="proj-1", name="Proje 1", created_by=str(admin.id)
        )
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        resp = client.get("/projects", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Proje 1"
        assert "keyCount" in data[0]

    def test_atanmamis_projeleri_gormez(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        member = _make_user(db, email="member@test.com", role=RoleEnum.member)
        _make_project(db, slug="gizli", name="Gizli Proje", created_by=str(admin.id))
        token = _login(client, "member@test.com")

        resp = client.get("/projects", headers=_auth_header(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 0


class TestProjectManageCRUD:
    def test_admin_proje_olusturur(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/projects/manage",
            json={
                "name": "Yeni Proje",
                "slug": "yeni-proje",
                "description": "Aciklama",
                "tags": ["api", "web"],
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Yeni Proje"
        assert data["slug"] == "yeni-proje"
        assert "api" in data["tags"]

    def test_ayni_slug_ile_olusturulamaz(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        _make_project(db, slug="mevcut", name="Mevcut", created_by=str(admin.id))
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/projects/manage",
            json={"name": "Tekrar", "slug": "mevcut"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 409

    def test_admin_projeyi_gunceller(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Eski", created_by=str(admin.id))
        token = _login(client, "admin@test.com")

        resp = client.patch(
            f"/projects/manage/{project.id}",
            json={"name": "Yeni Ad", "tags": ["updated"]},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Yeni Ad"
        assert "updated" in resp.json()["tags"]

    def test_admin_projeyi_siler(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(
            db, slug="silinecek", name="Silinecek", created_by=str(admin.id)
        )
        token = _login(client, "admin@test.com")

        resp = client.delete(
            f"/projects/manage/{project.id}", headers=_auth_header(token)
        )
        assert resp.status_code == 204

        # Silinen proje tekrar listelenemez
        resp2 = client.get("/projects/manage", headers=_auth_header(token))
        assert len(resp2.json()) == 0

    def test_member_proje_yonetemez(self, client, db):
        _make_user(db, email="member@test.com", role=RoleEnum.member)
        token = _login(client, "member@test.com")

        resp = client.get("/projects/manage", headers=_auth_header(token))
        assert resp.status_code == 403


class TestProjectMembers:
    def test_uye_eklenir_ve_cikarilir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        member = _make_user(db, email="member@test.com", role=RoleEnum.member)
        project = _make_project(db, slug="proj", name="Test", created_by=str(admin.id))
        token = _login(client, "admin@test.com")

        # Uye ekle
        resp = client.post(
            f"/projects/manage/{project.id}/members",
            json={"userId": str(member.id), "role": "member"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "member@test.com"

        # Uye cikar
        resp2 = client.delete(
            f"/projects/manage/{project.id}/members/{member.id}",
            headers=_auth_header(token),
        )
        assert resp2.status_code == 204
