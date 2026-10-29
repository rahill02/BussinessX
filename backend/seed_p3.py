"""Sample shop for Problem 3: 60 days of repeatable sales history ending on 28 Oct 2026.

Run from the backend folder:
    python seed_p3.py            adds the sample shop to your database
    python seed_p3.py --reset    wipes ALL data first, then adds it

The random seed is fixed, so everyone gets exactly the same history.
"""
import random
import sys
from datetime import date, datetime, time, timedelta

from database import Base, SessionLocal, engine
from migrate import run_migrations
from models import Batch, Item, Supplier
import purchase_service
import services

END = date(2026, 10, 28)  # last day of history, also the demo "today"
DAYS = 60
SEED = 2026
SPARE = 3  # units left over when the next batch arrives

SHARMA, GUPTA, MARKET = "Sharma Traders", "Gupta Wholesale", "Siyaganj Market"

SUPPLIERS = [
    dict(name=SHARMA, lead=2, delivery="1,3,5", market=False, trips=None),  # delivers Tue, Thu, Sat
    dict(name=GUPTA, lead=4, delivery=None, market=False, trips=None),
    dict(name=MARKET, lead=0, delivery=None, market=True, trips="1,4"),  # trips on Tuesday and Friday
]

# batches: (days_ago_it_arrived, how_much)
#   "next"            enough until the next batch arrives, plus a few spare
#   ("covers", n)     runs out exactly at the end of the day n days ago (makes stock-out days)
#   "final"           last batch, sized so the shop ends with `final_stock` (or `final_days` of cover)
ITEMS = [
    dict(name="Fortune Sunflower Oil 1L", supplier=SHARMA, carton=12, mean=3, cost=140, price=160, mrp=165,
         batches=[(59, "next"), (30, "next"), (14, "final")], final_stock=13),
    # out of stock for the last 3 days, so the rate must ignore them
    dict(name="Tata Salt 1kg", supplier=SHARMA, carton=24, mean=6, cost=22, price=25, mrp=28,
         batches=[(59, "next"), (25, ("covers", 3))], final_stock=0),
    # a new item: only about 14 in-stock days of history, so "Low data"
    dict(name="Dettol Handwash 200ml", supplier=None, carton=6, mean=2, cost=62, price=75, mrp=80,
         batches=[(15, "final")], final_stock=6, first_sale_ago=15),
    dict(name="Parle-G Biscuits", supplier=GUPTA, carton=24, mean=14, cost=8, price=10, mrp=10,
         batches=[(59, "next"), (28, "next"), (10, "final")], final_stock=40),
    # slow seller with about 90 days of stock, so "don't buy yet"
    dict(name="Rice Bran Oil 5L", supplier=SHARMA, carton=4, mean=0.4, cost=640, price=720, mrp=760,
         batches=[(59, "next"), (20, "final")], final_days=90),
    dict(name="Sugar", supplier=MARKET, unit="kg", mean=8, cost=40, price=45,
         batches=[(59, "next"), (31, "next"), (10, "final")], final_stock=40),
    dict(name="Vegetables", supplier=MARKET, unit="kg", mean=15, cost=30, price=40,
         batches=[(59, "next"), (31, "next"), (10, "final")], final_stock=20),
    # 6 in-stock days with no sales at all: real zero demand, so they DO count
    dict(name="Camphor Tablets", supplier=GUPTA, carton=10, mean=2, cost=12, price=15, mrp=15,
         batches=[(59, "next"), (25, "final")], final_stock=30, zero_days=[22, 19, 15, 11, 8, 4]),
    # 6 stock-out days (shelf empty): those are NOT zero demand, so they are ignored
    dict(name="Lux Soap 4-pack", supplier=SHARMA, carton=12, mean=4, cost=110, price=130, mrp=135,
         batches=[(59, ("covers", 17)), (11, "final")], final_stock=20),
    dict(name="Aashirvaad Atta 5kg", supplier=GUPTA, carton=4, mean=5, cost=240, price=265, mrp=275,
         batches=[(59, "next"), (26, "next"), (9, "final")], final_stock=55),
    dict(name="Colgate Strong Teeth 200g", supplier=SHARMA, carton=12, mean=3, cost=95, price=110, mrp=115,
         batches=[(59, "next"), (30, "next"), (12, "final")], final_stock=70),
]


def at(day, hour):
    # stored as naive UTC like the app does; noon sales and 8am deliveries land on the same date anywhere
    return datetime.combine(day, time(hour))


def make_demand(rng, spec):
    """Units wanted on each of the 60 days, keyed by days-ago (59 = oldest, 0 = today)."""
    mean = spec["mean"]
    first = spec.get("first_sale_ago", DAYS - 1)
    demand = {}
    for ago in range(DAYS - 1, -1, -1):
        if mean < 1:
            units = 1 if rng.random() < mean else 0
        else:
            units = max(0, round(rng.gauss(mean, mean * 0.3)))
        demand[ago] = 0 if ago > first or ago in spec.get("zero_days", []) else units
    return demand


def plan_quantities(demand, spec):
    """Work out each batch size from the demand, so the stock-outs and the final stock come out exactly as designed."""
    batches = spec["batches"]
    final_stock = spec.get("final_stock")
    if final_stock is None:  # "N days of cover" at the rate the app will measure
        last28 = [demand[a] for a in range(28, 0, -1)]
        last7 = [demand[a] for a in range(7, 0, -1)]
        rate = 0.7 * sum(last28) / 28 + 0.3 * sum(last7) / 7
        final_stock = round(rate * spec["final_days"])
    stock, quantities = 0, []
    for i, (ago, rule) in enumerate(batches):
        next_ago = batches[i + 1][0] if i + 1 < len(batches) else -1
        if rule == "final":
            qty = final_stock + sum(demand[a] for a in range(ago, -1, -1)) - stock
        elif rule == "next":
            qty = sum(demand[a] for a in range(ago, next_ago, -1)) - stock + SPARE
        else:  # ("covers", n)
            qty = sum(demand[a] for a in range(ago, rule[1] - 1, -1)) - stock
        quantities.append(qty)
        stock = max(0, stock + qty - sum(demand[a] for a in range(ago, next_ago, -1)))
    return quantities


def seed(db, end=END):
    if db.query(Item).filter(Item.name == ITEMS[1]["name"]).first():
        raise ValueError("The sample shop is already in this database. Run with --reset to start over.")
    rng = random.Random(SEED)

    suppliers = {}
    for s in SUPPLIERS:
        # a supplier you already created with the same name is kept exactly as you set it up
        row = db.query(Supplier).filter(Supplier.name == s["name"]).first()
        if not row:
            row = Supplier(name=s["name"], lead_time_days=s["lead"], delivery_weekdays=s["delivery"],
                           is_market=s["market"], market_weekdays=s["trips"])
            db.add(row)
            db.flush()
        suppliers[s["name"]] = row.id

    created = []
    for spec in ITEMS:
        unit = spec.get("unit", "pcs")
        item = Item(
            name=spec["name"], type="normal" if unit == "pcs" else "loose", unit=unit,
            selling_price=spec["price"] * 100, tax_percent=0,
            supplier_id=suppliers.get(spec["supplier"]), carton_size=spec.get("carton", 1),
        )
        db.add(item)
        db.flush()

        demand = make_demand(rng, spec)
        quantities = plan_quantities(demand, spec)
        arrivals = {ago: qty for (ago, _), qty in zip(spec["batches"], quantities)}
        stock = 0
        for ago in range(DAYS - 1, -1, -1):
            day = end - timedelta(days=ago)
            if ago in arrivals:
                qty = arrivals[ago]
                db.add(Batch(
                    item_id=item.id, batch_no=services.new_batch_no(db), qty_received=qty, qty_left=qty,
                    cost_price=spec["cost"] * 100, cost_incl_tax=spec["cost"] * 100,
                    mrp=spec["mrp"] * 100 if spec.get("mrp") else None, selling_price=item.selling_price,
                    created_at=at(day, 8),
                ))
                db.flush()
                stock += qty
            sell = min(demand[ago], stock)
            if sell > 0:
                services.sell(db, item.id, sell, None, sold_at=at(day, 12))
                stock -= sell
        created.append(item.id)
    db.commit()
    return created


def main():
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        ids = seed(db)
    except ValueError as e:
        print(e)
        return
    print(f"Added {len(ids)} items, 3 suppliers and 60 days of sales (to {END:%d %b %Y}).")
    print(f"In the app: Buy tab > Demo > set the demo date to {END:%d %b %Y} (unless that is already today).")
    print("What the Buy tab will say on that date:")
    for s in purchase_service.suggestions(db, END):
        print(f"  {s['priority']:5} {s['name']:28} qty {s['qty']:>5g}")
    db.close()


if __name__ == "__main__":
    main()
