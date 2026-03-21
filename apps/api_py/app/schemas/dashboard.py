from datetime import datetime
from typing import Dict, List

from pydantic import BaseModel


class RecentActivityOut(BaseModel):
    id: str
    action: str
    actor: str
    projectId: str
    secretName: str
    occurredAt: datetime


class DashboardStatsOut(BaseModel):
    totalSecrets: int
    totalProjects: int
    totalMembers: int
    recentActivity: List[RecentActivityOut]
    secretsByEnvironment: Dict[str, int]
    secretsByProvider: Dict[str, int]
