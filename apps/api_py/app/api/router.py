from fastapi import APIRouter

from app.api.routes import audit, auth, exports, imports, projects, search, secrets


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(secrets.router)
api_router.include_router(search.router)
api_router.include_router(imports.router)
api_router.include_router(exports.router)
api_router.include_router(audit.router)
