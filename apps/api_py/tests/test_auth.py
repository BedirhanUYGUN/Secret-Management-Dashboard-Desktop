"""Auth endpoint testleri: login, refresh, logout."""

from tests.conftest import _auth_header, _login, _make_user

from app.db.models.enums import RoleEnum


class TestLogin:
    def test_login_basarili(self, client, db):
        _make_user(db, email="user@test.com", password="pass123")
        resp = client.post(
            "/auth/login", json={"email": "user@test.com", "password": "pass123"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "accessToken" in data
        assert "refreshToken" in data
        assert data["tokenType"] == "bearer"

    def test_login_yanlis_sifre(self, client, db):
        _make_user(db, email="user@test.com", password="dogru_sifre")
        resp = client.post(
            "/auth/login", json={"email": "user@test.com", "password": "yanlis"}
        )
        assert resp.status_code == 401

    def test_login_olmayan_kullanici(self, client):
        resp = client.post(
            "/auth/login", json={"email": "yok@test.com", "password": "pass"}
        )
        assert resp.status_code == 401

    def test_login_deaktif_kullanici(self, client, db):
        _make_user(
            db,
            email="inactive@test.com",
            password="pass123",
            is_active=False,
        )
        resp = client.post(
            "/auth/login", json={"email": "inactive@test.com", "password": "pass123"}
        )
        assert resp.status_code == 401


class TestRefresh:
    def test_refresh_basarili(self, client, db):
        _make_user(db, email="user@test.com", password="pass123")
        login_resp = client.post(
            "/auth/login", json={"email": "user@test.com", "password": "pass123"}
        )
        refresh_token = login_resp.json()["refreshToken"]

        resp = client.post("/auth/refresh", json={"refreshToken": refresh_token})
        assert resp.status_code == 200
        data = resp.json()
        assert "accessToken" in data
        assert "refreshToken" in data

    def test_refresh_gecersiz_token(self, client):
        resp = client.post("/auth/refresh", json={"refreshToken": "invalid-token"})
        assert resp.status_code == 401


class TestLogout:
    def test_logout_basarili(self, client, db):
        _make_user(db, email="user@test.com", password="pass123")
        login_resp = client.post(
            "/auth/login", json={"email": "user@test.com", "password": "pass123"}
        )
        refresh_token = login_resp.json()["refreshToken"]

        resp = client.post("/auth/logout", json={"refreshToken": refresh_token})
        assert resp.status_code == 200

        # Ayni refresh token ile tekrar refresh yapilamaz
        resp2 = client.post("/auth/refresh", json={"refreshToken": refresh_token})
        assert resp2.status_code == 401


class TestMe:
    def test_me_basarili(self, client, db):
        _make_user(
            db, email="admin@test.com", display_name="Admin", role=RoleEnum.admin
        )
        token = _login(client, "admin@test.com")

        resp = client.get("/me", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@test.com"
        assert data["name"] == "Admin"
        assert data["role"] == "admin"

    def test_me_token_olmadan(self, client):
        resp = client.get("/me")
        assert resp.status_code in (401, 403)

    def test_me_preferences_guncelle(self, client, db):
        _make_user(db, email="user@test.com")
        token = _login(client, "user@test.com")

        resp = client.patch(
            "/me/preferences",
            json={"maskValues": False, "clipboardSeconds": 60},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["preferences"]["maskValues"] is False
        assert data["preferences"]["clipboardSeconds"] == 60
