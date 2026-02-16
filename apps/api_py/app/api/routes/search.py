from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.db.models.enums import EnvironmentEnum, SecretTypeEnum
from app.db.repositories.domain_repo import list_secrets
from app.schemas.secrets import SecretOut


router = APIRouter(tags=["search"])


@router.get("/search", response_model=List[SecretOut])
def search(
    q: str = Query(default=""),
    provider: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    environment: Optional[EnvironmentEnum] = Query(default=None),
    type: Optional[SecretTypeEnum] = Query(default=None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    return list_secrets(
        db,
        str(user.id),
        q=q,
        provider=provider,
        tag=tag,
        env=environment,
        secret_type=type,
    )
