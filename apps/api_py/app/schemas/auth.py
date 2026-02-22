from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr

from app.db.models.enums import RoleEnum


class AssignmentOut(BaseModel):
    projectId: str
    prodAccess: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPairOut(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"
    expiresAt: datetime


class AuthUserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: RoleEnum
    assignments: List[AssignmentOut]
    preferences: Dict[str, Any] = {}


class RefreshRequest(BaseModel):
    refreshToken: str


class PreferencesUpdateRequest(BaseModel):
    maskValues: Optional[bool] = None
    clipboardSeconds: Optional[int] = None
