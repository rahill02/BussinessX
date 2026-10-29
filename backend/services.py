from sqlalchemy import func as sqlfunc
from models import Item, Batch, Sale, SaleLine, ReturnLine, Adjustment, Supplier, PurchaseOrderNote
from barcode_service import CatalogUnavailable, lookup_catalog
from batch_numbers import auto_number_value, format_batch_no
from purchase_service import lead_info
from schemas import ItemCreate

CSV_COLUMNS = ["name", "type", "unit", "qty", "cost_price", "selling_price", "mrp", "tax_percent", "custom_id"]


# Money is stored as integer paise so totals never drift from float rounding.
# The API talks rupees; these two helpers are the only place that converts.
def to_paise(rupees):
    if rupees is None:
        return None
    return round(rupees * 100)


def to_rupees(paise):
    if paise is None:
        return None
    return paise / 100


def _cost_incl_tax(cost_price_paise, tax_percent):
    return round(cost_price_paise * (1 + (tax_percent or 0) / 100))


def _batches_query(db, item_id, size=None):
    # no ordering here: SQLAlchemy's .order_by() chains rather than replaces,
    # so callers apply the ordering they need (FIFO asc, or newest-first desc)
    q = db.query(Batch).filter(Batch.item_id == item_id)
    if size is not None:
        q = q.filter(Batch.size == size)
    return q


def _fifo_order(q):
    return q.order_by(Batch.created_at, Batch.id)


def _newest_first(q):
    return q.order_by(Batch.created_at.desc(), Batch.id.desc())


def _batch_price(item, batch):
    # batches saved before per-batch prices existed fall back to the item's price
    return batch.selling_price if batch.selling_price is not None else item.selling_price


def _check_barcode_free(db, barcode, own_item_id=None):
    """One barcode can belong to only one item, or scanning would be ambiguous."""
    if not barcode:
        return
    other = db.query(Item).filter(Item.barcode == barcode).first()
    if other and other.id != own_item_id:
        raise ValueError(f'This barcode is already used by "{other.name}".')


def new_batch_no(db, typed=None, suffix=None, taken=()):
    """The number for a new batch: what the user typed (checked to be unused), else the next B-number.

    `taken` holds numbers already handed out in this same request but not saved yet (e.g. one per shoe size).
    """
    if typed:
        number = f"{typed}-{suffix}" if suffix else typed  # shoes: one batch per size, so the size is appended
        if number in taken or db.query(Batch.id).filter(Batch.batch_no == number).first():
            raise ValueError(f'Batch number "{number}" is already used.')
        return number
    highest = 0
    for (existing,) in db.query(Batch.batch_no).filter(Batch.batch_no.like("B-%")):
        highest = max(highest, auto_number_value(existing) or 0)
    for existing in taken:
        highest = max(highest, auto_number_value(existing) or 0)
    return format_batch_no(highest + 1)


def lookup_barcode(db, code, use_catalog=True, catalog=lookup_catalog):
    """Who owns this barcode? Your own items first (name and selling price), then the public list (name only)."""
    item = db.query(Item).filter(Item.barcode == code).first()
    if item:
        return {"source": "shop", "barcode": code, "item": item_stock_summary(db, item.id)}
    if not use_catalog:
        return {"source": "none", "barcode": code}
    try:
        found = catalog(code)
    except CatalogUnavailable:
        return {"source": "none", "barcode": code, "catalog_error": True}  # say "no internet", do not block
    if found:
        return {"source": "catalog", "barcode": code, "name": found["name"]}
    return {"source": "none", "barcode": code}


def create_item(db, data):
    _check_barcode_free(db, data.barcode)
    sizes = data.sizes if data.type == "shoes" and data.sizes else None
    # work out every batch number first, so a clash is reported before anything is saved
    numbers = []
    for s in sizes or [None]:
        numbers.append(new_batch_no(db, data.batch_no, s.size if s else None, taken=numbers))
    item = Item(
        name=data.name,
        type=data.type,
        unit=data.unit or "pcs",
        selling_price=to_paise(data.selling_price) or 0,
        tax_percent=data.tax_percent or 0,
        custom_id=data.custom_id,
        photo_url=data.photo_url,
        barcode=data.barcode,
    )
    db.add(item)
    db.flush()  # need item.id before adding batches

    cost_paise = to_paise(data.cost_price) or 0
    cost_incl_tax = _cost_incl_tax(cost_paise, item.tax_percent)
    mrp_paise = to_paise(data.mrp)

    if sizes:
        for s, number in zip(sizes, numbers):
            db.add(Batch(
                item_id=item.id, size=s.size, batch_no=number,
                qty_received=s.qty, qty_left=s.qty,
                cost_price=cost_paise, cost_incl_tax=cost_incl_tax, mrp=mrp_paise,
                selling_price=item.selling_price,
            ))
    else:
        qty = data.qty or 0
        db.add(Batch(
            item_id=item.id, size=None, batch_no=numbers[0],
            qty_received=qty, qty_left=qty,
            cost_price=cost_paise, cost_incl_tax=cost_incl_tax, mrp=mrp_paise,
            selling_price=item.selling_price,
        ))
    db.commit()
    db.refresh(item)
    return item


def _parse_optional_number(row, field):
    val = (row.get(field) or "").strip()
    if not val:
        return None, None
    try:
        num = float(val)
    except ValueError:
        return None, f"{field} must be a number"
    if num < 0:
        return None, f"{field} can't be negative"
    return num, None


def _validate_csv_row(row):
    errors = []

    name = (row.get("name") or "").strip()
    if not name:
        errors.append("name is required")

    item_type = (row.get("type") or "normal").strip().lower()
    if item_type not in ("normal", "loose"):
        errors.append("type must be 'normal' or 'loose' (shoes aren't supported via CSV import)")

    qty_raw = (row.get("qty") or "").strip()
    if not qty_raw:
        errors.append("qty is required")
        qty = 0
    else:
        try:
            qty = float(qty_raw)
            if qty < 0:
                errors.append("qty can't be negative")
        except ValueError:
            errors.append("qty must be a number")
            qty = 0

    cost_price, err = _parse_optional_number(row, "cost_price")
    if err:
        errors.append(err)
    selling_price, err = _parse_optional_number(row, "selling_price")
    if err:
        errors.append(err)
    mrp, err = _parse_optional_number(row, "mrp")
    if err:
        errors.append(err)
    tax_percent, err = _parse_optional_number(row, "tax_percent")
    if err:
        errors.append(err)

    if errors:
        return None, errors

    data = ItemCreate(
        name=name, type=item_type,
        unit=(row.get("unit") or "").strip() or ("kg" if item_type == "loose" else "pcs"),
        qty=qty, cost_price=cost_price, selling_price=selling_price or 0, mrp=mrp,
        tax_percent=tax_percent or 0,
        custom_id=(row.get("custom_id") or "").strip() or None,
    )
    return data, []


def import_csv(db, rows):
    created = []
    errors = []
    for i, row in enumerate(rows, start=2):  # row 1 is the header
        data, row_errors = _validate_csv_row(row)
        if row_errors:
            errors.append({"row": i, "message": "; ".join(row_errors)})
            continue
        item = create_item(db, data)
        created.append(item.id)
    return {"created": created, "errors": errors}


def add_stock(db, item_id, qty, same_price, cost_price=None, selling_price=None, mrp=None, size=None, batch_no=None):
    # batch_no only matters when a new batch is made; "same price" tops up the latest batch, which keeps its number
    item = db.get(Item, item_id)
    if not item:
        raise ValueError("Item not found")
    if qty <= 0:
        raise ValueError("Quantity must be more than 0.")

    latest_batch = _newest_first(_batches_query(db, item_id, size)).first()

    if same_price and latest_batch:
        latest_batch.qty_received += qty
        latest_batch.qty_left += qty
    else:
        cost_paise = to_paise(cost_price) if cost_price is not None else (latest_batch.cost_price if latest_batch else 0)
        cost_incl_tax = _cost_incl_tax(cost_paise, item.tax_percent)
        mrp_paise = to_paise(mrp) if mrp is not None else (latest_batch.mrp if latest_batch else None)
        if selling_price is not None:
            price_paise = to_paise(selling_price)
        else:
            price_paise = _batch_price(item, latest_batch) if latest_batch else item.selling_price
        number = new_batch_no(db, batch_no)  # checked before anything is changed
        # the new batch gets its own price; older batches keep theirs until they sell out
        db.add(Batch(
            item_id=item_id, size=size, batch_no=number,
            qty_received=qty, qty_left=qty,
            cost_price=cost_paise, cost_incl_tax=cost_incl_tax, mrp=mrp_paise,
            selling_price=price_paise,
        ))
        item.selling_price = price_paise  # item price = latest price, shown on lists

    # stock arrived, so anything we had noted as "ordered" is no longer on its way
    db.query(PurchaseOrderNote).filter(
        PurchaseOrderNote.item_id == item_id, PurchaseOrderNote.status == "ordered"
    ).update({"status": "received"})

    db.commit()
    return item_stock_summary(db, item_id)


def _sellable_batches(db, item_id, size=None):
    return _fifo_order(_batches_query(db, item_id, size).filter(Batch.qty_left > 0)).all()


def _plan_sale(item, batches, qty, sell_price=None):
    # FIFO: take from the oldest batch first. Each part is charged at its own
    # batch's price, unless the shopkeeper typed one price for the whole sale.
    override = to_paise(sell_price) if sell_price is not None else None
    plan = []
    remaining = qty
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.qty_left, remaining)
        price = override if override is not None else _batch_price(item, batch)
        plan.append((batch, take, price))
        remaining -= take
    return plan


def _plan_warning(plan):
    for batch, take, price in plan:
        if price < batch.cost_incl_tax:
            return "Selling below cost price"
    for batch, take, price in plan:
        if batch.mrp and price > batch.mrp:
            return "Selling price is above MRP"
    return None


def preview_sale(db, item_id, qty, sell_price=None, size=None):
    # same FIFO split as sell(), but nothing is saved: lets the screen show the bill first
    item = db.get(Item, item_id)
    if not item:
        raise ValueError("Item not found")
    batches = _sellable_batches(db, item_id, size)
    available = sum(b.qty_left for b in batches)
    result = {"available": available, "error": None, "lines": [], "total_amount": 0, "total_profit": 0, "warning": None}
    if qty <= 0:
        return result
    if qty > available:
        result["error"] = f"Not enough stock. Only {available:g} left."
        return result

    plan = _plan_sale(item, batches, qty, sell_price)
    amount = 0
    profit = 0
    for batch, take, price in plan:
        line_profit = round(take * (price - batch.cost_incl_tax))
        amount += round(take * price)
        profit += line_profit
        result["lines"].append({
            "batch_id": batch.id, "batch_no": batch.batch_no, "batch_date": batch.created_at, "size": batch.size, "qty": take,
            "sell_price": to_rupees(price), "cost_per_unit": to_rupees(batch.cost_incl_tax),
            "profit": to_rupees(line_profit),
        })
    result["total_amount"] = to_rupees(amount)
    result["total_profit"] = to_rupees(profit)
    result["warning"] = _plan_warning(plan)
    return result


def sell(db, item_id, qty, sell_price=None, size=None, sold_at=None):
    # sold_at is only for back-dated sample data; real sales use the current time
    item = db.get(Item, item_id)
    if not item:
        raise ValueError("Item not found")
    if qty <= 0:
        raise ValueError("Quantity must be more than 0.")

    batches = _sellable_batches(db, item_id, size)
    available = sum(b.qty_left for b in batches)
    if available < qty:
        raise ValueError(f"Not enough stock. Only {available:g} left.")

    plan = _plan_sale(item, batches, qty, sell_price)
    warning = _plan_warning(plan)

    sale = Sale(item_id=item_id)
    if sold_at:
        sale.sold_at = sold_at
    db.add(sale)
    db.flush()
    for batch, take, price in plan:
        batch.qty_left -= take
        db.add(SaleLine(
            sale_id=sale.id, batch_id=batch.id, size=batch.size,
            qty=take, sell_price=price,
            cost_per_unit=batch.cost_incl_tax,  # frozen now so old reports never change
            profit=round(take * (price - batch.cost_incl_tax)),
        ))
    db.commit()

    out, _, _ = _sale_out(db, sale)
    out["warning"] = warning
    return out


def return_sale_line(db, sale_line_id, qty):
    line = db.get(SaleLine, sale_line_id)
    if not line:
        raise ValueError("Sale line not found")
    if qty <= 0:
        raise ValueError("Quantity must be more than 0.")

    already_returned = sum(r.qty for r in db.query(ReturnLine).filter(ReturnLine.sale_line_id == sale_line_id))
    if qty > (line.qty - already_returned):
        raise ValueError("Cannot return more than was sold.")

    batch = db.get(Batch, line.batch_id)
    batch.qty_left += qty
    profit_reversed = round(qty * (line.sell_price - line.cost_per_unit))

    ret = ReturnLine(sale_line_id=sale_line_id, qty=qty, refund_price=line.sell_price, profit_reversed=profit_reversed)
    db.add(ret)
    db.commit()
    return {"return_id": ret.id, "qty": qty, "profit_reversed": to_rupees(profit_reversed)}


def correct_stock(db, item_id, qty_change, reason, size=None):
    if qty_change < 0:
        batch = _fifo_order(_batches_query(db, item_id, size).filter(Batch.qty_left > 0)).first()
    else:
        batch = _newest_first(_batches_query(db, item_id, size)).first()

    if not batch:
        raise ValueError("No stock to adjust")

    new_qty = batch.qty_left + qty_change
    if new_qty < 0:
        raise ValueError(f"Can't remove that many. Only {batch.qty_left:g} in the oldest batch.")
    batch.qty_left = new_qty

    db.add(Adjustment(item_id=item_id, batch_id=batch.id, qty_change=qty_change, reason=reason))
    db.commit()
    return item_stock_summary(db, item_id)


def item_stock_summary(db, item_id):
    item = db.get(Item, item_id)
    if not item:
        return None
    batches = _fifo_order(_batches_query(db, item_id)).all()
    qty = sum(b.qty_left for b in batches)
    active = [b for b in batches if b.qty_left > 0]
    costs = [b.cost_incl_tax for b in active] or [b.cost_incl_tax for b in batches]
    prices = [_batch_price(item, b) for b in active] or [item.selling_price]
    stock_value = sum(b.qty_left * b.cost_incl_tax for b in batches)
    latest = batches[-1] if batches else None
    supplier = db.get(Supplier, item.supplier_id) if item.supplier_id else None
    lead_days, lead_source = lead_info(item, supplier)

    return {
        "id": item.id, "name": item.name, "type": item.type, "unit": item.unit,
        "selling_price": to_rupees(item.selling_price), "tax_percent": item.tax_percent,
        "custom_id": item.custom_id, "photo_url": item.photo_url, "barcode": item.barcode,
        "supplier_id": item.supplier_id, "supplier_name": supplier.name if supplier else None,
        "carton_size": item.carton_size or 1, "lead_time_override": item.lead_time_override,
        "lead_days": lead_days, "lead_source": lead_source,  # source: item | supplier | market | assumed
        "qty": qty,
        "cost_min": to_rupees(min(costs)) if costs else None,
        "cost_max": to_rupees(max(costs)) if costs else None,
        "sell_min": to_rupees(min(prices)),
        "sell_max": to_rupees(max(prices)),
        # price the next unit will actually sell at (oldest batch with stock)
        "next_sell_price": to_rupees(prices[0]),
        "mrp": to_rupees(latest.mrp) if latest else None,
        "stock_value": to_rupees(stock_value),
        "batches": [
            {
                "id": b.id, "batch_no": b.batch_no, "size": b.size, "qty_received": b.qty_received, "qty_left": b.qty_left,
                "cost_price": to_rupees(b.cost_price), "cost_incl_tax": to_rupees(b.cost_incl_tax),
                "selling_price": to_rupees(_batch_price(item, b)),
                "mrp": to_rupees(b.mrp), "created_at": b.created_at,
            } for b in batches
        ],
    }


def list_items(db):
    items = db.query(Item).all()
    return [item_stock_summary(db, i.id) for i in items]


def search_item_names(db, q):
    query = db.query(Item.name).distinct()
    if q:
        query = query.filter(Item.name.ilike(f"%{q}%"))
    return [row[0] for row in query.limit(10).all()]


def edit_item(db, item_id, data):
    item = db.get(Item, item_id)
    if not item:
        return None
    sent = data.model_fields_set  # tells "not sent" apart from "sent as null"
    if data.supplier_id is not None and not db.get(Supplier, data.supplier_id):
        raise ValueError("Supplier not found")
    if "barcode" in sent:
        _check_barcode_free(db, data.barcode, item.id)
        item.barcode = data.barcode
    if "supplier_id" in sent:
        item.supplier_id = data.supplier_id
    if "lead_time_override" in sent:
        item.lead_time_override = data.lead_time_override
    if data.carton_size is not None:
        item.carton_size = data.carton_size
    if data.name is not None:
        item.name = data.name
    if data.selling_price is not None:
        item.selling_price = to_paise(data.selling_price)
        # an explicit price edit means "sell what's on the shelf at this price now"
        for batch in _batches_query(db, item_id).filter(Batch.qty_left > 0).all():
            batch.selling_price = item.selling_price
    if data.tax_percent is not None:
        item.tax_percent = data.tax_percent
    if data.custom_id is not None:
        item.custom_id = data.custom_id
    db.commit()
    db.refresh(item)
    return item


def _sale_out(db, sale):
    # returns (dict for the API, net amount in paise, net profit in paise)
    item = db.get(Item, sale.item_id)
    lines = db.query(SaleLine).filter(SaleLine.sale_id == sale.id).order_by(SaleLine.id).all()
    amount = 0
    profit = 0
    lines_out = []
    for l in lines:
        returns = db.query(ReturnLine).filter(ReturnLine.sale_line_id == l.id).all()
        returned_qty = sum(r.qty for r in returns)
        amount += round(l.qty * l.sell_price) - sum(round(r.qty * r.refund_price) for r in returns)
        profit += l.profit - sum(r.profit_reversed for r in returns)
        batch = db.get(Batch, l.batch_id)
        lines_out.append({
            "id": l.id, "batch_id": l.batch_id, "batch_no": batch.batch_no if batch else None, "size": l.size,
            "qty": l.qty, "returned_qty": returned_qty,
            "sell_price": to_rupees(l.sell_price), "cost_per_unit": to_rupees(l.cost_per_unit),
            "profit": to_rupees(l.profit),
        })
    out = {
        "id": sale.id, "sale_id": sale.id, "item_id": sale.item_id,
        "item_name": item.name if item else f"Item #{sale.item_id}",
        "sold_at": sale.sold_at,
        "total_amount": to_rupees(amount),
        "total_profit": to_rupees(profit),
        "lines": lines_out,
    }
    return out, amount, profit


def list_sales(db, date=None):
    query = db.query(Sale)
    if date:
        query = query.filter(sqlfunc.date(Sale.sold_at) == date)
    sales = query.order_by(Sale.sold_at.desc(), Sale.id.desc()).all()
    return [_sale_out(db, sale)[0] for sale in sales]


def report(db, date_from=None, date_to=None):
    sale_query = db.query(Sale)
    if date_from:
        sale_query = sale_query.filter(Sale.sold_at >= date_from)
    if date_to:
        sale_query = sale_query.filter(Sale.sold_at <= date_to + " 23:59:59")
    sales = sale_query.order_by(Sale.sold_at.desc(), Sale.id.desc()).all()

    sales_out = []
    total_sales = 0
    total_profit = 0
    for sale in sales:
        out, amount, profit = _sale_out(db, sale)
        sales_out.append(out)
        total_sales += amount
        total_profit += profit

    all_batches = db.query(Batch).all()
    stock_value = sum(b.qty_left * b.cost_incl_tax for b in all_batches)

    return {
        "total_sales": to_rupees(total_sales),
        "total_profit": to_rupees(total_profit),
        "stock_value": to_rupees(stock_value),
        "sales": sales_out,
    }
