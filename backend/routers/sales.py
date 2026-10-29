from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import services
from schemas import SaleCreate, ReturnCreate

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("/preview")
def preview_sale(data: SaleCreate, db: Session = Depends(get_db)):
    try:
        return services.preview_sale(db, data.item_id, data.qty, data.sell_price, data.size)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("")
def create_sale(data: SaleCreate, db: Session = Depends(get_db)):
    try:
        return services.sell(db, data.item_id, data.qty, data.sell_price, data.size)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("")
def list_sales(date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return services.list_sales(db, date)


@router.post("/lines/{line_id}/return")
def return_line(line_id: int, data: ReturnCreate, db: Session = Depends(get_db)):
    try:
        return services.return_sale_line(db, line_id, data.qty)
    except ValueError as e:
        raise HTTPException(400, str(e))
