from types import SimpleNamespace

from sqlalchemy import select

from app.db.models import ProjectInvite, ProjectMember, RoleEnum, User
from tests.conftest import _make_user


class TestRegister:
    def test_personel_kaydi_workspace_ve_admin_uyelik_olusturur(self, client, db):
        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Ali",
                "lastName": "Yilmaz",
                "email": "ali@test.com",
                "password": "StrongPass1!",
                "purpose": "personal",
                "organizationMode": "create",
            },
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["role"] == "member"
        assert body["membershipRole"] == "admin"
        assert body["inviteCode"] is None

        user = db.scalar(select(User).where(User.email == "ali@test.com"))
        assert user is not None

        membership = db.scalar(
            select(ProjectMember).where(ProjectMember.user_id == user.id)
        )
        assert membership is not None
        assert membership.role == RoleEnum.admin

    def test_organizasyon_olusturma_davet_key_uretir(self, client, db):
        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Ayse",
                "lastName": "Kaya",
                "email": "ayse@test.com",
                "password": "StrongPass1!",
                "purpose": "organization",
                "organizationMode": "create",
                "organizationName": "Nova Labs",
            },
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["membershipRole"] == "admin"
        assert body["inviteCode"] is not None
        assert len(body["inviteCode"]) == 12

        owner = db.scalar(select(User).where(User.email == "ayse@test.com"))
        assert owner is not None

        invite = db.scalar(select(ProjectInvite).where(ProjectInvite.created_by == owner.id))
        assert invite is not None
        assert invite.code_hash != body["inviteCode"]

    def test_davet_key_ile_katilan_kullanici_viewer_olur(self, client, db):
        owner_resp = client.post(
            "/auth/register",
            json={
                "firstName": "Org",
                "lastName": "Owner",
                "email": "owner@test.com",
                "password": "StrongPass1!",
                "purpose": "organization",
                "organizationMode": "create",
                "organizationName": "Apollo Team",
            },
        )
        assert owner_resp.status_code == 201
        invite_code = owner_resp.json()["inviteCode"]

        join_resp = client.post(
            "/auth/register",
            json={
                "firstName": "Can",
                "lastName": "Demir",
                "email": "can@test.com",
                "password": "StrongPass1!",
                "purpose": "organization",
                "organizationMode": "join",
                "inviteCode": invite_code,
            },
        )
        assert join_resp.status_code == 201
        body = join_resp.json()
        assert body["role"] == "viewer"
        assert body["membershipRole"] == "viewer"

        user = db.scalar(select(User).where(User.email == "can@test.com"))
        assert user is not None
        assert user.role == RoleEnum.viewer

        membership = db.scalar(
            select(ProjectMember).where(
                ProjectMember.user_id == user.id,
            )
        )
        assert membership is not None
        assert membership.role == RoleEnum.viewer

    def test_register_zayif_sifre_icin_422_doner(self, client):
        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Ali",
                "lastName": "Yilmaz",
                "email": "weak@test.com",
                "password": "weakpass",
                "purpose": "personal",
                "organizationMode": "create",
            },
        )
        assert resp.status_code == 422

    def test_register_supabase_acik_eski_lokal_kullanici_uzerine_yazilir(
        self, client, db, monkeypatch
    ):
        """Supabase acikken lokal'de eski kayit varsa, uzerine yazilir (201)."""
        _make_user(db, email="legacy@test.com", password="StrongPass1!")
        monkeypatch.setattr(
            "app.services.registration_service.get_settings",
            lambda: SimpleNamespace(SUPABASE_AUTH_ENABLED=True),
        )
        monkeypatch.setattr(
            "app.services.registration_service.create_supabase_user",
            lambda **kw: {"id": "sup-new-id-1234"},
        )

        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Legacy",
                "lastName": "User",
                "email": "legacy@test.com",
                "password": "StrongPass1!",
                "purpose": "personal",
                "organizationMode": "create",
            },
        )

        assert resp.status_code == 201
        user = db.scalar(select(User).where(User.email == "legacy@test.com"))
        assert user is not None
        assert user.supabase_user_id == "sup-new-id-1234"
        assert user.is_active is True

    def test_register_supabase_email_mevcut_409_doner(self, client, db, monkeypatch):
        """Supabase'de email zaten varsa 409 doner."""
        from fastapi import HTTPException, status

        monkeypatch.setattr(
            "app.services.registration_service.get_settings",
            lambda: SimpleNamespace(SUPABASE_AUTH_ENABLED=True),
        )

        def _raise_409(**kw):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        monkeypatch.setattr(
            "app.services.registration_service.create_supabase_user",
            _raise_409,
        )

        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "exists@test.com",
                "password": "StrongPass1!",
                "purpose": "personal",
                "organizationMode": "create",
            },
        )

        assert resp.status_code == 409

    def test_register_supabase_yeni_kullanici_201(self, client, db, monkeypatch):
        """Supabase acik, lokal'de kayit yok: yeni kullanici olusturulur."""
        monkeypatch.setattr(
            "app.services.registration_service.get_settings",
            lambda: SimpleNamespace(SUPABASE_AUTH_ENABLED=True),
        )
        monkeypatch.setattr(
            "app.services.registration_service.create_supabase_user",
            lambda **kw: {"id": "sup-brand-new-5678"},
        )

        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Yeni",
                "lastName": "Kullanici",
                "email": "yeni@test.com",
                "password": "StrongPass1!",
                "purpose": "personal",
                "organizationMode": "create",
            },
        )

        assert resp.status_code == 201
        user = db.scalar(select(User).where(User.email == "yeni@test.com"))
        assert user is not None
        assert user.supabase_user_id == "sup-brand-new-5678"

    def test_register_rate_limit_asilirsa_429_doner(self, client, monkeypatch):
        monkeypatch.setattr(
            "app.api.routes.auth.check_rate_limit",
            lambda **kwargs: False,
        )

        resp = client.post(
            "/auth/register",
            json={
                "firstName": "Ali",
                "lastName": "Yilmaz",
                "email": "ali-limit@test.com",
                "password": "StrongPass1!",
                "purpose": "personal",
                "organizationMode": "create",
            },
        )
        assert resp.status_code == 429
