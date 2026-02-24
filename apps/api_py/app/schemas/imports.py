from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.db.models.enums import EnvironmentEnum, SecretTypeEnum


class ImportPairOut(BaseModel):
    key: str
    value: str


class ImportPreviewRequest(BaseModel):
    content: str


class ImportPreviewOut(BaseModel):
    heading: Optional[str] = None
    totalPairs: int
    skipped: int
    preview: List[ImportPairOut]


class ImportCommitRequest(BaseModel):
    projectId: str
    environment: EnvironmentEnum
    content: str
    provider: str = "Imported"
    type: SecretTypeEnum = SecretTypeEnum.key
    conflictStrategy: Literal["skip", "overwrite"] = "skip"
    tags: List[str] = Field(default_factory=list)


class ImportCommitOut(BaseModel):
    projectId: str
    environment: EnvironmentEnum
    inserted: int
    updated: int
    skipped: int
    total: int
