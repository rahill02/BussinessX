from pydantic import BaseModel, Field, field_validator
from barcode_service import normalize_barcode
from batch_numbers import normalize_batch_no
from typing import Optional, List
from datetime import datetime


class SizeQty(BaseModel):
    size: str
    qty: float


class ItemCreate(BaseModel):
    name: str
    type: str  # normal | shoes | loose
    unit: Optional[str] = "pcs"
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    tax_percent: Optional[float] = 0
    custom_id: Optional[str] = None
    photo_url: Optional[str] = None
    qty: Optional[float] = None  # opening stock for normal/loose
    sizes: Optional[List[SizeQty]] = None  # opening stock for shoes
    barcode: Optional[str] = None  # optional; spaces are removed
    batch_no: Optional[str] = None  # optional; empty = numbered automatically (B-0001, B-0002...)

    _barcode = field_validator("barcode")(normalize_barcode)
    _batch_no = field_validator("batch_no")(normalize_batch_no)


class ItemEdit(BaseModel):
    name: Optional[str] = None
    selling_price: Optional[float] = None
    tax_percent: Optional[float] = None
    custom_id: Optional[str] = None
    # for these two, sending null means "clear it", so the service checks which fields were sent
    supplier_id: Optional[int] = None
    lead_time_override: Optional[int] = Field(default=None, ge=0, le=60)
    carton_size: Optional[int] = Field(default=None, ge=1)
    barcode: Optional[str] = None  # sending null removes the barcode

    _barcode = field_validator("barcode")(normalize_barcode)


def _check_weekdays(days):
    if days is not None and any(d < 0 or d > 6 for d in days):
        raise ValueError("Weekdays must be 0 (Monday) to 6 (Sunday)")
    return days


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1)
    lead_time_days: int = Field(default=2, ge=0, le=60)
    delivery_weekdays: List[int] = []
    is_market: bool = False
    market_weekdays: List[int] = []

    _weekdays = field_validator("delivery_weekdays", "market_weekdays")(_check_weekdays)


class SupplierEdit(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    lead_time_days: Optional[int] = Field(default=None, ge=0, le=60)
    delivery_weekdays: Optional[List[int]] = None
    is_market: Optional[bool] = None
    market_weekdays: Optional[List[int]] = None

    _weekdays = field_validator("delivery_weekdays", "market_weekdays")(_check_weekdays)


class OrderedIn(BaseModel):
    qty: float = Field(gt=0)


class AddStock(BaseModel):
    qty: float = Field(gt=0)
    same_price: bool = True
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    size: Optional[str] = None
    batch_no: Optional[str] = None  # only used when a NEW batch is created (same_price off)

    _batch_no = field_validator("batch_no")(normalize_batch_no)


class CorrectStock(BaseModel):
    qty_change: float
    reason: str
    size: Optional[str] = None


class SaleCreate(BaseModel):
    item_id: int
    qty: float = Field(gt=0)
    # leave empty to charge each batch its own price; fill to use one price for the whole sale
    sell_price: Optional[float] = Field(default=None, ge=0)
    size: Optional[str] = None
    note: Optional[str] = None


class ReturnCreate(BaseModel):
    qty: float = Field(gt=0)
