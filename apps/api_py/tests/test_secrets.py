"""Secret CRUD testleri."""

from tests.conftest import (
    _assign_member,
    _auth_header,
    _login,
    _make_project,
    _make_user,
)

from app.db.models.enums import RoleEnum


def _create_secret(client, token, project_slug, **overrides):
    payload = {
        "name": "Stripe Key",
        "provider": "Stripe",
        "type": "key",
        "environment": "dev",
        "keyName": "STRIPE_API_KEY",
        "value": "sk_test_xxx",
        "tags": ["payment"],
        "notes": "Test key",
    }
    payload.update(overrides)
    return client.post(
        f"/projects/{project_slug}/secrets",
        json=payload,
        headers=_auth_header(token),
    )


class TestSecretCRUD:
    def test_secret_olusturulur(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        resp = _create_secret(client, token, "proj")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Stripe Key"
        assert data["keyName"] == "STRIPE_API_KEY"
        assert data["environment"] == "dev"
        assert "***" in data["valueMasked"] or "..." in data["valueMasked"]
        assert "payment" in data["tags"]

    def test_secret_listelenir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        _create_secret(client, token, "proj", keyName="KEY_1", name="Key 1")
        _create_secret(client, token, "proj", keyName="KEY_2", name="Key 2")

        resp = client.get("/projects/proj/secrets?env=dev", headers=_auth_header(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_secret_guncellenir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        create_resp = _create_secret(client, token, "proj")
        secret_id = create_resp.json()["id"]

        resp = client.patch(
            f"/secrets/{secret_id}",
            json={"name": "Guncellenmis", "provider": "AWS"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Guncellenmis"
        assert resp.json()["provider"] == "AWS"

    def test_secret_silinir(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        create_resp = _create_secret(client, token, "proj")
        secret_id = create_resp.json()["id"]

        resp = client.delete(f"/secrets/{secret_id}", headers=_auth_header(token))
        assert resp.status_code == 204

        # Silindikten sonra bos liste
        resp2 = client.get(
            "/projects/proj/secrets?env=dev", headers=_auth_header(token)
        )
        assert len(resp2.json()) == 0

    def test_secret_reveal(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        create_resp = _create_secret(client, token, "proj", value="super-secret-value")
        secret_id = create_resp.json()["id"]

        resp = client.get(f"/secrets/{secret_id}/reveal", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["value"] == "super-secret-value"

    def test_secret_filtreleme(self, client, db):
        admin = _make_user(db, email="admin@test.com", role=RoleEnum.admin)
        project = _make_project(db, slug="proj", name="Proje", created_by=str(admin.id))
        _assign_member(db, project_id=project.id, user_id=admin.id)
        token = _login(client, "admin@test.com")

        _create_secret(
            client, token, "proj", keyName="KEY_A", name="A", provider="AWS", type="key"
        )
        _create_secret(
            client,
            token,
            "proj",
            keyName="KEY_B",
            name="B",
            provider="Azure",
            type="token",
        )

        # provider filtresi
        resp = client.get(
            "/projects/proj/secrets?env=dev&provider=AWS", headers=_auth_header(token)
        )
        assert len(resp.json()) == 1
        assert resp.json()[0]["provider"] == "AWS"

        # type filtresi
        resp2 = client.get(
            "/projects/proj/secrets?env=dev&type=token", headers=_auth_header(token)
        )
        assert len(resp2.json()) == 1
        assert resp2.json()[0]["type"] == "token"
