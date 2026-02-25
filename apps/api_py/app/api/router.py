from fastapi import APIRouter

from app.api.routes import (
    audit,
    auth,
    exports,
    imports,
    organizations,
    project_manage,
    projects,
    search,
    secrets,
    users,
)


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(project_manage.router)
api_router.include_router(organizations.router)
api_router.include_router(projects.router)
api_router.include_router(secrets.router)
api_router.include_router(search.router)
api_router.include_router(imports.router)
api_router.include_router(exports.router)
api_router.include_router(audit.router)
