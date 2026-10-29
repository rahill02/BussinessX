from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
import services

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
def get_report(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return services.report(db, from_, to)
