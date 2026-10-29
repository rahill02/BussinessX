import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import services
from batch_numbers import auto_number_value, format_batch_no, normalize_batch_no
from database import Base
from migrate import run_migrations
from models import Item
from schemas import ItemCreate, SizeQty


def new_item(db, name, batch_no=None, qty=10):
    return services.create_item(
        db, ItemCreate(name=name, type="normal", qty=qty, cost_price=100, selling_price=160, batch_no=batch_no))


def numbers(db, item):
    return [b["batch_no"] for b in services.item_stock_summary(db, item.id)["batches"]]


def test_numbers_are_added_automatically_in_a_running_series(db):
    a = new_item(db, "Oil")
    b = new_item(db, "Salt")
    assert numbers(db, a) == ["B-0001"]
    assert numbers(db, b) == ["B-0002"]

    services.add_stock(db, a.id, 5, same_price=False, cost_price=110)  # a restock is a new batch
    assert numbers(db, a) == ["B-0001", "B-0003"]


def test_same_price_top_up_keeps_the_batch_it_adds_to(db):
    a = new_item(db, "Oil")
    services.add_stock(db, a.id, 5, same_price=True)
    assert numbers(db, a) == ["B-0001"]  # no new batch, so no new number


def test_a_typed_number_is_kept_and_must_be_unique(db):
    a = new_item(db, "Oil", batch_no="LOT-2310A")
    assert numbers(db, a) == ["LOT-2310A"]

    with pytest.raises(ValueError, match='"LOT-2310A" is already used'):
        new_item(db, "Salt", batch_no="LOT-2310A")
    with pytest.raises(ValueError, match="already used"):
        services.add_stock(db, a.id, 5, same_price=False, cost_price=110, batch_no="LOT-2310A")

    assert db.query(Item).count() == 1  # the refused item was not half-saved
    assert numbers(db, a) == ["LOT-2310A"]  # and the refused restock changed nothing


def test_spaces_are_removed_and_odd_characters_refused():
    assert normalize_batch_no(" lot 77 ") == "lot77"
    assert normalize_batch_no("  ") is None
    assert normalize_batch_no(None) is None
    with pytest.raises(ValueError):
        normalize_batch_no("lot#1")


def test_typed_numbers_in_another_style_do_not_disturb_the_series(db):
    new_item(db, "Oil", batch_no="LOT-2310A")
    b = new_item(db, "Salt")
    assert numbers(db, b) == ["B-0001"]


def test_the_series_continues_after_the_highest_number_in_use(db):
    new_item(db, "Oil", batch_no="B-0099")  # typed, but it looks like a series number
    b = new_item(db, "Salt")
    assert numbers(db, b) == ["B-0100"]
    assert auto_number_value("B-0100") == 100 and auto_number_value("LOT-1") is None
    assert format_batch_no(12345) == "B-12345"


def test_shoes_get_one_number_per_size(db):
    sizes = [SizeQty(size="8", qty=3), SizeQty(size="9", qty=4)]
    auto = services.create_item(db, ItemCreate(name="Shoe A", type="shoes", cost_price=500, selling_price=900, sizes=sizes))
    assert numbers(db, auto) == ["B-0001", "B-0002"]

    typed = services.create_item(
        db, ItemCreate(name="Shoe B", type="shoes", cost_price=500, selling_price=900, sizes=sizes, batch_no="LOT7"))
    assert numbers(db, typed) == ["LOT7-8", "LOT7-9"]  # the size is added so each batch stays unique


def test_sale_bills_and_lines_show_which_batch_they_came_from(db):
    item = new_item(db, "Oil", qty=5)
    services.add_stock(db, item.id, 5, same_price=False, cost_price=120, selling_price=170)

    preview = services.preview_sale(db, item.id, 7)
    assert [line["batch_no"] for line in preview["lines"]] == ["B-0001", "B-0002"]

    sale = services.sell(db, item.id, 7, None)
    assert [line["batch_no"] for line in sale["lines"]] == ["B-0001", "B-0002"]


def test_existing_batches_are_numbered_in_the_order_they_were_bought():
    # an old database: the batch_no column does not exist yet
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP INDEX ix_batches_batch_no"))
        conn.execute(text("ALTER TABLE batches DROP COLUMN batch_no"))
        conn.execute(text("INSERT INTO items (id, name, type, unit, selling_price, tax_percent) VALUES (1,'Oil','normal','pcs',16000,0)"))
        for batch_id, day in [(1, "2026-10-20"), (2, "2026-10-05"), (3, "2026-10-20")]:
            conn.execute(text(
                "INSERT INTO batches (id, item_id, qty_received, qty_left, cost_price, cost_incl_tax, created_at) "
                f"VALUES ({batch_id}, 1, 5, 5, 100, 100, '{day} 08:00:00')"))

    run_migrations(engine)
    run_migrations(engine)  # running it again must change nothing

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, batch_no FROM batches ORDER BY id")).all()
    assert rows == [(1, "B-0002"), (2, "B-0001"), (3, "B-0003")]  # oldest first; same day goes by id

    db = sessionmaker(bind=engine)()
    assert services.new_batch_no(db) == "B-0004"
    db.close()
