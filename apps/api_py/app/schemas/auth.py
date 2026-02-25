from datetime import datetime
from enum import Enum
import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, model_validator

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


class RegisterPurposeEnum(str, Enum):
    personal = "personal"
    organization = "organization"


class RegisterRequest(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    password: str
    purpose: RegisterPurposeEnum = RegisterPurposeEnum.personal
    organizationMode: Literal["create", "join"] = "create"
    organizationName: Optional[str] = None
    inviteCode: Optional[str] = None

    @model_validator(mode="after")
    def validate_flow(self):
        if len(self.password or "") < 8:
            raise ValueError("password must be at least 8 characters")
        if not re.search(r"[a-z]", self.password):
            raise ValueError("password must include at least one lowercase character")
        if not re.search(r"[A-Z]", self.password):
            raise ValueError("password must include at least one uppercase character")
        if not re.search(r"\d", self.password):
            raise ValueError("password must include at least one digit")
        if not re.search(r"[^A-Za-z0-9]", self.password):
            raise ValueError("password must include at least one special character")
        if self.purpose == RegisterPurposeEnum.organization:
            if self.organizationMode == "create":
                if not (self.organizationName and self.organizationName.strip()):
                    raise ValueError("organizationName is required for create mode")
            if self.organizationMode == "join":
                if not (self.inviteCode and self.inviteCode.strip()):
                    raise ValueError("inviteCode is required for join mode")
        return self


class RegisterOut(BaseModel):
    userId: str
    name: str
    email: EmailStr
    role: RoleEnum
    projectId: str
    projectName: str
    membershipRole: RoleEnum
    inviteCode: Optional[str] = None
