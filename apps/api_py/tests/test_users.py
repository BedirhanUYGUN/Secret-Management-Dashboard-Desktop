"""Kullanici CRUD testleri."""

from tests.conftest import _auth_header, _login, _make_user

from app.db.models.enums import RoleEnum


class TestUserList:
    def test_admin_kullanicilari_listeler(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        _make_user(
            db, email="user2@test.com", display_name="Ikinci", role=RoleEnum.member
        )
        token = _login(client, "admin@test.com")

        resp = client.get("/users", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_member_kullanicilari_listeleyebilir(self, client, db):
        _make_user(db, email="member@test.com", role=RoleEnum.member)
        token = _login(client, "member@test.com")

        resp = client.get("/users", headers=_auth_header(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_viewer_kullanicilari_listeleyemez(self, client, db):
        _make_user(db, email="viewer@test.com", role=RoleEnum.viewer)
        token = _login(client, "viewer@test.com")

        resp = client.get("/users", headers=_auth_header(token))
        assert resp.status_code == 403


class TestUserCreate:
    def test_admin_kullanici_olusturur(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/users",
            json={
                "email": "new@test.com",
                "displayName": "Yeni Kullanici",
                "role": "member",
                "password": "sifre123",
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new@test.com"
        assert data["displayName"] == "Yeni Kullanici"
        assert data["role"] == "member"
        assert data["isActive"] is True

    def test_ayni_email_ile_kullanici_olusturulamaz(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        _make_user(db, email="existing@test.com", role=RoleEnum.member)
        token = _login(client, "admin@test.com")

        resp = client.post(
            "/users",
            json={
                "email": "existing@test.com",
                "displayName": "Tekrar",
                "role": "member",
                "password": "sifre",
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 409


class TestUserUpdate:
    def test_admin_kullanici_gunceller(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        target = _make_user(
            db, email="target@test.com", display_name="Eski Ad", role=RoleEnum.member
        )
        token = _login(client, "admin@test.com")

        resp = client.patch(
            f"/users/{target.id}",
            json={"displayName": "Yeni Ad", "role": "viewer"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["displayName"] == "Yeni Ad"
        assert data["role"] == "viewer"

    def test_olmayan_kullanici_guncellenemez(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        resp = client.patch(
            "/users/00000000-0000-0000-0000-000000000000",
            json={"displayName": "Yok"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 404

    def test_kullanici_deaktif_edilir(self, client, db):
        _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        target = _make_user(db, email="target@test.com", role=RoleEnum.member)
        token = _login(client, "admin@test.com")

        resp = client.patch(
            f"/users/{target.id}",
            json={"isActive": False},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["isActive"] is False
