from typing import List, Optional

from pydantic import BaseModel

from app.db.models.enums import EnvironmentEnum, RoleEnum


class ProjectSummaryOut(BaseModel):
    id: str
    name: str
    tags: List[str]
    keyCount: int
    prodAccess: bool


# ---------------------------------------------------------------------------
# Project management schemas
# ---------------------------------------------------------------------------


class ProjectMemberOut(BaseModel):
    userId: str
    email: str
    displayName: str
    role: RoleEnum


class ProjectDetailOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    tags: List[str]
    members: List[ProjectMemberOut]


class ProjectCreateRequest(BaseModel):
    name: str
    slug: str
    description: str = ""
    tags: List[str] = []


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class ProjectMemberAddRequest(BaseModel):
    userId: str
    role: RoleEnum = RoleEnum.member


class EnvironmentAccessRequest(BaseModel):
    userId: str
    environment: EnvironmentEnum
    canRead: bool
    canExport: bool = False
