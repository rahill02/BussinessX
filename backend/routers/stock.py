from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import services
from schemas import AddStock, CorrectStock

router = APIRouter(prefix="/items", tags=["stock"])


@router.post("/{item_id}/add-stock")
def add_stock(item_id: int, data: AddStock, db: Session = Depends(get_db)):
    try:
        return services.add_stock(
            db, item_id, data.qty, data.same_price,
            data.cost_price, data.selling_price, data.mrp, data.size, data.batch_no,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{item_id}/correct-stock")
def correct_stock(item_id: int, data: CorrectStock, db: Session = Depends(get_db)):
    try:
        return services.correct_stock(db, item_id, data.qty_change, data.reason, data.size)
    except ValueError as e:
        raise HTTPException(400, str(e))
