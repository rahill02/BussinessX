import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import services
from schemas import ItemCreate, ItemEdit


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_oil_scenario(db):
    item = services.create_item(db, ItemCreate(
        name="Fortune Sunflower Oil 1L", type="normal", unit="pcs",
        qty=20, cost_price=140, mrp=165, selling_price=160, tax_percent=0,
    ))

    sale1 = services.sell(db, item.id, 14, 160)
    assert sale1["total_profit"] == 280
    assert services.item_stock_summary(db, item.id)["qty"] == 6

    services.add_stock(db, item.id, 24, same_price=False, cost_price=152, selling_price=170, mrp=175)
    assert services.item_stock_summary(db, item.id)["qty"] == 30

    sale2 = services.sell(db, item.id, 18, 170)
    assert sale2["lines"][0]["profit"] == 180
    assert sale2["lines"][1]["profit"] == 216
    assert sale2["total_profit"] == 396

    total_profit = sale1["total_profit"] + sale2["total_profit"]
    assert total_profit == 676

    summary = services.item_stock_summary(db, item.id)
    assert summary["qty"] == 12
    assert summary["stock_value"] == 1824
    assert summary["cost_min"] == 152
    assert summary["selling_price"] == 170
    assert summary["mrp"] == 175


def test_lower_new_cost_still_sells_older_stock_first(db):
    item = services.create_item(db, ItemCreate(
        name="Rice", type="normal", qty=10, cost_price=100, selling_price=120,
    ))
    services.add_stock(db, item.id, 10, same_price=False, cost_price=80, selling_price=120)
    sale = services.sell(db, item.id, 15, 120)
    # first 10 units still come from the older, dearer batch
    assert sale["lines"][0]["qty"] == 10
    assert sale["lines"][0]["profit"] == 10 * (120 - 100)
    assert sale["lines"][1]["qty"] == 5
    assert sale["lines"][1]["profit"] == 5 * (120 - 80)


def test_selling_price_change_without_restock(db):
    item = services.create_item(db, ItemCreate(
        name="Sugar", type="normal", qty=10, cost_price=40, selling_price=50,
    ))
    services.edit_item(db, item.id, ItemEdit(selling_price=55))
    sale = services.sell(db, item.id, 2, 55)
    assert sale["lines"][0]["profit"] == 2 * (55 - 40)


def test_restock_after_stock_hit_zero(db):
    item = services.create_item(db, ItemCreate(
        name="Biscuits", type="normal", qty=5, cost_price=8, selling_price=10,
    ))
    services.sell(db, item.id, 5, 10)
    assert services.item_stock_summary(db, item.id)["qty"] == 0

    services.add_stock(db, item.id, 20, same_price=False, cost_price=9, selling_price=11)
    assert services.item_stock_summary(db, item.id)["qty"] == 20
    sale = services.sell(db, item.id, 5, 11)
    assert sale["lines"][0]["profit"] == 5 * (11 - 9)


def test_same_price_restock_adds_to_the_latest_batch(db):
    # regression: add_stock(same_price=True) must pick the newest batch, not the oldest
    item = services.create_item(db, ItemCreate(
        name="Biscuits", type="normal", qty=5, cost_price=8, selling_price=10,
    ))
    services.sell(db, item.id, 5, 10)  # first batch now at qty_left 0
    services.add_stock(db, item.id, 20, same_price=False, cost_price=9, selling_price=11)  # newer batch

    services.add_stock(db, item.id, 7, same_price=True)

    summary = services.item_stock_summary(db, item.id)
    assert summary["qty"] == 27
    newest_batch = summary["batches"][-1]
    assert newest_batch["cost_price"] == 9
    assert newest_batch["qty_left"] == 27


def test_return_of_one_bottle(db):
    item = services.create_item(db, ItemCreate(
        name="Oil", type="normal", qty=20, cost_price=140, selling_price=160,
    ))
    sale = services.sell(db, item.id, 5, 160)
    line_id = sale["lines"][0]["id"]

    before_qty = services.item_stock_summary(db, item.id)["qty"]
    result = services.return_sale_line(db, line_id, 1)
    after_qty = services.item_stock_summary(db, item.id)["qty"]

    assert after_qty == before_qty + 1
    assert result["profit_reversed"] == 1 * (160 - 140)


def test_old_stock_sells_at_old_price_when_no_price_given(db):
    item = services.create_item(db, ItemCreate(
        name="Oil", type="normal", qty=20, cost_price=140, mrp=165, selling_price=160,
    ))
    services.sell(db, item.id, 14, None)
    services.add_stock(db, item.id, 24, same_price=False, cost_price=152, selling_price=170, mrp=175)

    summary = services.item_stock_summary(db, item.id)
    assert summary["next_sell_price"] == 160  # 6 old bottles still on the shelf
    assert summary["selling_price"] == 170

    sale = services.sell(db, item.id, 18, None)
    # spans both batches: each part charged at its own batch's price
    assert [(l["qty"], l["sell_price"]) for l in sale["lines"]] == [(6, 160), (12, 170)]
    assert sale["lines"][0]["profit"] == 6 * (160 - 140)
    assert sale["lines"][1]["profit"] == 12 * (170 - 152)
    assert sale["total_amount"] == 6 * 160 + 12 * 170
    assert services.item_stock_summary(db, item.id)["next_sell_price"] == 170


def test_preview_splits_and_flags_not_enough_stock(db):
    item = services.create_item(db, ItemCreate(
        name="Oil", type="normal", qty=7, cost_price=180, selling_price=250,
    ))
    services.add_stock(db, item.id, 10, same_price=False, cost_price=200, selling_price=270)

    preview = services.preview_sale(db, item.id, 10)
    assert preview["error"] is None
    assert [(l["qty"], l["sell_price"]) for l in preview["lines"]] == [(7, 250), (3, 270)]
    assert preview["total_amount"] == 7 * 250 + 3 * 270
    assert services.item_stock_summary(db, item.id)["qty"] == 17  # preview saves nothing

    too_many = services.preview_sale(db, item.id, 20)
    assert too_many["error"] == "Not enough stock. Only 17 left."
    assert too_many["available"] == 17


def test_editing_price_reprices_stock_on_shelf(db):
    item = services.create_item(db, ItemCreate(
        name="Oil", type="normal", qty=5, cost_price=100, selling_price=120,
    ))
    services.add_stock(db, item.id, 5, same_price=False, cost_price=110, selling_price=130)
    services.edit_item(db, item.id, ItemEdit(selling_price=125))

    sale = services.sell(db, item.id, 10, None)
    assert {l["sell_price"] for l in sale["lines"]} == {125}


def test_csv_import_creates_valid_rows_and_reports_errors(db):
    rows = [
        {"name": "Fortune Oil 1L", "type": "normal", "unit": "pcs", "qty": "20",
         "cost_price": "140", "selling_price": "160", "mrp": "165", "tax_percent": "0", "custom_id": ""},
        {"name": "", "type": "normal", "unit": "pcs", "qty": "10",
         "cost_price": "10", "selling_price": "12", "mrp": "", "tax_percent": "", "custom_id": ""},
        {"name": "Tata Sugar", "type": "loose", "unit": "kg", "qty": "-5",
         "cost_price": "38", "selling_price": "42", "mrp": "", "tax_percent": "", "custom_id": ""},
        {"name": "Bad Shoes", "type": "shoes", "unit": "pcs", "qty": "5",
         "cost_price": "100", "selling_price": "150", "mrp": "", "tax_percent": "", "custom_id": ""},
    ]

    result = services.import_csv(db, rows)

    assert len(result["created"]) == 1
    assert len(result["errors"]) == 3
    assert result["errors"][0]["row"] == 3  # row 1 is the header
    assert "name is required" in result["errors"][0]["message"]
    assert "negative" in result["errors"][1]["message"]
    assert "shoes" in result["errors"][2]["message"]

    items = services.list_items(db)
    assert len(items) == 1
    assert items[0]["name"] == "Fortune Oil 1L"
