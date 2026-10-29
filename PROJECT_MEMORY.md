# BusinessX: project memory

**Purpose of this file:** a complete hand-over. Someone (or an AI assistant) with *no* memory of this project should be able to read only this file and understand what the project is, why it is built this way, how everything works, how to run and test it, what the owner prefers, and what is still open.

**This is not the evaluator document.** The evaluator reads `README.md`, which must never mention how the project was built. This file does discuss how it is worked on, so leave it out if the repository is shared with an evaluator.

- Last updated: 2026-10-29
- State at that date: 44 backend tests pass, `npm run build` is clean, `npm run lint` has 0 errors and 7 warnings (React purity and set-state-in-effect patterns, harmless).
- Keep it current: see the checklist at the end.

---

## 1. What this project is

BusinessX is a small **demo web app** for shopkeepers (kirana, medical, clothing and shoe shops) who track stock, sales and profit. The real BusinessX is an Android app; this demo is a **mobile-first web app** that shows improvements to it. The owner built it for an assessment and must be able to **explain and change the code live, without AI**. That is why the code is deliberately small and plain (see section 2).

Users are small shopkeepers, not accountants. Many dislike typing on a phone. So: big buttons, big text, plain words, a number pad for numbers, few fields per screen, one main action per screen.

### The three problems the demo solves

| # | Problem | The idea |
|---|---|---|
| 1 | Adding items takes too long (400 items = 13+ hours) | Item types with their own forms, "Save & add next" batch mode, margin chips, name autocomplete, Enter-to-next-field, CSV import, optional barcode scanning |
| 2 | Restocking at a new price makes profit lie (old app keeps ONE cost per item) | Stock in **batches**, sold **FIFO**; each sale line freezes its cost; each batch has its own selling price |
| 3 | Shopkeeper guesses what to reorder | A **Buy** tab: what to buy, how much, and the date to order by, each with a one-line reason; a market-trip list that works offline |

Extra features added later at the owner's request: optional **barcodes** (scan to fill name and price) and unique **batch numbers** (like lot numbers in online shops).

### The owner's definition of "correct profit"
`profit earned + stock value at cost = cash in - cash out`, for any period. This only holds if every sale is costed against the batch it really came from, and that cost is frozen at sale time.

### The test scenario that must always pass ("Sunil's oil")
1. Add "Fortune Sunflower Oil 1L": 20 bottles, cost 140, MRP 165, selling 160, tax 0.
2. Sell 14 at 160 -> profit 14 x 20 = 280. Stock 6.
3. Add stock: 24 bottles, cost 152, MRP 175, new selling 170 (new batch). Stock 30.
4. Sell 18 at 170 -> first 6 from batch 1 (profit 180), next 12 from batch 2 (profit 216). Sale profit 396.
5. Total profit 280 + 180 + 216 = **676**. Stock left 12, all batch 2, stock value 12 x 152 = **1,824**.
(Weighted average would give 647.20 and 1,795.20; that comparison is in the README.) `POST /seed/oil-scenario` and the Report tab's "Load Sunil's oil demo" button replay it; `tests/test_fifo.py::test_oil_scenario` asserts it.

---

## 2. Owner's rules and preferences (read before changing anything)

**Code style**
- Small files, simple names, **short comments that explain WHY** (never WHAT), no clever abstractions, no extra features. The owner explains this code live.
- **No new libraries.** Backend: only FastAPI, Pydantic, SQLAlchemy, uvicorn, pytest, python-multipart. Frontend: only React, Vite, Tailwind (no router, no state library, no UI kit, no icon library, no chart library). Plain `fetch` for API calls. **No machine learning** (README explains why: small data, needs a plain one-line reason, easy to explain).
- Money is **integer paise** in the database (never floats). The API and screens use rupees.
- Barcode camera scanning uses the browser's built-in `BarcodeDetector`, not a library, for the same reason.

**Product rules**
- Mobile-first, max width 480px centred, inputs at least 48px tall, `inputmode="decimal"` on number fields, Enter moves to the next field.
- Plain words. Avoid jargon (the Add screen says **Pieces / Sizes / Weight**, not normal / shoes / loose).
- Warnings never block (selling below cost, above MRP, duplicate name); they inform.
- Quantity can never be typed over on the Edit screen. Stock changes only through Add stock, Sell, Return or Correct stock.
- Any tag that carries meaning uses **a word plus a colour**, never colour alone.
- Every optional thing stays optional (photo, tax, item code, MRP, barcode, batch number, supplier).

**Design feedback the owner has given (do not undo)**
- They rejected a dark/violet "high intelligence" theme. They want **off-white/grey with a standard blue**, professional, clean, soothing, styled like their website mybusinessx.com (Poppins, blue accents, orange underline).
- Sell screen: the A-Z item list must appear **only after the search box is clicked**, not always.
- Old stock must sell at the **old price** and new stock at the **new price** (FIFO); a sale spanning both is split and shown before confirming.

**README rules**
- `README.md` is shown to an evaluator. It must **not mention how the project was built** (no AI / LLM wording).
- It keeps one section the owner fills in: the heading "Where the AI was wrong and how I caught it", **left empty on purpose**. Never write in it.
- Update the README whenever a feature is added (tests count, API table, assumptions).

**How the owner likes to work**
- They paste large, structured specs (sometimes in numbered steps) and expect the steps done in order.
- After each step: say in about 3 lines what was built and how to run or check it. Show pytest output when asked.
- Run tests and look at the real UI before saying something is done. State plainly what could not be verified (for example the phone camera).
- Short final answers. Plain English.

**Testing safety**
- The owner's real database `backend/businessx.db` holds their own experiments. **Never wipe, reset or seed it** without being asked. Test against a throwaway copy (see section 12).

---

## 3. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Python 3.13, FastAPI 0.162, Pydantic 2.14, SQLAlchemy 2.1, uvicorn | `requirements.txt` lists names only, no pins |
| Database | SQLite, one file `backend/businessx.db` | created next to `main.py`; path is relative to the working directory |
| Tests | pytest, in-memory SQLite per test | `tests/conftest.py` provides the `db` fixture |
| Frontend | React 19, Vite 8, Tailwind CSS 4 | Tailwind v4: tokens live in `src/index.css` (`@theme`), plugin is `@tailwindcss/postcss`, **no `tailwind.config.js`** |
| Lint | oxlint (`npm run lint`) | config `frontend/.oxlintrc.json` |
| Font | Poppins (400 to 800) from Google Fonts | needs internet on first load, falls back to system fonts |
| Product names | Open Food Facts public API | optional, backend only, used for barcode name lookup |

Dev environment of the owner: Windows 11, Node 22, Python 3.13. Commands below work in cmd, PowerShell or Git Bash.

---

## 4. How to run, test and seed

### Backend (from `backend/`)
```
python -m venv venv                  (first time only)
venv\Scripts\activate
pip install -r requirements.txt      (first time only)
uvicorn main:app --reload            -> http://127.0.0.1:8000  (docs at /docs)
```
On start, `main.py` runs `Base.metadata.create_all` and `run_migrations`, so older databases are upgraded automatically.

### Frontend (from `frontend/`)
```
npm install                          (first time only)
npm run dev                          -> http://localhost:5173
npm run build                        (type-check by compiling; output dist/ is git-ignored)
npm run lint
```
`frontend/.env` holds `VITE_API_URL=http://127.0.0.1:8000`. The backend must be running first.

### Tests (from `backend/`)
```
python -m pytest tests -v            44 tests, about 6 seconds, no internet needed
```

### Sample data
| Data | How |
|---|---|
| 6 quick items (oil, loose sugar, 2 shoe models, rice, biscuits) | `POST /seed`, or Stock tab empty state "Load 6 demo items" |
| Sunil's oil story (676 / 1,824) | `POST /seed/oil-scenario`, or Report tab "Load Sunil's oil demo" (creates a NEW "Fortune Sunflower Oil 1L" each time) |
| **Problem 3 shop** (11 items, 3 suppliers, 60 days of sales ending 28 Oct 2026) | `python seed_p3.py` in `backend/`. `--reset` wipes everything first. It refuses to run twice and reuses suppliers with the same name |

After seeding Problem 3 data, open **Buy > Demo** and set the demo date to **28 Oct 2026** (the history ends that day; with a much later date there are no recent sales and everything says "All stocked up").

---

## 5. Repository layout

```
BussinessX/
  README.md              evaluator document (no mention of how it was built)
  PROJECT_MEMORY.md      this file
  .gitignore             venv, businessx.db, node_modules, dist, caches
  .claude/launch.json    dev-server config for the editor's preview ("frontend" on port 5173)
  backend/
    main.py              FastAPI app, CORS (all origins), routers, startup migration, /seed routes
    database.py          engine, SessionLocal (autoflush=False!), Base, get_db
    models.py            all tables
    schemas.py           Pydantic request models and validators
    services.py          Problems 1 and 2 logic: items, batches, FIFO sell, returns, corrections, reports, CSV, barcode lookup, batch numbers
    purchase_service.py  Problem 3 logic: rate, suggestions, market list, ordered notes, suppliers
    barcode_service.py   barcode normalising, Open Food Facts lookup (stdlib only)
    batch_numbers.py     batch number normalising and the B-0001 series helpers (stdlib only)
    migrate.py           adds new columns/indexes to older databases, backfills data
    seed_p3.py           repeatable Problem 3 sample shop
    routers/             thin HTTP layer: items.py, stock.py, sales.py, reports.py, suppliers.py, buy.py
    tests/               conftest.py, test_fifo.py (10), test_purchase.py (16), test_barcode.py (9), test_batch_numbers.py (9)
  frontend/
    index.html           loads Poppins, theme-color
    src/main.jsx, App.jsx, api.js, index.css
    src/components/      small reusable pieces (section 9)
    src/screens/         one file per screen or sheet (section 9)
    src/utils/           format.js, buyFormat.js, itemTypes.js, focusNext.js
    (README.md, public/favicon.svg, public/icons.svg are leftovers of the Vite template; the frontend README is NOT the project README)
```
Routers are thin: they validate input, call a service function and turn `ValueError` into an HTTP 400 (or 404). All business logic is in `services.py`, `purchase_service.py`, `barcode_service.py`, `batch_numbers.py`.

---

## 6. Data model

All tables are in `backend/models.py`. Timestamps are stored as naive **UTC** (`func.now()`).

| Table | Key columns |
|---|---|
| **items** | id, name, `type` (`normal`/`shoes`/`loose`), `unit` (`pcs`/`kg`/`g`/`l`), `selling_price` (paise, the **latest** price shown on lists), `tax_percent`, `custom_id`, `photo_url` (unused by the UI), **`barcode`** (optional, unique), **`supplier_id`** (optional), **`carton_size`** (default 1), **`lead_time_override`** (days, optional), created_at. **No cost and no quantity live on the item.** |
| **batches** | id, item_id, **`batch_no`** (unique, `B-0001`... or typed), `size` (shoes only), `qty_received`, `qty_left`, `cost_price`, `cost_incl_tax` (paise, **FIFO profit uses this**), `mrp`, **`selling_price`** (this batch's own price), created_at. FIFO order = `created_at`, then `id` |
| **sales** / **sale_lines** | A sale has one line per batch used: `batch_id`, `size`, `qty`, `sell_price`, **`cost_per_unit` and `profit` frozen at sale time** (paise) |
| **return_lines** | `sale_line_id`, qty, refund_price, `profit_reversed`. A return puts qty back on the batch the sale came from |
| **adjustments** | stock corrections (damage, miscount): item, batch, `qty_change` (can be negative), reason. Logged separately, never as sales |
| **suppliers** | name, `lead_time_days` (default 2), `delivery_weekdays` (text "0,3", 0 = Monday, **shown only, not used in maths**), `is_market`, `market_weekdays` (trip days) |
| **purchase_order_notes** | item_id, qty, ordered_at, `status` `ordered`/`received`. "I ordered this" so it counts as stock on its way |

Conventions
- `cost_incl_tax = cost_price x (1 + tax_percent / 100)`, computed when the batch is created.
- Shoes: **one batch per size**. Add-stock and sell take a `size`.
- Loose items have fractional quantities; units `kg`, `g`, `l`.
- Weekday lists are stored as comma text and exposed as lists of ints (0 = Monday ... 6 = Sunday).

---

## 7. Business logic, feature by feature

### 7.1 Problem 1: adding items fast (`AddScreen`, `services.create_item`)
- **Types** (stored value -> label): `normal` -> **Pieces** (packs, bottles), `shoes` -> **Sizes** (shoes, clothes: quantity per size chip 6..11 plus custom size), `loose` -> **Weight** (kg/g/litre, decimal stock, no MRP).
- **Save & add next** keeps the type, unit and size columns but clears every value, and shows a banner "Batch · Sizes, 3 added" with **Finish**. **Save** ends the batch.
- **Margin chips** `+20%` and `+30%` fill the selling price from the cost price.
- **Name autocomplete** from the shop's own items (`GET /items/names?q=`), to copy and edit.
- **Warnings** (non-blocking): selling below cost, selling above MRP, duplicate name.
- Optional fields sit in a collapsible "Tax, item code and batch number".
- **CSV import** (`POST /items/import-csv`, sheet `CsvImportSheet`): columns `name,type,unit,qty,cost_price,selling_price,mrp,tax_percent,custom_id`. Only `normal` and `loose` rows (shoes need per-size quantities). Every row is validated; valid rows are saved, invalid rows come back as `{row, message}` (row 1 is the header). Template at `GET /items/import-csv/template`.
- Photo upload is **not** wired up.

### 7.2 Problem 2: batches, FIFO, per-batch prices (`services.py`)
- **`sell(db, item_id, qty, sell_price=None, size=None, sold_at=None)`**: takes from the oldest batch with stock; splits across batches; one `SaleLine` per batch with frozen cost and profit. **Each part is charged at its own batch's selling price** unless a single `sell_price` is passed (then that price applies to the whole sale). Raises `"Not enough stock. Only N left."`. Returns a warning for selling below cost or above MRP. `sold_at` exists only for back-dated sample data.
- **`preview_sale(...)`**: the same plan without saving; powers the bill shown before tapping Sold (`POST /sales/preview`). Over-stock returns `error` plus `available`, and the UI offers "Sell all N".
- **`add_stock(item_id, qty, same_price, cost_price, selling_price, mrp, size, batch_no)`**:
  - `same_price=True` (default) adds to the **newest** batch (of that size); cost fields locked in the UI; no new batch, no new number.
  - `same_price=False` creates a new batch with its own cost, price, MRP and number, and sets `item.selling_price` to that latest price. Older batches keep their price until they sell out.
  - Marks any `ordered` purchase note for the item as `received`.
- **`return_sale_line`**: qty back into the original batch, profit reversed, cannot exceed what was sold. The UI's Return button returns what is left on that line (the API accepts any quantity).
- **`correct_stock`**: decrease comes from the oldest batch with stock, increase goes to the newest; one batch only; logged as an `Adjustment`. UI: "Remove / Add back" with one-tap reasons.
- **`edit_item`**: editing the selling price **reprices all stock currently on the shelf**. `supplier_id`, `lead_time_override` and `barcode` use "was it sent?" semantics (`model_fields_set`): not sent = unchanged, sent as `null` = cleared.
- **`item_stock_summary`** returns, among others: `qty`, `next_sell_price` (price the next unit sells at), `sell_min/max`, `cost_min/max`, `stock_value`, `lead_days` + `lead_source` (`item`/`supplier`/`market`/`assumed`), supplier info, `carton_size`, `barcode`, and `batches[]` (each with `batch_no`, prices, qty).
- **`report(from, to)`**: totals net of returns, sales list, `stock_value` of all batches (current, not date-limited). `list_sales(date)` filters by the sale's date.

### 7.3 Problem 3: what to buy (`purchase_service.py`)
All date logic takes a `today` argument (default real today) so tests and demos can fix the date.

**Constants (top of the file):** `BUFFER_DAYS=1`, `COVER_DAYS=7`, `SKIP_DAYS=60`, `SOON_DAYS=3`, `PLAN_DAYS=7`, `DEFAULT_LEAD_DAYS=2`, window 28 days, recent 7 days, low data under 21 in-stock days, no suggestion under 5, weights 0.7 / 0.3.

**Rate (sales per day):** replay batches, sales, returns and adjustments to know stock at the **start of each day**. Look at the 28 days **before** today. Count **only days with stock at the start of the day above 0** (zero sales on an empty shelf is not zero demand; zero sales with stock on the shelf **is** real zero demand and counts). `avg28` = units wanted on those days / those days; `avg7` the same for the last 7; `rate = 0.7*avg28 + 0.3*avg7`. Demand = sold minus returned, kept on the sale's day. Under 21 in-stock days: **low confidence** ("Low data" tag; quantity capped at one carton or 7 days of cover, whichever is larger, in whole cartons, never below one carton). Under 5: no suggestion.

**Formulas (stock = on hand + ordered not yet received; `lead` = item override, else supplier days, else 2 "assumed"):**
```
buffer_units     = rate * BUFFER_DAYS
reorder_point    = rate * lead + buffer_units
days_left        = stock / rate
days_until_order = max(0, floor((stock - reorder_point) / rate))
order_by         = today + days_until_order
order_up_to      = rate * (lead + COVER_DAYS) + buffer_units
stock_at_order   = max(0, stock - rate * days_until_order)
qty              = ceil((order_up_to - stock_at_order) / carton_size) * carton_size
```
Worked example (a test): rate 3, stock 20, lead 2, carton 12 -> reorder point 9, order up to 30, order by day 3, stock then 11, need 19 -> **24**. `floor`/`ceil` round to 6 decimals first (`_floor`, `_ceil`) to avoid float noise.

**Market items** (supplier `is_market` with trip weekdays): lead 0. Order by = the **last trip on or before (run-out date minus buffer)**; if that is already past, the **next trip**. If even the next trip is after the run-out date: tag **"Will run out before the next trip"** and buy on the next trip. Quantity = `rate*(days_to_trip + days_between_trips) + buffer_units - stock_at_trip`, rounded up to cartons.

**Priority (also the sort order, then order_by, then days_left):**
`now` out of stock or order_by today or earlier -> `soon` within 3 days -> `plan` within 7 days, plus all market items due on the next trip -> `skip` more than 60 days of stock ("Don't buy yet", collapsed by default) -> `ok` everything else (hidden under "Not needed"). Sort order is literally now, soon, plan, skip, ok.

**One-line reasons** (templates in `_reason`): "You sell about {rate} a day and have {stock} left. {supplier} takes {lead} days. Order {qty} by {weekday}." / "Out of stock. You sell about {rate} a day. Order {qty} today." / adds "You may run out for about {n} days." (gap = days_until_order + lead - days_left, shown when at least 0.5 day) / "{qty} = {cartons} cartons of {size}." / "You have {days} days of stock. Don't buy yet." / market: "Buy {qty} at the market on {weekday}, about ₹{cost}." / low data: "Only {n} days of sales so far." / "{n} already ordered." when stock is on its way. The brief's own example (3 a day, 4 left, delivery 2 days) already leaves a gap of about a day and the app says so.

**Cost estimate** = qty x `cost_incl_tax` of the item's latest batch.

**Ordered tick:** `mark_ordered` saves qty and date (idempotent: ticking twice updates the same note). That quantity counts as incoming, so the item **leaves "Now"** and usually lands in "Not needed" (the UI says so). `undo_ordered` deletes the note. Adding stock via the normal Add more stock marks the note `received`.

**Market list** (`market_list`): items due on the next trip, plus ones already ticked **today** (so the list does not shrink after ticking); totals and bought count/cost. **Demo date** sets `today` for the Buy tab only.

### 7.4 Barcodes (optional)
- `items.barcode` is optional and **unique** (a unique index; NULLs never clash). Normalised: spaces removed, 3 to 40 characters of letters, digits and `- . _ /`.
- `GET /items/barcode/{code}?catalog=true|false` returns `{source: "shop", item}` (your item: name, price, stock) or `{source: "catalog", name}` (from Open Food Facts, only when `catalog=true`) or `{source: "none", catalog_error?}`.
- Open Food Facts (`barcode_service.lookup_catalog`): `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,brands,quantity`, timeout 8 s, only the barcode number is sent, name built as brand + name + size without repeating words. No prices exist there, so a new item's selling price is typed by the user. Names can be rough, so the name stays editable. No internet -> `catalog_error`, the user types the name.
- **Add screen:** Barcode box above the name (typed, camera Scan button, or USB/Bluetooth scanner which types digits + Enter). Shop barcode -> banner with name, price, stock and an **Add stock** button (opens the normal sheet); saving a duplicate is blocked. Catalog hit -> name filled only if the name box is empty (otherwise a "Use it" button). Miss/offline -> a note.
- **Sell screen:** Scan button, or digits typed into the search box + Enter, open the item straight into the sell panel (price still changeable). Only own items are looked up (`catalog=false`).
- **Edit details:** add, change or remove a barcode (sending `null` removes it).
- Camera uses `window.BarcodeDetector` (Chrome on Android; not most desktop browsers or iPhone Safari) and needs `https` or `localhost`. Without it the Scan sheet says so and offers a typed-number box. The camera path could not be tested on a real device during development; the typed and scanner paths were.

### 7.5 Batch numbers
- Every batch has a unique `batch_no`. Empty input -> automatic series `B-0001`, `B-0002`... (one more than the highest `B-` number in use; four digits, grows after 9999). A typed number (for example the supplier's lot) is kept if unused, else rejected with `Batch number "X" is already used.` and nothing is saved. Typed numbers in another style do not disturb the series.
- Shoes: one batch per size. Auto numbers continue the series; a typed number gets the size appended (`LOT7-8`, `LOT7-9`).
- "Same price as old" top-ups keep the existing batch and number.
- Shown on batch cards (item screen), in the sell bill ("B-0001 · bought 28 Oct · cost ₹180"), on today's sales lines, and in "Saved “X” as batch B-0005".
- Migration numbers existing batches in purchase order (`created_at`, then `id`). Direct `Batch(...)` rows created in tests may have `batch_no` NULL; the app always sets it.

---

## 8. API reference

Base URL `http://127.0.0.1:8000`. Errors: 400 for business rule problems (`{"detail": "plain message"}`), 404 not found, 422 for validation. Money fields are rupees (floats).

| Method and path | Purpose |
|---|---|
| `GET /` | health `{status: ok}` |
| `POST /seed`, `POST /seed/oil-scenario` | demo data (see section 4) |
| `POST /items` | create item with opening stock (`qty`, or `sizes[]` for shoes), optional `barcode`, `batch_no` |
| `GET /items` | all items (stock summary each) |
| `GET /items/{id}` | one item with `batches[]` |
| `PATCH /items/{id}` | edit name, `selling_price`, `tax_percent`, `custom_id`, `supplier_id`, `lead_time_override`, `carton_size`, `barcode`. **Never quantity** |
| `GET /items/names?q=` | name autocomplete |
| `GET /items/barcode/{code}?catalog=` | barcode lookup (7.4) |
| `POST /items/import-csv`, `GET /items/import-csv/template` | CSV import |
| `POST /items/{id}/add-stock` | body `qty, same_price, cost_price, selling_price, mrp, size, batch_no` |
| `POST /items/{id}/correct-stock` | body `qty_change, reason, size` |
| `POST /sales/preview` | same body as a sale, nothing saved: lines, totals, warning, `error`/`available` |
| `POST /sales` | body `item_id, qty, sell_price (optional), size, note` |
| `GET /sales?date=YYYY-MM-DD` | sales with lines, `total_amount`, `total_profit`, each line has `batch_no`, `returned_qty` |
| `POST /sales/lines/{id}/return` | body `qty` |
| `GET /reports?from=&to=` | totals and sales for a date range |
| `GET /suppliers`, `POST /suppliers`, `PATCH /suppliers/{id}` | suppliers (with `items_count`); lead 0 to 60 days, weekdays 0 to 6 |
| `GET /buy/suggestions?priority=&supplier_id=&market=&today=` | sorted suggestions |
| `GET /buy/summary?today=` | counts per priority plus `need_action` (= now + soon); the Buy tab badge uses `now` |
| `GET /buy/market-list?today=` | next market trip list |
| `POST /buy/{item_id}/ordered?today=` body `{qty}`; `POST /buy/{item_id}/undo` | the ordered tick |

Suggestion object fields: `item_id, name, unit, priority, qty, cartons, carton_size, order_by, order_by_weekday, days_left, rate, stock, on_hand, incoming, lead_days, supplier_id, supplier_name, assumed_lead, is_market, low_data, days_of_data, will_run_out_before_trip, run_out_days, cost_estimate, ordered_qty, ordered_at, reason`.

---

## 9. Frontend

### 9.1 Design system (the final theme: "off-white grey + standard blue")
Defined in `src/index.css` with Tailwind v4 `@theme`:

| Token | Value | Use |
|---|---|---|
| `ink-950` | `#0f1f2e` | navy: text, primary buttons, selected chips, batch tags |
| `ink-900/800/700/500/400/300/200/100` | `#1b2b3a #2a3d4f #3d5063 #5f7285 #8497a8 #b3c0cc #d9e1e8 #eaeff4` | text and border greys |
| `canvas` | `#f4f7fa` | app background (off-white grey) |
| `accent` | `#0b7fb0` | standard blue: focus rings, links, active nav, accent buttons |
| `accent-soft` | `#e5f2f9` | pale blue fills (active tab, info banners, avatars) |
| `cyan` | `#38bdf8` | rarely used highlight |
| orange | `#f28c28` (inline) | the short underline bar under every screen title |
| semantic | emerald (profit, success, SOLD button), rose (errors, "Order now"), amber (warnings, "Order soon") | |

- **Font:** Poppins everywhere; `--font-mono` is also mapped to Poppins, so `font-mono` classes just render Poppins with tabular numbers. Titles are extrabold and tight.
- **Header:** every screen starts with `TopBar`: a light card with a pale-blue glow (`.hero` class), a small blue uppercase eyebrow, the title with the orange underline, optional back button, optional right-side button, and children (stat tiles etc.).
- **Surfaces:** white cards `rounded-3xl ring-1 ring-ink-200/80`; inputs `min-h-[52px] rounded-2xl`; bottom sheets `rounded-t-[30px] bg-canvas` over a dimmed backdrop; page behind the 480px column is a soft blue-grey gradient with a shadow on the column.
- **Buttons** (`Button.jsx`): `primary` navy, `accent` blue, `success` emerald, `secondary` white with ring, `ghost`. 54px tall, one primary per screen.
- **Chips:** white with ring; selected = navy. **Banner tones:** info (pale blue), warn, error, success.
- **Bottom nav:** floating white pill, **5 tabs in this order: Add, Sell, Stock, Report, Buy**. Active tab has pale blue fill and blue text. The Buy tab shows a red badge with the count of "now" items. Default tab on load is **Add**.
- Earlier themes (a plain indigo one, then dark navy with violet and the Geist font) were **replaced on the owner's request**. Do not bring them back.

### 9.2 Components (`src/components/`)
`Avatar` (initials tile), `Banner`, `BarcodeField` (box + Scan button, opens `ScannerSheet`), `BottomNav`, `Button`, `Chip`, `EmptyState`, `Icon` (inline SVG paths, no library; names: plus minus cart box chart search back close upload download alert check tag shirt scale undo trend clipboard truck store chev barcode layers), `NumberField` (decimal keypad, optional ₹ prefix, Enter moves on), `PriorityTag`, `ScannerSheet`, `SearchField` (with `onSubmit` for scanners), `SectionLabel`, `Sheet` (bottom sheet), `SizeSelector`, `Spinner`, `Stat` (small white tile), `Stepper` (big minus/plus for days), `Switch`, `TextField`, `TopBar`, `WeekdayChips` (Mon..Sun, 0 = Monday).

### 9.3 Screens (`src/screens/`)
| File | What it does |
|---|---|
| `AddScreen` | Add tab (7.1, 7.4, 7.5). Sheets: `CsvImportSheet`, `AddStockSheet` |
| `SalesScreen` + `SellPanel` + `TodaySales` | Sell tab: header tiles (Sales, Profit, Bills today), search box + Scan button; the A-Z grouped list appears only after the search box is clicked (Close button hides it); picking an item opens `SellPanel` (quantity stepper, live split bill from `/sales/preview`, "Charge a different price", "Sell all N" when over-stock, green Sold button); success banner; "Today's sales" with Return per line ("Returned" tag when done) |
| `StockScreen` | Stock tab: tiles (Items, Value, Low/out where low is 5 or fewer), search, A-Z list with price ranges, Low/Out badges, empty state with demo data button |
| `ItemScreen` | item detail: big quantity, tiles (Price now, Value, Tax), **Delivery row** ("Delivery: 2 days (from Sharma Traders)  Change"), batch cards (batch number tag, "Selling now" on the oldest, progress bar, margin per unit), buttons Add more stock, Edit details, Correct stock. Eyebrow shows type and barcode |
| `AddStockSheet` | quantity, live "3 in stock + 15 = 18", "Same price as old" switch (greyed old prices; tapping one switches it off), batch number box when off, banner explaining old stock keeps the old price. Accepts `initialQty` (market trip) |
| `CorrectStockSheet`, `EditItemSheet`, `DeliverySheet` | corrections; name/price/tax/code/barcode edit; supplier + delivery override + carton size |
| `ReportScreen` | month picker, big profit with margin chip, Sales and Stock value tiles, sales list, "Demo walkthrough" card (oil scenario) |
| `BuyScreen` + `BuyCard` | Buy tab (7.3): "What to buy", "N need action", chips All/Now/Soon/Plan/Market/Skip with counts, "Group by supplier" switch, cards (priority tag, reason, quantity with cartons, cost, tags Low data / Assumed delivery time / Will run out before the next trip, tick circle "Ordered"), collapsed "Don't buy yet" and "Not needed", empty state "All stocked up. Nothing to order today.", buttons Demo, Market trip, Suppliers |
| `SupplierScreen` + `SupplierForm` | supplier list; form: name, "Delivery takes" stepper, "Delivers on" weekday chips, Market switch with trip-day chips, "N items use this", note "One item is different? Open it and change its delivery time." |
| `MarketTripScreen` | "Market trip, Friday", estimated total, grouped list, big tick box per item, running "Bought 3 of 8, about ₹4,200", "Add to stock" after ticking (opens the normal sheet with the quantity filled in), offline behaviour below |
| `DemoSheet` | "Demo date" picker with Previous/Next day and "Use today's real date" |

### 9.4 State and storage
- No state library. `App.jsx` holds `tab`, `demoDate`, `badge`. Each screen loads its own data with `api.js` and local `useState`.
- `localStorage` keys: `bx_demo_date` (demo date, empty = real date), `bx_market_list` (last good market list), `bx_tick_queue` (ticks waiting to sync).
- `api.js`: one `send()` wrapper, friendly error text (FastAPI validation lists are joined), network failure throws an error with `offline = true`; market calls use a 6-second timeout (`AbortSignal.timeout`), barcode lookup 12 s. `today` is added as `?today=` only when a demo date is set.
- `format.js`: `money` (en-IN), `qty`, `shortDate`, `time` (treats stored timestamps as UTC by appending `Z`), `initials`. `buyFormat.js`: weekday names, priority labels/colours, date helpers. `itemTypes.js`: the Pieces/Sizes/Weight labels. `focusNext.js`: Enter moves to the next input.

### 9.5 Offline market list (no service worker)
Every successful `/buy/market-list` is saved to `localStorage`. If the request fails or takes more than 6 s, the saved list is shown with the banner **"Offline: showing your saved list. Ticks will sync later."**. Ticks go to a queue in `localStorage` (shown immediately), and are sent on the browser `online` event and whenever the screen opens with signal, in order. Sending twice is harmless (idempotent). A tick the server refuses is dropped. If a flush already failed for lack of signal, the second request is skipped.

---

## 10. Tests (`backend/tests`, 44 total)

| File | Count | Covers |
|---|---|---|
| `test_fifo.py` | 10 | the oil scenario (280/180/216/676/1824), lower new cost, price change without restock, restock after zero, same-price top-up goes to the **newest** batch (regression), return of one bottle, old stock at old price with split sale, preview and over-stock, price edit reprices shelf, CSV import errors |
| `test_purchase.py` | 16 | worked example (24), brief example gap of 1 day, out-of-stock first and rate ignores stock-out days, stock-out days not counted, zero-sales in-stock days count, new item low data and capped, no suggestion under 5 days, carton rounding (13->24, 5->12), two suppliers different order-by, item override, market order-by, run-out before next trip, skip at 90 days, ordered tick and received on add-stock, market list keeps ticked items, seed data tells the demo story |
| `test_barcode.py` | 9 | optional barcode, normalising, own-item lookup, uniqueness on create and edit, add/change/remove, catalog hit, no match / no internet, Sell lookup skips the catalog, catalog name building |
| `test_batch_numbers.py` | 9 | automatic series, same-price keeps batch, typed number kept and unique (nothing half-saved), normalising, typed styles do not disturb the series, series continues after highest, shoes per size, sale bills show batch, migration numbers old batches in purchase order |

Conventions: every test uses a fresh in-memory database; Problem 3 tests fix `TODAY = date(2026, 10, 28)` (a Wednesday) and build history with `services.sell(..., sold_at=...)`; tests never touch the internet (the public product list is replaced by a stand-in function).

---

## 11. Database upgrades (`migrate.py`)

`create_all` only creates **missing tables**, never missing columns. So `run_migrations(engine)` (called at startup and by `seed_p3.py`) adds columns with `ALTER TABLE ... ADD COLUMN` if absent: `batches.selling_price` (backfilled from the last sale price, else the item's price), `items.supplier_id`, `items.carton_size` (NOT NULL DEFAULT 1), `items.lead_time_override`, `items.barcode`, `batches.batch_no` (backfilled `B-0001...` in purchase order). Then it creates the unique indexes `ix_items_barcode` and `ix_batches_batch_no` (`ALTER` cannot add a UNIQUE column). Running it twice changes nothing. There is no migration framework; add new columns to `NEW_COLUMNS` and any backfill next to the others. Whenever a model gets a new column, **also** add it to `migrate.py` or older database files will break.

---

## 12. How work was verified (and how to do it safely)

1. `python -m pytest tests -q` and `npm run build`.
2. Real UI check against a **throwaway copy** of the database, never the owner's real one:
   - Copy `backend/businessx.db` to a scratch folder; start the backend **from that folder**: `uvicorn main:app --app-dir <repo>/backend --port 8010` (the database path is relative to the working directory).
   - Create `frontend/.env.verify` with `VITE_API_URL=http://127.0.0.1:8010` and add a temporary `frontend-verify` entry to `.claude/launch.json` running `npm run dev --prefix frontend -- --port 5180 --strictPort --mode verify`.
   - Drive the app in the browser, then stop both servers, delete `.env.verify`, the scratch copy and the temporary launch entry.
3. Plain-text checks (`get_page_text`, reading innerText) are more reliable than screenshots in the in-app browser (screenshots can clip or time out). To fill React inputs from a script, use the native value setter plus an `input` event; fast simulated typing interleaves characters.
4. Say honestly what could not be verified (the phone camera).

---

## 13. Gotchas and lessons (each of these cost time once)

- **SQLAlchemy `.order_by()` appends, it does not replace.** A same-price restock once landed on the *oldest* batch because a default ascending order was chained before a descending one. Fix: `_batches_query` has no ordering; callers use `_fifo_order` or `_newest_first`. A regression test exists.
- **`SessionLocal` has `autoflush=False`.** Pending objects are invisible to queries until `db.flush()`. Batch numbering therefore tracks `taken` numbers within one request, and the seed script flushes after each batch.
- **Validate before writing.** Create/add-stock compute and check batch numbers, barcodes and suppliers *before* adding rows, so a refused request leaves nothing half-saved.
- **Pydantic v2:** use `model_fields_set` to tell "not sent" from "sent as null". Validators are attached as `field_validator("x")(func)`.
- **SQLite:** `ALTER TABLE ADD COLUMN` cannot add UNIQUE or NOT NULL without a default; use separate indexes. Several NULLs are allowed in a unique column.
- **Dates:** stored timestamps are naive UTC; day bucketing uses the UTC date (a shop open about 8am to 10pm India time shares the UTC date). `SalesScreen` filters "today" with the UTC date while the Buy tab uses the local date for the demo picker. This is a known small inconsistency.
- **Float noise:** `_floor` and `_ceil` round to 6 decimals before flooring (3.0000000000000004 must not become 2 or 4).
- **Windows console:** printing `₹` in a script can raise a cp1252 error; scripts that print (like `seed_p3.py`) use ASCII only.
- **Tailwind v4** has no config file; add tokens in `src/index.css`.
- **`uvicorn --reload`** restarts on `.py` changes and migrations run at import, so editing models while the owner's server runs migrates their real database. Always make migrations safe and idempotent.
- **Open Food Facts** can take about 4 seconds on a cold first call (hence the 8 s timeout) and some names are rough or oddly encoded.
- **Ticked market items:** after ticking, an item leaves "Now" because the order counts as stock. This is intended; the UI explains it.

---

## 14. History: what was built, in order

1. **Backend foundation:** tables, FIFO services (create item, add stock, sell, return, correct stock, summary, report), the oil test, thin API routers, `/seed`.
2. **Frontend:** Add, Sell, Stock, Report screens, sheets, Demo button, README. A first indigo/slate theme.
3. **CSV import** (template, per-row error list).
4. **Bug found by testing the UI:** same-price restock hit the oldest batch (see gotchas). Fixed with a regression test.
5. **Per-batch selling price and split billing:** old stock at old price, a sale spanning batches shown as a split bill before confirming, over-stock message with "Sell all N", Sell tab A-Z list, plain type names (Pieces/Sizes/Weight), a dark/violet redesign, plus smaller fixes (UTC times, "Returned" tag, Enter key moving to the next field, Remove/Add back instead of typing a minus).
6. **Theme replaced** by the current off-white/grey + standard blue style after the owner's feedback, and the Sell list now opens only when the search box is clicked.
7. **Problem 3:** suppliers, carton sizes, rate and suggestions, Buy tab with badge, supplier screens, market trip with offline list and tick queue, demo date, `seed_p3.py`, 16 tests, and a rewritten **evaluator README**.
8. **Barcodes:** optional field, own-item lookup, public name lookup, Scan sheet, Sell-screen scanning, Edit-screen field, 9 tests.
9. **Batch numbers:** unique `batch_no`, automatic series, typed override, migration backfill, shown across screens, 9 tests.
10. **This memory file.**

---

## 15. Known gaps and ideas

Not implemented / limits
- Photo upload (the `photo_url` column exists, no UI).
- CSV import has no shoes, barcode or batch columns.
- "Delivers on" weekdays on a supplier are stored and shown but unused in the maths.
- Correct stock touches one batch only (does not span batches like a sale does).
- The Return button returns the whole remaining quantity of a line (API allows partial).
- Single user, no login, CORS is open to all origins, SQLite file only; only the market list works offline (not the other tabs).
- Camera barcode scanning untested on a physical phone.
- Calling `/seed/oil-scenario` repeatedly creates duplicate items; `/seed` likewise.
- Lint: 7 harmless warnings.

Ideas listed in the README's "What I'd do next"
- Learn each supplier's real delivery time from ordered-to-received; weekend and festival spikes; supplier minimum order values; voice or chat assistant; push notifications; shared product list with MRP so a price can be suggested for new barcodes; supplier-bill photos to fill a restock; offline sync across phones; weighted-average option for loose items.

---

## 16. Keeping this file up to date

When you change the project, update the matching section here **in the same piece of work**:

- New or changed table/column -> section 6 and section 11 (`migrate.py`).
- New or changed endpoint -> section 8, and the README API table.
- New screen, component or colour -> section 9.
- New rule, constant or formula -> section 7.
- New tests -> section 10 (update the counts) and the README test count.
- New lesson or trap -> section 13. New milestone -> section 14.
- Change the "Last updated" date and the state line at the top.
- Update `README.md` for the evaluator, with **no mention of how it was built**, and leave its "Where the AI was wrong and how I caught it" section empty.

## Deployment (added)
- `Dockerfile` (node build stage, then python:3.13-slim), `.dockerignore`, `render.yaml` at the repo root.
- `backend/main.py` serves `frontend/dist` at `/` when it exists, else `{"status":"ok"}`; `/health` for host checks; `SEED_DEMO=1` seeds the sample shop if the DB has no items.
- `backend/database.py` reads `DATABASE_PATH` (default `businessx.db`).
- `frontend/.env.production` sets an empty `VITE_API_URL` so the built app calls the same origin; `api.js` uses `??` so empty means same origin.
- Free hosts have ephemeral disks: data resets on restart unless a disk is attached.
- Split deploy option: frontend on Vercel (root directory `frontend`, env `VITE_API_URL` = the Render backend URL, no trailing slash), backend on Render via the Dockerfile. Vercel cannot host the backend because SQLite needs a persistent disk.
