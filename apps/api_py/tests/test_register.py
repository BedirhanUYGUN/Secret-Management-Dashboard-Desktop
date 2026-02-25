from sqlalchemy import select

from app.db.models import ProjectInvite, ProjectMember, RoleEnum, User


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
