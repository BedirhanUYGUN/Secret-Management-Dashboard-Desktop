from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: str
    action: str
    actor: str
    projectId: str
    secretName: str
    occurredAt: datetime


class AuditCopyRequest(BaseModel):
    projectId: Optional[str] = None
    secretId: str
