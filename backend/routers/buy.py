from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import purchase_service
from schemas import OrderedIn

router = APIRouter(prefix="/buy", tags=["buy"])

PRIORITIES = ("now", "soon", "plan", "skip", "ok")


@router.get("/suggestions")
def get_suggestions(
    priority: Optional[str] = None,
    supplier_id: Optional[int] = None,
    market: Optional[bool] = None,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
):
    if priority and priority not in PRIORITIES:
        raise HTTPException(400, f"priority must be one of: {', '.join(PRIORITIES)}")
    return purchase_service.suggestions(db, today, priority or None, supplier_id, market)


@router.get("/summary")
def get_summary(today: Optional[date] = None, db: Session = Depends(get_db)):
    return purchase_service.summary(db, today)


@router.get("/market-list")
def get_market_list(today: Optional[date] = None, db: Session = Depends(get_db)):
    return purchase_service.market_list(db, today)


@router.post("/{item_id}/ordered")
def ordered(item_id: int, data: OrderedIn, today: Optional[date] = None, db: Session = Depends(get_db)):
    try:
        return purchase_service.mark_ordered(db, item_id, data.qty, today)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/{item_id}/undo")
def undo(item_id: int, db: Session = Depends(get_db)):
    return purchase_service.undo_ordered(db, item_id)
