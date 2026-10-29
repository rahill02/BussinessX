from sqlalchemy import inspect, text

# create_all() only creates missing TABLES, never missing columns, so older businessx.db files
# need these columns added by hand. Existing rows keep their data.
NEW_COLUMNS = [
    ("batches", "selling_price", "INTEGER"),
    ("items", "supplier_id", "INTEGER REFERENCES suppliers(id)"),
    ("items", "carton_size", "INTEGER NOT NULL DEFAULT 1"),
    ("items", "lead_time_override", "INTEGER"),
    ("items", "barcode", "TEXT"),
    ("batches", "batch_no", "TEXT"),
]


def run_migrations(engine):
    inspector = inspect(engine)
    for table, column, definition in NEW_COLUMNS:
        if column in [c["name"] for c in inspector.get_columns(table)]:
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            if (table, column) == ("batches", "selling_price"):
                # a batch that already sold keeps the price it last sold at; others take the item's price
                conn.execute(text(
                    "UPDATE batches SET selling_price = COALESCE("
                    " (SELECT sell_price FROM sale_lines WHERE sale_lines.batch_id = batches.id ORDER BY id DESC LIMIT 1),"
                    " (SELECT selling_price FROM items WHERE items.id = batches.item_id))"
                ))
            if (table, column) == ("batches", "batch_no"):
                # number the batches you already have B-0001, B-0002... in the order they were bought
                conn.execute(text(
                    "UPDATE batches SET batch_no = 'B-' || printf('%04d', ("
                    " SELECT COUNT(*) FROM batches b2 WHERE b2.created_at < batches.created_at"
                    " OR (b2.created_at = batches.created_at AND b2.id <= batches.id)))"
                ))
    # ALTER TABLE cannot add a UNIQUE column, so the rule is a separate index (empty values never clash)
    with engine.begin() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_items_barcode ON items (barcode)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_batches_batch_no ON batches (batch_no)"))
