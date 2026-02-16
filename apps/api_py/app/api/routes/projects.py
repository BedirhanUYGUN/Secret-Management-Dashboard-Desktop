from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.db.repositories.domain_repo import list_projects_for_user
from app.schemas.projects import ProjectSummaryOut


router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=List[ProjectSummaryOut])
def get_projects(user=Depends(get_current_user), db: Session = Depends(get_db_session)):
    return list_projects_for_user(db, str(user.id))
