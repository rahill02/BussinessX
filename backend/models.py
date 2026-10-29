from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    lead_time_days = Column(Integer, nullable=False, default=2)  # order to delivery, set once per supplier
    delivery_weekdays = Column(String, nullable=True)  # "0,3" = Mon,Thu (0 = Monday); shown only, not used in the maths
    is_market = Column(Boolean, nullable=False, default=False)  # bought in person on market trips
    market_weekdays = Column(String, nullable=True)  # trip days for a market supplier, same format


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # normal | shoes | loose
    unit = Column(String, nullable=False, default="pcs")  # pcs | kg | g | l
    selling_price = Column(Integer, nullable=False)  # paise
    tax_percent = Column(Float, nullable=False, default=0)
    custom_id = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    barcode = Column(String, nullable=True, unique=True, index=True)  # optional; one barcode belongs to one item
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    carton_size = Column(Integer, nullable=False, default=1, server_default="1")  # supplier sells only full cartons
    lead_time_override = Column(Integer, nullable=True)  # days; beats the supplier's number for this one item
    created_at = Column(DateTime, server_default=func.now())


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    batch_no = Column(String, nullable=True, unique=True, index=True)  # B-0001... or typed by the user; always set by the app
    size = Column(String, nullable=True)  # shoes only
    qty_received = Column(Float, nullable=False)
    qty_left = Column(Float, nullable=False)
    cost_price = Column(Integer, nullable=False)  # paise, before tax
    cost_incl_tax = Column(Integer, nullable=False)  # paise, what FIFO profit is based on
    mrp = Column(Integer, nullable=True)  # paise
    # each batch keeps its own price, so old stock sells at the old price until it runs out
    selling_price = Column(Integer, nullable=True)  # paise
    created_at = Column(DateTime, server_default=func.now())


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    sold_at = Column(DateTime, server_default=func.now())
    note = Column(String, nullable=True)


class SaleLine(Base):
    __tablename__ = "sale_lines"
    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    size = Column(String, nullable=True)
    qty = Column(Float, nullable=False)
    sell_price = Column(Integer, nullable=False)  # paise per unit
    cost_per_unit = Column(Integer, nullable=False)  # paise, frozen at sale time so old reports never change
    profit = Column(Integer, nullable=False)  # paise, total for this line


class ReturnLine(Base):
    __tablename__ = "return_lines"
    id = Column(Integer, primary_key=True)
    sale_line_id = Column(Integer, ForeignKey("sale_lines.id"), nullable=False)
    qty = Column(Float, nullable=False)
    refund_price = Column(Integer, nullable=False)  # paise per unit
    profit_reversed = Column(Integer, nullable=False)  # paise, total
    created_at = Column(DateTime, server_default=func.now())


class PurchaseOrderNote(Base):
    # "I have ordered this" so the quantity counts as stock on its way
    __tablename__ = "purchase_order_notes"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    qty = Column(Float, nullable=False)
    ordered_at = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default="ordered")  # ordered | received


class Adjustment(Base):
    __tablename__ = "adjustments"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    qty_change = Column(Float, nullable=False)  # negative for shrink/damage
    reason = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
