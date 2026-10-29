from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import purchase_service
from schemas import SupplierCreate, SupplierEdit

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("")
def list_suppliers(db: Session = Depends(get_db)):
    return purchase_service.list_suppliers(db)


@router.post("")
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db)):
    return purchase_service.create_supplier(db, data)


@router.patch("/{supplier_id}")
def edit_supplier(supplier_id: int, data: SupplierEdit, db: Session = Depends(get_db)):
    supplier = purchase_service.update_supplier(db, supplier_id, data)
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    return supplier
