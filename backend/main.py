import os
from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import engine, Base, get_db, SessionLocal
from migrate import run_migrations
from routers import items, stock, sales, reports, suppliers, buy
import services
from schemas import ItemCreate, SizeQty

Base.metadata.create_all(bind=engine)
run_migrations(engine)

app = FastAPI(title="BusinessX API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router)
app.include_router(suppliers.router)
app.include_router(buy.router)
app.include_router(stock.router)
app.include_router(sales.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/seed")
def seed(db: Session = Depends(get_db)):
    # quick demo data so the app isn't empty when showing it off
    samples = [
        ItemCreate(name="Fortune Sunflower Oil 1L", type="normal", unit="pcs",
                   qty=20, cost_price=140, mrp=165, selling_price=160),
        ItemCreate(name="Tata Sugar", type="loose", unit="kg",
                   qty=50, cost_price=38, selling_price=42),
        ItemCreate(name="Nike Air Shoes", type="shoes", unit="pcs",
                   cost_price=1800, selling_price=2200, mrp=2500,
                   sizes=[SizeQty(size="8", qty=5), SizeQty(size="9", qty=5), SizeQty(size="10", qty=3)]),
        ItemCreate(name="Bata Sandals", type="shoes", unit="pcs",
                   cost_price=400, selling_price=550, mrp=650,
                   sizes=[SizeQty(size="6", qty=6), SizeQty(size="7", qty=6)]),
        ItemCreate(name="India Gate Basmati Rice 5kg", type="normal", unit="pcs",
                   qty=15, cost_price=420, mrp=480, selling_price=460),
        ItemCreate(name="Parle-G Biscuits", type="normal", unit="pcs",
                   qty=100, cost_price=8, mrp=10, selling_price=10),
    ]
    created = [services.create_item(db, s).id for s in samples]
    return {"seeded_item_ids": created}


@app.post("/seed/oil-scenario")
def seed_oil_scenario(db: Session = Depends(get_db)):
    # replays the README/test walkthrough so the 676 profit and 1,824 stock value show up live
    item = services.create_item(db, ItemCreate(
        name="Fortune Sunflower Oil 1L", type="normal", unit="pcs",
        qty=20, cost_price=140, mrp=165, selling_price=160,
    ))
    services.sell(db, item.id, 14, 160)
    services.add_stock(db, item.id, 24, same_price=False, cost_price=152, selling_price=170, mrp=175)
    services.sell(db, item.id, 18, 170)
    return services.item_stock_summary(db, item.id)


def seed_if_empty():
    # a free host wipes the disk on restart, so SEED_DEMO=1 reloads the sample shop when the DB is empty
    import models
    import seed_p3

    db = SessionLocal()
    try:
        if db.query(models.Item).count() == 0:
            seed_p3.seed(db)
    finally:
        db.close()


if os.environ.get("SEED_DEMO") == "1":
    seed_if_empty()

# in production the built React app is served from the same address, so there is no CORS or API-URL setup
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
else:

    @app.get("/")
    def root():
        return {"status": "ok"}
