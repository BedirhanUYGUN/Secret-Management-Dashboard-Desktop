from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.db.models.enums import EnvironmentEnum


class SecretOut(BaseModel):
    id: str
    projectId: str
    name: str
    provider: str
    type: str
    environment: EnvironmentEnum
    keyName: str
    version: int
    valueMasked: str
    updatedAt: datetime
    tags: List[str]
    notes: str
    updatedByName: Optional[str] = None
    lastCopiedAt: Optional[datetime] = None


class SecretCreateRequest(BaseModel):
    name: str
    provider: str
    type: str
    environment: EnvironmentEnum
    keyName: str
    value: str
    tags: List[str] = Field(default_factory=list)
    notes: str = ""


class SecretUpdateRequest(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    type: Optional[str] = None
    keyName: Optional[str] = None
    value: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class SecretRevealOut(BaseModel):
    secretId: str
    projectId: str
    keyName: str
    value: str


class SecretRevealRequest(BaseModel):
    reason: Optional[str] = None


class SecretVersionOut(BaseModel):
    version: int
    maskedValue: str
    createdAt: datetime
    createdByName: Optional[str] = None
    isCurrent: bool = False
