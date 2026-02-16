from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.db.models.enums import EnvironmentEnum, SecretTypeEnum


class SecretOut(BaseModel):
    id: str
    projectId: str
    name: str
    provider: str
    type: SecretTypeEnum
    environment: EnvironmentEnum
    keyName: str
    valueMasked: str
    updatedAt: datetime
    tags: List[str]
    notes: str


class SecretCreateRequest(BaseModel):
    name: str
    provider: str
    type: SecretTypeEnum
    environment: EnvironmentEnum
    keyName: str
    value: str
    tags: List[str] = Field(default_factory=list)
    notes: str = ""


class SecretUpdateRequest(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    type: Optional[SecretTypeEnum] = None
    keyName: Optional[str] = None
    value: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class SecretRevealOut(BaseModel):
    secretId: str
    keyName: str
    value: str
