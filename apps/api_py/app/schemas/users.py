from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.db.models.enums import RoleEnum


class UserOut(BaseModel):
    id: str
    email: str
    displayName: str
    role: RoleEnum
    isActive: bool
    createdAt: datetime


class UserCreateRequest(BaseModel):
    email: EmailStr
    displayName: str
    role: RoleEnum
    password: str


class UserUpdateRequest(BaseModel):
    displayName: Optional[str] = None
    role: Optional[RoleEnum] = None
    isActive: Optional[bool] = None
    password: Optional[str] = None
