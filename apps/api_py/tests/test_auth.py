"""Auth endpoint testleri: login, refresh, logout."""

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException

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

    def test_login_supabase_enabled_iken_local_kullanici_supabase_ile_esitlenir(
        self, client, db, monkeypatch
    ):
        user = _make_user(
            db,
            email="bridge@test.com",
            display_name="Bridge User",
            password="pass123",
            role=RoleEnum.member,
        )

        monkeypatch.setattr(
            "app.services.auth_service.get_settings",
            lambda: SimpleNamespace(SUPABASE_AUTH_ENABLED=True),
        )

        state = {"attempt": 0}

        def fake_supabase_login(*, email: str, password: str):
            state["attempt"] += 1
            if state["attempt"] == 1:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            return {
                "accessToken": "supabase-access",
                "refreshToken": "supabase-refresh",
                "tokenType": "bearer",
                "expiresAt": datetime(2030, 1, 1, tzinfo=timezone.utc),
            }

        monkeypatch.setattr(
            "app.services.auth_service.login_with_supabase_password",
            fake_supabase_login,
        )
        monkeypatch.setattr(
            "app.services.auth_service.create_supabase_user",
            lambda **kwargs: {"id": "supabase-user-1"},
        )
        monkeypatch.setattr(
            "app.services.auth_service.resolve_user_from_supabase_token",
            lambda db, access_token: user,
        )

        resp = client.post(
            "/auth/login", json={"email": "bridge@test.com", "password": "pass123"}
        )

        assert resp.status_code == 200
        assert "accessToken" in resp.json()
        assert resp.json()["accessToken"] != "supabase-access"
        db.refresh(user)
        assert user.supabase_user_id == "supabase-user-1"


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

    def test_me_profile_guncelle(self, client, db):
        _make_user(db, email="user@test.com", display_name="Eski Ad")
        token = _login(client, "user@test.com")

        resp = client.patch(
            "/me/profile",
            json={"displayName": "Yeni Ad"},
            headers=_auth_header(token),
        )

        assert resp.status_code == 200
        assert resp.json()["name"] == "Yeni Ad"

    def test_me_sessions_listelenir_ve_sonlandirilir(self, client, db):
        _make_user(db, email="user@test.com", password="pass123")
        login_resp = client.post(
            "/auth/login", json={"email": "user@test.com", "password": "pass123"}
        )
        access_token = login_resp.json()["accessToken"]

        sessions_resp = client.get("/me/sessions", headers=_auth_header(access_token))
        assert sessions_resp.status_code == 200
        sessions = sessions_resp.json()
        assert len(sessions) == 1
        assert sessions[0]["sessionLabel"]

        revoke_resp = client.delete(
            f"/me/sessions/{sessions[0]['id']}", headers=_auth_header(access_token)
        )
        assert revoke_resp.status_code == 200

        sessions_after = client.get("/me/sessions", headers=_auth_header(access_token))
        assert sessions_after.status_code == 200
        assert sessions_after.json() == []
