from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

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


class OrganizationSummaryOut(BaseModel):
    projectId: str
    projectName: str
    memberCount: int


class InviteCreateRequest(BaseModel):
    expiresInHours: Optional[int] = Field(default=720, ge=1, le=24 * 365)
    maxUses: Optional[int] = Field(default=0, ge=0, le=10000)


class InviteOut(BaseModel):
    id: str
    projectId: str
    isActive: bool
    maxUses: int
    usedCount: int
    expiresAt: Optional[datetime] = None
    lastUsedAt: Optional[datetime] = None
    createdAt: datetime
    codePreview: str


class InviteCreateOut(InviteOut):
    code: str
