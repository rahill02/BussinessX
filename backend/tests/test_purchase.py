from datetime import date, datetime, time, timedelta

import purchase_service as ps
import seed_p3
import services
from models import Batch, Item, PurchaseOrderNote, Supplier

TODAY = date(2026, 10, 28)  # a Wednesday; every test fixes the date so results never drift


def at(day, hour=12):
    return datetime.combine(day, time(hour))


def ago(n):
    return TODAY - timedelta(days=n)


def make_supplier(db, name, lead=2, trips=None):
    s = Supplier(name=name, lead_time_days=lead, is_market=bool(trips),
                 market_weekdays=ps.weekdays_to_text(trips) if trips else None)
    db.add(s)
    db.commit()
    return s


def make_item(db, name, supplier=None, carton=1, unit="pcs"):
    item = Item(name=name, type="normal" if unit == "pcs" else "loose", unit=unit, selling_price=16000,
                tax_percent=0, supplier_id=supplier.id if supplier else None, carton_size=carton)
    db.add(item)
    db.commit()
    return item


def add_batch(db, item, qty, days_ago):
    db.add(Batch(item_id=item.id, qty_received=qty, qty_left=qty, cost_price=14000, cost_incl_tax=14000,
                 mrp=None, selling_price=16000, created_at=at(ago(days_ago), 8)))
    db.commit()


def sell_on(db, item, qty, days_ago):
    services.sell(db, item.id, qty, None, sold_at=at(ago(days_ago)))


def steady(db, name, per_day, stock_now, supplier=None, carton=1, unit="pcs", days=28):
    """An item that sold `per_day` every day for `days` days and has `stock_now` left today."""
    item = make_item(db, name, supplier, carton, unit)
    add_batch(db, item, stock_now + per_day * days, days + 2)
    for d in range(days, 0, -1):
        sell_on(db, item, per_day, d)
    return item


def advice(db, item):
    return ps.suggest(db, item, TODAY)


def test_worked_example(db):
    # rate 3, stock 20, lead 2, carton 12 -> reorder point 9, order up to 30, order by day 3, order 24
    item = steady(db, "Oil", per_day=3, stock_now=20, supplier=make_supplier(db, "Sharma", lead=2), carton=12)
    s = advice(db, item)
    assert s["rate"] == 3
    assert s["order_by"] == (TODAY + timedelta(days=3)).isoformat()
    assert s["qty"] == 24
    assert s["cartons"] == 2
    assert s["priority"] == "soon"
    assert "Order 24 by Saturday" in s["reason"]


def test_brief_example_already_leaves_a_gap_of_about_a_day(db):
    # "3 a day, 4 left, delivery takes 2 days": 4 lasts 1.3 days, so even ordering today leaves the shelf empty ~1 day
    item = steady(db, "Oil", per_day=3, stock_now=4, supplier=make_supplier(db, "Sharma", lead=2))
    s = advice(db, item)
    assert s["priority"] == "now"
    assert s["run_out_days"] == 1
    assert "You may run out for about 1 day." in s["reason"]


def make_out_of_stock(db):
    # sold 6 a day, then the shelf was empty for the last 5 days
    item = make_item(db, "Salt", make_supplier(db, "Sharma", lead=2), carton=24)
    add_batch(db, item, 6 * 23, 40)
    for d in range(28, 5, -1):
        sell_on(db, item, 6, d)
    return item


def test_out_of_stock_goes_to_the_top_and_its_rate_ignores_stock_out_days(db):
    salt = make_out_of_stock(db)
    steady(db, "Rice", per_day=2, stock_now=100)
    s = advice(db, salt)
    assert s["rate"] == 6  # not 6 * 23 / 28: the 5 empty days are skipped
    assert s["priority"] == "now"
    assert s["qty"] == 72  # order up to 6*9+6 = 60 from 0 -> 3 cartons of 24
    assert s["reason"].startswith("Out of stock. You sell about 6 a day. Order 72 today.")
    assert "You may run out for about 2 days." in s["reason"]
    ranked = ps.suggestions(db, TODAY)
    assert ranked[0]["name"] == "Salt"


def test_stock_out_days_are_not_counted(db):
    salt = make_out_of_stock(db)
    rows = ps.stock_by_day(db, salt.id, TODAY)
    assert len(rows) == 28
    assert len([r for r in rows if r["start_stock"] > 0]) == 23
    assert ps.daily_rate(db, salt.id, TODAY)["days_of_data"] == 23


def test_zero_sales_while_in_stock_count_as_real_zero_demand(db):
    item = make_item(db, "Camphor")
    add_batch(db, item, 500, 40)
    quiet = {20, 18, 15, 11, 9, 4}  # six in-stock days with no sales
    for d in range(28, 0, -1):
        if d not in quiet:
            sell_on(db, item, 3, d)
    info = ps.daily_rate(db, item.id, TODAY)
    assert info["days_of_data"] == 28
    assert abs(info["avg28"] - 3 * 22 / 28) < 1e-9  # the six quiet days pull the average down


def test_new_item_with_14_days_is_low_data_and_capped(db):
    item = make_item(db, "New soap", carton=12)
    add_batch(db, item, 6 + 2 * 14, 15)
    for d in range(14, 0, -1):
        sell_on(db, item, 2, d)
    s = advice(db, item)
    assert s["low_data"] is True and s["days_of_data"] == 14
    assert s["assumed_lead"] is True  # no supplier, so 2 days is a guess
    # formula wants 14 -> 24 (two cartons), but with so little history we cap at one carton or 7 days of sales
    assert s["qty"] == 12
    assert "Only 14 days of sales so far." in s["reason"]


def test_no_suggestion_before_five_days_of_sales(db):
    item = make_item(db, "Brand new")
    add_batch(db, item, 50, 4)
    for d in range(3, 0, -1):
        sell_on(db, item, 2, d)
    assert advice(db, item) is None


def test_carton_rounding():
    assert ps.round_to_cartons(13, 12) == 24
    assert ps.round_to_cartons(5, 12) == 12
    assert ps.round_to_cartons(12, 12) == 12
    assert ps.round_to_cartons(7, 1) == 7
    assert ps.round_to_cartons(0, 12) == 0


def test_two_suppliers_with_different_lead_times_get_different_order_by_dates(db):
    quick = steady(db, "Quick", per_day=3, stock_now=20, supplier=make_supplier(db, "Quick Co", lead=2))
    slow = steady(db, "Slow", per_day=3, stock_now=20, supplier=make_supplier(db, "Slow Co", lead=4))
    assert advice(db, quick)["order_by"] == (TODAY + timedelta(days=3)).isoformat()  # reorder point 9
    assert advice(db, slow)["order_by"] == (TODAY + timedelta(days=1)).isoformat()  # reorder point 15


def test_item_override_beats_the_supplier_lead_time(db):
    supplier = make_supplier(db, "Sharma", lead=2)
    item = steady(db, "Odd one", per_day=3, stock_now=20, supplier=supplier)
    item.lead_time_override = 4
    db.commit()
    assert advice(db, item)["lead_days"] == 4


MARKET_TRIPS = [1, 4]  # Tuesday and Friday


def test_market_item_is_bought_on_the_last_trip_before_it_runs_out(db):
    market = make_supplier(db, "Siyaganj Market", trips=MARKET_TRIPS)
    sugar = steady(db, "Sugar", per_day=8, stock_now=60, supplier=market, unit="kg")
    s = advice(db, sugar)
    # 7.5 days of stock: runs out on Wed 4 Nov, so the last trip with a day to spare is Tue 3 Nov
    assert s["order_by"] == "2026-11-03"
    assert s["will_run_out_before_trip"] is False
    assert s["qty"] == 68  # 8*(6 days to trip + 3 days to the next trip) + 8 spare - 12 left at the trip
    assert s["priority"] == "plan"
    assert s["reason"] == "Buy 68 kg at the market on Tuesday, about ₹9,520."


def test_market_item_that_runs_out_before_the_next_trip(db):
    market = make_supplier(db, "Siyaganj Market", trips=MARKET_TRIPS)
    veg = steady(db, "Vegetables", per_day=8, stock_now=8, supplier=market, unit="kg")
    s = advice(db, veg)
    assert s["will_run_out_before_trip"] is True  # gone Thursday, next trip is Friday
    assert s["order_by"] == "2026-10-30"
    assert s["qty"] == 56  # nothing left at the trip: 8*(2 + 4) + 8
    assert s["priority"] == "soon"


def test_skip_when_there_are_90_days_of_stock(db):
    item = steady(db, "Rice bran oil", per_day=1, stock_now=90)
    s = advice(db, item)
    assert s["priority"] == "skip"
    assert s["qty"] == 0
    assert s["reason"] == "You have 90 days of stock. Don't buy yet."


def test_ordered_tick_moves_item_out_of_now_and_add_stock_marks_it_received(db):
    salt = make_out_of_stock(db)
    assert advice(db, salt)["priority"] == "now"

    ps.mark_ordered(db, salt.id, 72, TODAY)
    ps.mark_ordered(db, salt.id, 72, TODAY)  # ticking twice must not order twice
    assert db.query(PurchaseOrderNote).count() == 1
    s = advice(db, salt)
    assert s["priority"] != "now"
    assert s["incoming"] == 72 and s["ordered_qty"] == 72

    ps.undo_ordered(db, salt.id)
    assert advice(db, salt)["priority"] == "now"

    ps.mark_ordered(db, salt.id, 72, TODAY)
    services.add_stock(db, salt.id, 72, same_price=False, cost_price=140)
    note = db.query(PurchaseOrderNote).one()
    assert note.status == "received"
    assert advice(db, salt)["ordered_qty"] is None


def test_market_list_shows_trip_items_and_keeps_ticked_ones(db):
    market = make_supplier(db, "Siyaganj Market", trips=MARKET_TRIPS)
    veg = steady(db, "Vegetables", per_day=8, stock_now=8, supplier=market, unit="kg")
    steady(db, "Rice", per_day=2, stock_now=100)  # not a market item

    trip = ps.market_list(db, TODAY)
    assert trip["trip_date"] == "2026-10-30" and trip["weekday"] == "Friday"
    assert [i["name"] for i in trip["items"]] == ["Vegetables"]
    assert trip["items"][0]["bought"] is False and trip["bought_count"] == 0

    ps.mark_ordered(db, veg.id, 56, TODAY)
    trip = ps.market_list(db, TODAY)
    assert trip["items"][0]["bought"] is True and trip["bought_count"] == 1  # still listed after the tick


def test_sample_data_gives_the_demo_story(db):
    seed_p3.seed(db)
    by_name = {s["name"]: s for s in ps.suggestions(db, seed_p3.END)}
    assert by_name["Tata Salt 1kg"]["priority"] == "now"
    assert by_name["Tata Salt 1kg"]["reason"].startswith("Out of stock.")
    assert by_name["Dettol Handwash 200ml"]["low_data"] is True
    assert by_name["Dettol Handwash 200ml"]["assumed_lead"] is True
    assert by_name["Rice Bran Oil 5L"]["priority"] == "skip"
    assert 85 <= by_name["Rice Bran Oil 5L"]["days_left"] <= 95
    assert "Order 24 by Thursday" in by_name["Fortune Sunflower Oil 1L"]["reason"]
    assert by_name["Vegetables"]["will_run_out_before_trip"] is True
    assert by_name["Sugar"]["order_by"] == "2026-10-30"
    # six stock-out days are ignored, six in-stock zero days are kept
    assert by_name["Lux Soap 4-pack"]["days_of_data"] == 22
    assert by_name["Camphor Tablets"]["days_of_data"] == 28
    assert by_name["Parle-G Biscuits"]["qty"] % 24 == 0
    assert len(by_name) == 11
