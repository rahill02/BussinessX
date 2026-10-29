"""What to buy, how much, and by when (Problem 3). Plain arithmetic, no machine learning.

Every date calculation takes a `today` argument so tests and demos can fix the date.
"""
from datetime import date, datetime, timedelta
from math import ceil, floor

from models import Item, Batch, Sale, SaleLine, ReturnLine, Adjustment, Supplier, PurchaseOrderNote

# ---- every tunable number lives here ----
BUFFER_DAYS = 1        # spare days of stock we never want to dip into
COVER_DAYS = 7         # an order should last this many days after it arrives
SKIP_DAYS = 60         # more stock than this = "don't buy yet"
SOON_DAYS = 3          # order_by within this many days = "soon"
PLAN_DAYS = 7          # order_by within this many days = "plan"
DEFAULT_LEAD_DAYS = 2  # delivery time when the item has no supplier

WINDOW_DAYS = 28       # how far back we look at sales
RECENT_DAYS = 7        # the "recent" part of the rate
LOW_DATA_DAYS = 21     # fewer in-stock days than this = low confidence
MIN_DATA_DAYS = 5      # fewer in-stock days than this = no suggestion yet
WEIGHT_28 = 0.7        # rate = 0.7 * avg28 + 0.3 * avg7
WEIGHT_7 = 0.3
NO_LIMIT = 9999        # "days left" for an item that does not sell at all

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
PRIORITY_ORDER = {"now": 0, "soon": 1, "plan": 2, "skip": 3, "ok": 4}


# ---------- small helpers ----------

def _floor(x):
    # round first: 0.1 + 0.2 style float noise must not push 3.0 down to 2
    return floor(round(x, 6))


def _ceil(x):
    return ceil(round(x, 6))


def weekdays_from_text(text):
    return [int(p) for p in text.split(",") if p.strip() != ""] if text else []


def weekdays_to_text(days):
    return ",".join(str(d) for d in sorted(set(days)))


def round_to_cartons(units, carton_size):
    """The supplier sells whole cartons, so round up. Anything needed means at least one carton."""
    size = max(1, int(carton_size or 1))
    if units <= 0:
        return 0
    return _ceil(units / size) * size


def lead_info(item, supplier):
    """Delivery days for an item, and where that number came from."""
    if supplier and supplier.is_market:
        return 0, "market"  # you carry it home yourself
    if item.lead_time_override is not None:
        return item.lead_time_override, "item"
    if supplier:
        return supplier.lead_time_days, "supplier"
    return DEFAULT_LEAD_DAYS, "assumed"


# ---------- stock history ----------

def _daily_changes(db, item_id):
    """Per-day totals from the real records.

    added  = stock going up (or down) for a reason other than a sale: purchases, returns, corrections
    sold   = units that left on the day of the sale
    demand = units customers really wanted: sold minus returned, kept on the day of the sale
    """
    added, sold, demand = {}, {}, {}

    def bump(table, day, qty):
        table[day] = table.get(day, 0) + qty

    # days use the stored (UTC) date: shops open ~8am-10pm IST, which is the same UTC date
    for b in db.query(Batch).filter(Batch.item_id == item_id):
        bump(added, b.created_at.date(), b.qty_received)

    sale_day = {}
    rows = db.query(SaleLine, Sale.sold_at).join(Sale, SaleLine.sale_id == Sale.id).filter(Sale.item_id == item_id)
    for line, sold_at in rows:
        sale_day[line.id] = sold_at.date()
        bump(sold, sold_at.date(), line.qty)
        bump(demand, sold_at.date(), line.qty)

    if sale_day:
        for r in db.query(ReturnLine).filter(ReturnLine.sale_line_id.in_(list(sale_day))):
            bump(added, r.created_at.date(), r.qty)  # the goods come back on the return day...
            bump(demand, sale_day[r.sale_line_id], -r.qty)  # ...but that demand never really happened

    for a in db.query(Adjustment).filter(Adjustment.item_id == item_id):
        bump(added, a.created_at.date(), a.qty_change)
    return added, sold, demand


def stock_by_day(db, item_id, today=None, days=WINDOW_DAYS):
    """One row per day for the `days` days before today: stock at the START of that day, and units wanted that day."""
    today = today or date.today()
    added, sold, demand = _daily_changes(db, item_id)
    first = today - timedelta(days=days)
    stock = sum(q for d, q in added.items() if d < first) - sum(q for d, q in sold.items() if d < first)
    rows = []
    for i in range(days):
        day = first + timedelta(days=i)
        rows.append({"date": day, "start_stock": round(stock, 6), "sold": demand.get(day, 0)})
        stock += added.get(day, 0) - sold.get(day, 0)
    return rows


def _on_hand(db, item_id, today):
    """Stock at the end of `today` (so a purchase added today counts straight away)."""
    added, sold, _ = _daily_changes(db, item_id)
    total = sum(q for d, q in added.items() if d <= today) - sum(q for d, q in sold.items() if d <= today)
    return max(0, round(total, 6))


def daily_rate(db, item_id, today=None):
    """Sales per day, counting only days the item was in stock.

    A day with zero sales because the shelf was empty says nothing about demand, so it is skipped.
    A day with zero sales while stock was there is real zero demand, so it counts.
    """
    today = today or date.today()
    rows = stock_by_day(db, item_id, today)
    in_stock = [r for r in rows if r["start_stock"] > 0]
    n = len(in_stock)
    if n < MIN_DATA_DAYS:
        return {"rate": 0, "avg28": 0, "avg7": 0, "days_of_data": n, "confidence": "none"}
    avg28 = sum(r["sold"] for r in in_stock) / n
    recent = [r for r in rows[-RECENT_DAYS:] if r["start_stock"] > 0]
    avg7 = sum(r["sold"] for r in recent) / len(recent) if recent else avg28
    return {
        "rate": round(WEIGHT_28 * avg28 + WEIGHT_7 * avg7, 6),
        "avg28": avg28,
        "avg7": avg7,
        "days_of_data": n,
        "confidence": "low" if n < LOW_DATA_DAYS else "ok",
    }


# ---------- the buying maths ----------

def _plan_regular(rate, stock, lead, today):
    """Normal supplier. Returns (order_by, days_until_order, units_needed)."""
    buffer_units = rate * BUFFER_DAYS
    reorder_point = rate * lead + buffer_units  # order when stock falls to this
    days_until_order = max(0, _floor((stock - reorder_point) / rate))
    order_up_to = rate * (lead + COVER_DAYS) + buffer_units  # target level right after the order is placed
    stock_at_order = max(0, stock - rate * days_until_order)
    need = order_up_to - stock_at_order
    return today + timedelta(days=days_until_order), days_until_order, need


def _trip_on_or_after(day, trips):
    for i in range(7):
        d = day + timedelta(days=i)
        if d.weekday() in trips:
            return d


def _trip_on_or_before(day, trips):
    for i in range(7):
        d = day - timedelta(days=i)
        if d.weekday() in trips:
            return d


def _plan_market(rate, stock, trips, today):
    """Market item: buy on the last trip that is still before we run out. Returns the plan and the next trip."""
    days_left = stock / rate
    run_out_date = today + timedelta(days=_floor(days_left))
    next_trip = _trip_on_or_after(today, trips)
    will_run_out = next_trip > run_out_date  # even the very next trip is too late
    last_ok = _trip_on_or_before(run_out_date - timedelta(days=BUFFER_DAYS), trips)
    order_by = max(last_ok, next_trip)  # if last_ok is already in the past, go on the next trip
    days_to_trip = (order_by - today).days
    following = _trip_on_or_after(order_by + timedelta(days=1), trips)
    days_between = (following - order_by).days  # this purchase must last until the trip after
    stock_at_trip = max(0, stock - rate * days_to_trip)
    need = rate * (days_to_trip + days_between) + rate * BUFFER_DAYS - stock_at_trip
    return order_by, days_to_trip, need, will_run_out, next_trip


def _priority(stock, days_left, days_until_order, due_next_trip=False):
    if days_left > SKIP_DAYS:
        return "skip"
    if stock <= 0 or days_until_order <= 0:
        return "now"
    if days_until_order <= SOON_DAYS:
        return "soon"
    if days_until_order <= PLAN_DAYS or due_next_trip:
        return "plan"
    return "ok"


def _unit_cost(db, item_id):
    """Cost of one unit (tax included) from the latest batch, in rupees."""
    latest = (db.query(Batch).filter(Batch.item_id == item_id)
              .order_by(Batch.created_at.desc(), Batch.id.desc()).first())
    return latest.cost_incl_tax / 100 if latest else 0


def _active_note(db, item_id, today):
    """The "ordered, not received yet" note placed on or before `today`."""
    end_of_today = datetime.combine(today + timedelta(days=1), datetime.min.time())
    return (db.query(PurchaseOrderNote)
            .filter(PurchaseOrderNote.item_id == item_id, PurchaseOrderNote.status == "ordered",
                    PurchaseOrderNote.ordered_at < end_of_today)
            .order_by(PurchaseOrderNote.id.desc()).first())


# ---------- the one-line reasons ----------

def _num(x):
    text = f"{x:.1f}"  # 3.0 -> "3", 2.74 -> "2.7"
    return text[:-2] if text.endswith(".0") else text


def _plural(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


def _reason(item, d):
    unit = "" if item.unit == "pcs" else " " + ("L" if item.unit == "l" else item.unit)
    qty = f"{_num(d['qty'])}{unit}"

    if d["priority"] == "skip":
        if d["rate"] <= 0:
            text = "No sales in the last 28 days. Don't buy yet."
        else:
            text = f"You have {round(d['days_left'])} days of stock. Don't buy yet."
    elif d["is_market"]:
        text = f"Buy {qty} at the market on {WEEKDAYS[d['order_by'].weekday()]}, about ₹{d['cost']:,.0f}."
    else:
        rate = f"{_num(d['rate'])}{unit}"
        when = "today" if d["order_by"] <= d["today"] else f"by {WEEKDAYS[d['order_by'].weekday()]}"
        if d["on_hand"] <= 0 and d["incoming"] <= 0:
            text = f"Out of stock. You sell about {rate} a day. Order {qty} {when}."
        else:
            text = (f"You sell about {rate} a day and have {_num(d['on_hand'])}{unit} left. "
                    f"{d['who']} takes {_plural(d['lead'], 'day')}. Order {qty} {when}.")
        if d["incoming"] > 0:
            text += f" {_num(d['incoming'])}{unit} already ordered."
        if d["run_out_days"] > 0:
            text += f" You may run out for about {_plural(d['run_out_days'], 'day')}."

    if d["cartons"] > 0 and d["carton_size"] > 1:
        text += f" {_num(d['qty'])} = {_plural(d['cartons'], 'carton')} of {d['carton_size']}."
    if d["low_days"] is not None:
        text += f" Only {d['low_days']} days of sales so far."
    return text


# ---------- suggestions ----------

def suggest(db, item, today=None):
    """One item's advice, or None when there are too few days of sales to say anything yet."""
    today = today or date.today()
    info = daily_rate(db, item.id, today)
    if info["confidence"] == "none":
        return None

    supplier = db.get(Supplier, item.supplier_id) if item.supplier_id else None
    lead, lead_source = lead_info(item, supplier)
    on_hand = _on_hand(db, item.id, today)
    note = _active_note(db, item.id, today)
    incoming = note.qty if note else 0
    stock = on_hand + incoming  # ordered stock counts, or we would order it twice
    rate = info["rate"]
    carton = max(1, item.carton_size or 1)
    trips = weekdays_from_text(supplier.market_weekdays) if supplier and supplier.is_market else []

    order_by, will_run_out, run_out_days = None, False, 0
    if rate <= 0:
        days_left, priority, qty = NO_LIMIT, "skip", 0  # nothing sells, so nothing to buy
    else:
        days_left = stock / rate
        if trips:
            order_by, days_until, need, will_run_out, next_trip = _plan_market(rate, stock, trips, today)
            priority = _priority(stock, days_left, days_until, due_next_trip=(order_by == next_trip))
        else:
            order_by, days_until, need = _plan_regular(rate, stock, lead, today)
            priority = _priority(stock, days_left, days_until)
            gap = days_until + lead - days_left  # days the shelf is empty before the delivery lands
            run_out_days = int(gap + 0.5) if gap >= 0.5 else 0
        qty = round_to_cartons(need, carton)
        if info["confidence"] == "low" and qty > 0:
            # little history, so do not commit much cash: one carton or a week of sales, whichever is more
            cap = max(carton, _ceil(rate * COVER_DAYS))
            if qty > cap:
                qty = max(carton, (cap // carton) * carton)
        if priority == "skip":
            qty, order_by = 0, None

    cartons = qty // carton if qty else 0
    cost = qty * _unit_cost(db, item.id)
    low_days = info["days_of_data"] if info["confidence"] == "low" else None
    detail = {
        "priority": priority, "rate": rate, "days_left": days_left, "on_hand": on_hand, "incoming": incoming,
        "qty": qty, "cartons": cartons, "carton_size": carton, "order_by": order_by, "today": today,
        "is_market": bool(trips), "lead": lead, "who": supplier.name if supplier else "Delivery",
        "run_out_days": run_out_days, "cost": cost, "low_days": low_days,
    }
    return {
        "item_id": item.id, "name": item.name, "unit": item.unit,
        "priority": priority, "qty": qty, "cartons": cartons, "carton_size": carton,
        "order_by": order_by.isoformat() if order_by else None,
        "order_by_weekday": WEEKDAYS[order_by.weekday()] if order_by else None,
        "days_left": round(days_left, 1), "rate": round(rate, 2),
        "stock": round(stock, 3), "on_hand": round(on_hand, 3), "incoming": incoming,
        "lead_days": lead, "supplier_id": item.supplier_id, "supplier_name": supplier.name if supplier else None,
        "assumed_lead": lead_source == "assumed", "is_market": bool(trips),
        "low_data": info["confidence"] == "low", "days_of_data": info["days_of_data"],
        "will_run_out_before_trip": will_run_out, "run_out_days": run_out_days,
        "cost_estimate": round(cost, 2),
        "ordered_qty": note.qty if note else None,
        "ordered_at": note.ordered_at.date().isoformat() if note else None,
        "reason": _reason(item, detail),
    }


def suggestions(db, today=None, priority=None, supplier_id=None, market=None):
    """Everything worth saying, most urgent first: priority, then order-by date, then days left."""
    today = today or date.today()
    query = db.query(Item)
    if supplier_id is not None:
        query = query.filter(Item.supplier_id == supplier_id)
    result = []
    for item in query.all():
        s = suggest(db, item, today)
        if not s:
            continue
        if priority and s["priority"] != priority:
            continue
        if market is not None and s["is_market"] != market:
            continue
        result.append(s)
    result.sort(key=lambda s: (PRIORITY_ORDER[s["priority"]], s["order_by"] or "9999-12-31", s["days_left"]))
    return result


def summary(db, today=None):
    counts = {p: 0 for p in PRIORITY_ORDER}
    for s in suggestions(db, today):
        counts[s["priority"]] += 1
    counts["need_action"] = counts["now"] + counts["soon"]
    return counts


# ---------- market trip ----------

def _note_dated(db, item_id, day):
    start = datetime.combine(day, datetime.min.time())
    return (db.query(PurchaseOrderNote)
            .filter(PurchaseOrderNote.item_id == item_id, PurchaseOrderNote.ordered_at >= start,
                    PurchaseOrderNote.ordered_at < start + timedelta(days=1))
            .order_by(PurchaseOrderNote.id.desc()).first())


def market_list(db, today=None):
    """The shopping list for the next market trip: market items due on that trip, plus ones already bought today."""
    today = today or date.today()
    trips = {s.id: weekdays_from_text(s.market_weekdays)
             for s in db.query(Supplier).filter(Supplier.is_market.is_(True)) if s.market_weekdays}
    empty = {"trip_date": None, "weekday": None, "items": [], "total_cost": 0, "bought_count": 0, "bought_cost": 0}
    if not trips:
        return empty
    trip_date = min(_trip_on_or_after(today, t) for t in trips.values())

    rows = []
    for item in db.query(Item).filter(Item.supplier_id.in_(list(trips))):
        s = suggest(db, item, today)
        note = _note_dated(db, item.id, today)
        if note:  # ticked today: keep it on the list, with what was actually bought
            qty, bought, stocked = note.qty, True, note.status == "received"
        elif s and s["order_by"] == trip_date.isoformat() and s["priority"] != "skip":
            qty, bought, stocked = s["qty"], False, False
        else:
            continue
        supplier = db.get(Supplier, item.supplier_id)
        rows.append({
            "item_id": item.id, "name": item.name, "unit": item.unit,
            "supplier_id": supplier.id, "supplier_name": supplier.name,
            "qty": qty, "cost_estimate": round(qty * _unit_cost(db, item.id), 2),
            "bought": bought, "stocked": stocked,
            "will_run_out_before_trip": bool(s and s["will_run_out_before_trip"]),
        })
    rows.sort(key=lambda r: (r["supplier_name"], r["name"]))
    bought = [r for r in rows if r["bought"]]
    return {
        "trip_date": trip_date.isoformat(), "weekday": WEEKDAYS[trip_date.weekday()], "items": rows,
        "total_cost": round(sum(r["cost_estimate"] for r in rows), 2),
        "bought_count": len(bought), "bought_cost": round(sum(r["cost_estimate"] for r in bought), 2),
    }


# ---------- ordered tick ----------

def mark_ordered(db, item_id, qty, today=None):
    """Save "I ordered this much today". It then counts as stock on its way until stock is added."""
    today = today or date.today()
    if qty <= 0:
        raise ValueError("Quantity must be more than 0.")
    if not db.get(Item, item_id):
        raise ValueError("Item not found")
    when = datetime.combine(today, datetime.min.time())
    note = (db.query(PurchaseOrderNote)
            .filter(PurchaseOrderNote.item_id == item_id, PurchaseOrderNote.status == "ordered").first())
    if note:  # ticking twice must not order twice
        note.qty, note.ordered_at = qty, when
    else:
        db.add(PurchaseOrderNote(item_id=item_id, qty=qty, ordered_at=when, status="ordered"))
    db.commit()
    return {"item_id": item_id, "qty": qty, "ordered_at": today.isoformat()}


def undo_ordered(db, item_id):
    db.query(PurchaseOrderNote).filter(
        PurchaseOrderNote.item_id == item_id, PurchaseOrderNote.status == "ordered"
    ).delete()
    db.commit()
    return {"item_id": item_id}


# ---------- suppliers ----------

def supplier_out(db, s):
    return {
        "id": s.id, "name": s.name, "lead_time_days": s.lead_time_days,
        "delivery_weekdays": weekdays_from_text(s.delivery_weekdays),
        "is_market": bool(s.is_market), "market_weekdays": weekdays_from_text(s.market_weekdays),
        "items_count": db.query(Item).filter(Item.supplier_id == s.id).count(),
    }


def list_suppliers(db):
    return [supplier_out(db, s) for s in db.query(Supplier).order_by(Supplier.name)]


def create_supplier(db, data):
    s = Supplier(
        name=data.name.strip(), lead_time_days=data.lead_time_days,
        delivery_weekdays=weekdays_to_text(data.delivery_weekdays),
        is_market=data.is_market, market_weekdays=weekdays_to_text(data.market_weekdays),
    )
    db.add(s)
    db.commit()
    return supplier_out(db, s)


def update_supplier(db, supplier_id, data):
    s = db.get(Supplier, supplier_id)
    if not s:
        return None
    sent = data.model_fields_set
    if "name" in sent and data.name is not None:
        s.name = data.name.strip()
    if "lead_time_days" in sent and data.lead_time_days is not None:
        s.lead_time_days = data.lead_time_days
    if "delivery_weekdays" in sent and data.delivery_weekdays is not None:
        s.delivery_weekdays = weekdays_to_text(data.delivery_weekdays)
    if "is_market" in sent and data.is_market is not None:
        s.is_market = data.is_market
    if "market_weekdays" in sent and data.market_weekdays is not None:
        s.market_weekdays = weekdays_to_text(data.market_weekdays)
    db.commit()
    return supplier_out(db, s)
