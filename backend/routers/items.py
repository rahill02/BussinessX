import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database import get_db
from barcode_service import normalize_barcode
import services
from schemas import ItemCreate, ItemEdit

router = APIRouter(prefix="/items", tags=["items"])

CSV_TEMPLATE = (
    "name,type,unit,qty,cost_price,selling_price,mrp,tax_percent,custom_id\n"
    "Fortune Sunflower Oil 1L,normal,pcs,20,140,160,165,0,\n"
    "Tata Sugar,loose,kg,50,38,42,,0,\n"
)


@router.post("")
def create_item(data: ItemCreate, db: Session = Depends(get_db)):
    try:
        item = services.create_item(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return services.item_stock_summary(db, item.id)


@router.get("/barcode/{code}")
def lookup_barcode(code: str, catalog: bool = True, db: Session = Depends(get_db)):
    # catalog=false skips the public product list (the Sell screen only wants your own items)
    try:
        code = normalize_barcode(code)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return services.lookup_barcode(db, code, catalog)


@router.get("")
def list_items(db: Session = Depends(get_db)):
    return services.list_items(db)


@router.get("/names")
def item_names(q: str = "", db: Session = Depends(get_db)):
    return services.search_item_names(db, q)


@router.get("/import-csv/template")
def download_csv_template():
    return PlainTextResponse(
        CSV_TEMPLATE, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=businessx-items-template.csv"},
    )


@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "Could not read file as UTF-8 text. Please upload a CSV file.")

    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise HTTPException(400, "CSV file is empty.")

    return services.import_csv(db, rows)


@router.get("/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    summary = services.item_stock_summary(db, item_id)
    if not summary:
        raise HTTPException(404, "Item not found")
    return summary


@router.patch("/{item_id}")
def edit_item(item_id: int, data: ItemEdit, db: Session = Depends(get_db)):
    try:
        item = services.edit_item(db, item_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not item:
        raise HTTPException(404, "Item not found")
    return services.item_stock_summary(db, item_id)
