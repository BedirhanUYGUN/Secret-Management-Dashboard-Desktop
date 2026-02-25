from sqlalchemy import select

from app.db.models import ProjectInvite, RoleEnum

from .conftest import _assign_member, _auth_header, _login, _make_project, _make_user


class TestOrganizationsManaged:
    def test_sadece_admin_oldugu_organizasyonlari_listeler(self, client, db):
        user = _make_user(db, email="orgadmin@test.com", role=RoleEnum.member)
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)

        p1 = _make_project(db, slug="alpha", name="Alpha", created_by=str(owner.id))
        p2 = _make_project(db, slug="beta", name="Beta", created_by=str(owner.id))

        _assign_member(db, project_id=p1.id, user_id=user.id, role=RoleEnum.admin)
        _assign_member(db, project_id=p2.id, user_id=user.id, role=RoleEnum.member)

        token = _login(client, "orgadmin@test.com")
        resp = client.get("/organizations/managed", headers=_auth_header(token))

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["projectId"] == "alpha"


class TestOrganizationsInvites:
    def test_project_admin_invite_olusturabilir_ve_listeleyebilir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.member)
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="nova", name="Nova", created_by=str(owner.id))
        _assign_member(db, project_id=project.id, user_id=admin.id, role=RoleEnum.admin)

        token = _login(client, "admin@test.com")

        create_resp = client.post(
            "/organizations/nova/invites",
            json={"expiresInHours": 24, "maxUses": 3},
            headers=_auth_header(token),
        )
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert len(created["code"]) == 12

        list_resp = client.get("/organizations/nova/invites", headers=_auth_header(token))
        assert list_resp.status_code == 200
        rows = list_resp.json()
        assert len(rows) == 1
        assert rows[0]["isActive"] is True

    def test_admin_olmayan_uye_invite_yonetemez(self, client, db):
        member = _make_user(db, email="member@test.com", role=RoleEnum.member)
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="nova", name="Nova", created_by=str(owner.id))
        _assign_member(db, project_id=project.id, user_id=member.id, role=RoleEnum.member)

        token = _login(client, "member@test.com")
        resp = client.post(
            "/organizations/nova/invites",
            json={"expiresInHours": 24, "maxUses": 1},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403

    def test_rotate_eski_aktif_keyleri_pasif_yapar(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.member)
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="nova", name="Nova", created_by=str(owner.id))
        _assign_member(db, project_id=project.id, user_id=admin.id, role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        first = client.post(
            "/organizations/nova/invites",
            json={"expiresInHours": 24, "maxUses": 0},
            headers=_auth_header(token),
        )
        assert first.status_code == 200

        rotate = client.post(
            "/organizations/nova/invites/rotate",
            json={"expiresInHours": 48, "maxUses": 5},
            headers=_auth_header(token),
        )
        assert rotate.status_code == 200
        assert rotate.json()["code"] != first.json()["code"]

        list_resp = client.get("/organizations/nova/invites", headers=_auth_header(token))
        rows = list_resp.json()
        assert len(rows) == 2
        active_count = len([row for row in rows if row["isActive"] is True])
        inactive_count = len([row for row in rows if row["isActive"] is False])
        assert active_count == 1
        assert inactive_count == 1

    def test_revoke_invite_key(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.member)
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="nova", name="Nova", created_by=str(owner.id))
        _assign_member(db, project_id=project.id, user_id=admin.id, role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        created = client.post(
            "/organizations/nova/invites",
            json={"expiresInHours": 24, "maxUses": 0},
            headers=_auth_header(token),
        ).json()

        revoke = client.delete(
            f"/organizations/nova/invites/{created['id']}",
            headers=_auth_header(token),
        )
        assert revoke.status_code == 204

        invite = db.scalar(select(ProjectInvite).where(ProjectInvite.id == created["id"]))
        assert invite is not None
        assert invite.is_active is False

    def test_invite_create_rate_limit_asilirsa_429(self, client, db, monkeypatch):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.member)
        owner = _make_user(db, email="owner@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="nova", name="Nova", created_by=str(owner.id))
        _assign_member(db, project_id=project.id, user_id=admin.id, role=RoleEnum.admin)
        token = _login(client, "admin@test.com")

        monkeypatch.setattr(
            "app.api.routes.organizations.check_rate_limit",
            lambda **kwargs: False,
        )

        resp = client.post(
            "/organizations/nova/invites",
            json={"expiresInHours": 24, "maxUses": 0},
            headers=_auth_header(token),
        )
        assert resp.status_code == 429
