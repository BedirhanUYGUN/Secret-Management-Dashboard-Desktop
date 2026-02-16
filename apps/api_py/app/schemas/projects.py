from typing import List

from pydantic import BaseModel


class ProjectSummaryOut(BaseModel):
    id: str
    name: str
    tags: List[str]
    keyCount: int
    prodAccess: bool
