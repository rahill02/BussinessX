# BusinessX demo

A mobile-first web demo of BusinessX, an app small shopkeepers use to track stock, sales and profit.
It shows three improvements:

1. **Add items fast.** A shop with 400 items can be entered in under an hour instead of over 13.
2. **Profit that stays true when the buying price changes.** Stock is tracked in batches and sold first in, first out (FIFO).
3. **What to buy, how much, and by when.** Plain suggestions with a one-line reason, including a market-trip list that works with poor signal.

Stack: Python 3, FastAPI, SQLAlchemy, SQLite (one file) on the backend; React, Vite and Tailwind on the frontend. No other libraries, no machine learning.

---

## Run it

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate                 # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`. The database file `businessx.db` is created next to `main.py`.
Older database files are upgraded automatically on start (new columns are added, existing data is kept).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Start the backend first.

### Tests

```bash
cd backend
python -m pytest tests -v
```

44 tests: FIFO and pricing (`test_fifo.py`), the buying logic (`test_purchase.py`), the barcode rules (`test_barcode.py`) and batch numbering (`test_batch_numbers.py`). None of them needs the internet; the public product list is replaced by a stand-in.

### Sample data

| What | How |
|---|---|
| 6 quick items | Stock tab, empty state, "Load 6 demo items" |
| Sunil's oil walkthrough (₹676 profit, ₹1,824 stock value) | Report tab, "Load Sunil's oil demo" |
| **Problem 3 shop: 11 items, 3 suppliers, 60 days of sales** | `python seed_p3.py` in the `backend` folder (add `--reset` to wipe everything first) |

The Problem 3 history ends on **28 Oct 2026**. In the app open **Buy, Demo** and set the demo date to 28 Oct 2026 (skip this if that is already today).

---

## Problem 1: adding items takes too long

| Feature | Where |
|---|---|
| Three item forms with plain names: **Pieces** (packs, bottles), **Sizes** (shoes, clothes: a quantity per size), **Weight** (kg, g, litre, decimal stock, no MRP) | Add tab |
| **Save & add next**: the next item opens with the same layout (type, unit, size columns) but empty values. A banner shows "Batch · Sizes, 3 added" with a Finish button | Add tab |
| Margin chips under the cost price: **+20%** and **+30%** fill the selling price | Add tab |
| Name suggestions from your own items, to copy and edit ("Fortune Oil 1L" then "Fortune Oil 500ml") | Add tab |
| Number pad for every number field; Enter moves to the next field | Add tab |
| Optional tax, item code and MRP. Warnings (never blocks) for selling below cost, selling above MRP, and duplicate names | Add tab |
| CSV import: template download, upload, every row checked, a plain error list per row. Valid rows are still saved | Add tab, Import |

CSV import covers Pieces and Weight items. Sizes items need a quantity per size, which does not fit a flat row, so they are added on the Add tab.
Photo upload is not wired up (the field exists on the model).

### Barcodes (optional)

Many shop items have a barcode, but not all of them (loose goods, local brands), so a barcode is always optional. An item without one works exactly as before.

**Ways to enter a barcode** (the same box everywhere): the **Scan** button (phone camera), typing the number, or a USB/Bluetooth barcode scanner, which simply types the number and presses Enter.

**On the Add tab**, the Barcode box sits above the item name. After a barcode is entered:

| The barcode is... | What happens |
|---|---|
| Already on one of your items | A banner shows its name, selling price and stock, with an **Add stock** button that opens the normal Add more stock sheet. Saving a second item with the same barcode is blocked. |
| New, and the public product list knows it | The **name is filled in for you** (only if the name box is still empty; otherwise a "Use it" button is offered). You can edit it. |
| New, and not listed (or there is no internet) | A short note says so. Type the name yourself; the barcode is saved with the item, so the next scan finds it. |

The public list is [Open Food Facts](https://world.openfoodfacts.org). Only the barcode number is sent to it. It has product names but no prices, so for a new item you still type the selling price. A selling price comes back automatically for items already in your shop.

**On the Sell tab**, the Scan button (or a scanner typing into the search box) opens the item straight into the sell panel with its selling price filled in. The price can still be changed with "Charge a different price". Only your own items are looked up here, so selling never waits on the internet.

**On Edit details**, a barcode can be added, changed or removed. One barcode belongs to one item (enforced by a unique index), so a scan can never be ambiguous.

Camera scanning uses the browser's built-in `BarcodeDetector`, so no extra library is needed. It is available in Chrome on Android; on browsers without it (most desktop browsers, Safari on iPhone) the Scan sheet says so and offers the typed-number and scanner routes instead. Browsers only allow the camera on `https` pages or `localhost`.

---

## Problem 2: restocking at a new price

### What "correct" means

> profit earned + stock value at cost = cash in − cash out, for any period.

That only holds when every sale is costed against the batch it actually came from, and that cost is frozen at the moment of sale. One "current cost" on the item cannot do this: restocking at a new price silently re-costs old sales.

### Method: batches and FIFO

- Every purchase creates a **batch**: quantity bought and left, cost (tax included), MRP, its own selling price, date.
- A sale takes from the **oldest batch first**. If it spans two batches it is split into two sale lines.
- Each sale line saves its cost and profit at that moment, so old reports never change.
- A return goes back into the batch the sale came from, and that line's profit is reversed.
- **Add more stock** is its own action. "Same price as old" (default on) adds to the latest batch with the cost fields locked. Off creates a new batch with a new cost, selling price and MRP. Tapping a locked price field switches the toggle off so you can type the new price.

### Batch numbers

Every batch has a **unique batch number**, the way lots are tracked in online shops, so any sale can be traced back to the purchase it came from.

- **Automatic:** if you leave the box empty, the batch is numbered in a running series: `B-0001`, `B-0002`, `B-0003`... The next number is one more than the highest `B-` number in use, so numbers are never reused.
- **Typed by you:** the optional **Batch number** box (Add tab, under "Tax, item code and batch number", and in Add more stock when "Same price as old" is off) takes your own number, for example the supplier's lot number. It must be unique; a duplicate is refused with a plain message and nothing is saved.
- **Shoes and clothes** make one batch per size. Automatic numbers are simply the next ones in the series; a number you type gets the size added (`LOT7` becomes `LOT7-8` and `LOT7-9`) so each batch stays unique.
- **"Same price as old"** tops up an existing batch, so it keeps its number and no new number is made. The sheet says which batch it adds to.
- **Where you see it:** a tag on each batch card on the item screen, in the sell bill ("B-0001 · bought 28 Oct · cost ₹180", so you can see which batch each part of a sale comes from), on today's sales lines, and in the "Saved as batch B-0005" message after adding an item.
- **Existing data:** batches that were already in your database are numbered `B-0001`... in the order they were bought, the first time the new version starts. Uniqueness is enforced by the database itself, not only by the screens.
- Quantity is read-only on the Edit screen. Stock changes only through Add stock, Sell, Return or Correct stock. Corrections are logged as adjustments, never as sales.

### Selling price follows the batch

Old stock sells at its old price until it runs out, then the new price takes over. A sale that needs more than the oldest batch holds is split into one line per batch, each at its own price. The Sell screen shows this bill before you tap Sold. Selling more than you have says "Not enough stock. Only 17 left." and offers "Sell all 17".

### Why FIFO and not weighted average

Sunil's oil: 20 bottles at ₹140, sell 14 at ₹160, restock 24 at ₹152, sell 18 at ₹170.

| Method | Profit | Stock value (12 left) |
|---|---|---|
| FIFO (this demo) | ₹676 | ₹1,824 |
| Weighted average | ₹647.20 | ₹1,795.20 |

Both keep the identity above true in total. With weighted average, a restock re-costs stock already on the shelf, so profit you read last week can change, and "what did I earn on that sale?" can no longer be answered. FIFO also matches how oil, rice and medicine physically leave the shelf.

---

## Problem 3: what to buy, how much, and by when

Sunil guesses his weekly reorder, so fast sellers run out and slow sellers tie up cash. His supplier delivers 2 days after an order and sometimes sells only full cartons. Twice a week he goes to the wholesale market, where mobile signal is poor.

The **Buy** tab answers three questions per item, each with a one-line reason:

> You sell about 3.1 a day and have 13 left. Sharma Traders takes 2 days. Order 24 by Thursday. 24 = 2 cartons of 12.

### Why the sales rate ignores stock-out days

A day with zero sales because the shelf was empty says nothing about demand. If it counted, an item that sells 6 a day and was out of stock for 5 days would look like it sells 4.9 a day, so the app would order too little, and it would run out again.

- The rate looks at the last 28 days and counts **only days the item was in stock** (stock at the start of the day above 0).
- A day with zero sales **while stock was on the shelf is real zero demand** and does count.
- Stock for each past day is rebuilt from the records: batches, sales, returns and corrections.

```
avg28 = units sold on in-stock days / number of those days      (last 28 days)
avg7  = the same, for the last 7 days
rate  = 0.7 * avg28 + 0.3 * avg7
```

Confidence: fewer than 21 in-stock days is **Low data** (a tag is shown, and the quantity is capped at one carton or 7 days of cover, whichever is larger). Fewer than 5 gives no suggestion yet.

### The formulas

Stock means on hand **plus** ordered but not yet received.

```
lead            = item's own delivery time, else supplier's, else 2 days ("assumed")
buffer_units    = rate * BUFFER_DAYS
reorder_point   = rate * lead + buffer_units
days_left       = stock / rate
days_until_order= max(0, floor((stock - reorder_point) / rate))
order_by        = today + days_until_order
order_up_to     = rate * (lead + COVER_DAYS) + buffer_units
stock_at_order  = max(0, stock - rate * days_until_order)
qty             = ceil((order_up_to - stock_at_order) / carton_size) * carton_size
```

**Worked example:** rate 3, stock 20, lead 2, carton 12.

| Step | Value |
|---|---|
| Reorder point | 3 × 2 + 3 = 9 |
| Order up to | 3 × (2 + 7) + 3 = 30 |
| Days until order | floor((20 − 9) / 3) = 3, so order by day 3 |
| Stock at that point | 20 − 3 × 3 = 11 |
| Needed | 30 − 11 = 19 |
| Order | 2 cartons of 12 = **24** |

Carton rounding: a need of 13 with cartons of 12 gives 24, a need of 5 gives 12.

**Market items** (the supplier is marked Market): you carry the goods home, so delivery is 0 days. The order-by date is the last market trip on or before (run-out date − buffer). If even the next trip is after the run-out date the card says **"Will run out before the next trip"** and the advice is to buy on the next trip. The quantity covers the days to that trip plus the days until the trip after it.

All constants (`BUFFER_DAYS=1`, `COVER_DAYS=7`, `SKIP_DAYS=60`, `SOON_DAYS=3`, `PLAN_DAYS=7`, `DEFAULT_LEAD_DAYS=2`, and the 28/7/21/5-day windows) sit together at the top of `backend/purchase_service.py`.

### A gap the brief's own example already has

The example in the brief (3 a day, 4 left, delivery takes 2 days, order by Thursday) hides a problem. Four bottles last 1.3 days, and delivery takes 2 days even if you order today, so the shelf is empty for about a day. The app shows this instead of hiding it: **"You may run out for about 1 day."** There is a test for it.

### The four priority levels

Every suggestion is sorted by priority, then order-by date, then days left.

| Level | Meaning | On screen |
|---|---|---|
| **Now** | Out of stock, or the order-by date is today or earlier | Red tag, at the top |
| **Soon** | Order-by within 3 days | Amber tag |
| **Plan** | Order-by within 7 days, plus every market item due on the next trip | Blue tag |
| **Skip** | More than 60 days of stock: "Don't buy yet" | Grey tag, collapsed by default |

Items that are fine (everything else) are hidden under "Not needed". Every tag is a word plus a colour, never colour alone.

### Ordered tick

The tick circle on a card saves the quantity and the date. That quantity counts as stock on its way, so the item leaves "Now". Ticking twice does not order twice. Adding stock for the item with the normal **Add more stock** action marks the order as received. The cost estimate is the quantity times the cost (tax included) of the item's latest batch.

### Market trip screen and the offline list

The market has poor signal, so this screen is built to work without it. There is no service worker; it uses the browser's `localStorage`.

- Every successful load of `/buy/market-list` is **saved on the phone**.
- If the request fails or takes longer than 6 seconds, the saved list is shown with the banner **"Offline: showing your saved list. Ticks will sync later."**
- Ticks are kept in a **queue in `localStorage`** and shown straight away. They are sent when the browser fires its `online` event (and whenever the screen opens with signal), in the order they were made.
- Sending twice is harmless, so a tick that reached the server just before the signal dropped is simply repeated.
- A tick that the server refuses for a real reason is dropped instead of blocking the queue.
- After ticking an item, **Add to stock** opens the normal Add more stock sheet with the bought quantity filled in.

### Demo date

**Buy, Demo** sets the date used by the Buy tab (with Previous day and Next day buttons) so you can show the list changing day by day. For a day in the past, stock is rebuilt from the records. For a day in the future, stock stays as it is now. All date logic takes a `today` argument, which is how the tests fix the date.

### Why no machine learning

- The data is small: a general store has weeks of history per item, not millions of rows.
- Every suggestion needs a plain one-line reason a shopkeeper can check against his own head. "You sell about 3 a day and have 4 left" can be checked. A model's score cannot.
- Every number can be traced to a formula above and changed with one constant. That is easy to explain, test and fix.

### Assumptions behind the sample data

- 60 days of history ending 28 Oct 2026, from a fixed random seed, so everyone gets the same data. Daily demand is a normal distribution around each item's average with a 30% spread; slow items use a coin flip per day.
- Items: Fortune Sunflower Oil 1L (about 3 a day, carton 12), Tata Salt 1kg (about 6 a day, carton 24, out of stock for the last 3 days), Dettol Handwash (new, about 14 in-stock days of history, no supplier), Parle-G (fast seller, supplier takes 4 days, carton 24), Rice Bran Oil 5L (slow, about 90 days of stock), Sugar and Vegetables in kg from a market supplier with trips on Tuesday and Friday, Camphor Tablets (6 in-stock days with no sales at all), Lux Soap (6 stock-out days that must be ignored), and two ordinary items.
- Sharma Traders delivers in 2 days, Gupta Wholesale in 4. The market supplier has delivery 0.
- A supplier you already created with the same name is kept as you set it up.

---

## Data model

- **Item**: name, type, unit, latest selling price, tax %, plus `supplier_id`, `carton_size` (default 1) and `lead_time_override`. No cost or quantity lives here.
- **Batch**: one row per purchase: a unique batch number, quantity bought and left, cost with tax, its own selling price, MRP, date.
- **Sale and SaleLine**: a sale can split across batches. Each line freezes its cost and profit at sale time.
- **ReturnLine** and **Adjustment**: a return puts quantity back on its batch and reverses profit. Corrections are logged separately from sales.
- **Supplier**: name, delivery days (default 2), delivery weekdays (shown only), market flag, market trip weekdays.
- **PurchaseOrderNote**: item, quantity, date, status `ordered` or `received`.

Money is stored as whole paise on the backend; the API and screens use rupees.

## API (Problems 1 and 3)

| Endpoint | Purpose |
|---|---|
| `GET /items/barcode/{code}?catalog=true` | Who owns this barcode: your own item (name, selling price, stock), a name from the public list, or nothing. `catalog=false` skips the public list |
| `POST /items`, `PATCH /items/{id}` | Both accept an optional `barcode` (spaces removed; a duplicate is refused; null on PATCH removes it) |
| `POST /items` and `POST /items/{id}/add-stock` | Accept an optional `batch_no` for the new batch. Empty means it is numbered automatically; a duplicate is refused. Batches in every response carry their `batch_no` |
| `GET /suppliers`, `POST /suppliers`, `PATCH /suppliers/{id}` | Suppliers (with how many items use each) |
| `PATCH /items/{id}` | Also accepts `supplier_id`, `carton_size`, `lead_time_override` (null clears a field) |
| `GET /buy/suggestions?priority=&supplier_id=&market=&today=` | Sorted suggestions |
| `GET /buy/summary?today=` | Count per priority (the red badge on the Buy tab is the "now" count) |
| `GET /buy/market-list?today=` | Shopping list for the next market trip |
| `POST /buy/{item_id}/ordered?today=` and `POST /buy/{item_id}/undo` | The ordered tick |

Inputs are validated (for example delivery days 0 to 60, carton size at least 1, weekdays 0 to 6, quantity above 0). Full docs are at `/docs`.

## Assumptions

- Days are counted using the stored (UTC) date. A shop open about 8am to 10pm India time sells on the same UTC date.
- The sales window is the 28 days **before** today, because today is not finished. Stock "now" includes today.
- A same-price top-up is added to the latest batch, so history rebuilds it on that batch's date. Totals are exact; only the day it appears can be earlier.
- A barcode is 3 to 40 letters, digits or `- . _ /`; spaces are removed, so `3017 6204 22003` and `3017620422003` are the same barcode.
- A batch number follows the same rules (1 to 40 characters, spaces removed). The automatic series starts at `B-0001` with four digits and simply grows after `B-9999`.
- Names from the public list can be rough (spelling, missing words), so the name is always editable. The lookup waits at most 8 seconds and never blocks adding the item.
- "N need action" on the Buy tab counts Now plus Soon.
- "Delivers on" weekdays on a supplier are stored and shown but do not change the maths, as the specification for the formulas only uses the number of days.
- When the low-data cap applies, the quantity is cut to whole cartons and never below one carton.
- A correction touches one batch (the oldest for a decrease, the newest for an increase).
- A Return button on a sale returns what is left on that line. The API accepts any quantity.

## What I'd do next

- Learn each supplier's real delivery time from the gap between "ordered" and "received".
- Weekend and festival spikes in the rate.
- Supplier minimum order values.
- Voice or chat assistant for entering quantities and asking "what should I buy?".
- Push notifications when an item reaches "Now".
- A fuller shared product list with MRP, so a selling price could be suggested for brand-new barcodes, and supplier bill photos to fill a whole restock.
- Offline sync across several phones for the sales screens, not only the market list.
- A weighted-average option for loose items such as rice sold from an open sack.

## Where the AI was wrong and how I caught it


## Deploying

The repository ships with a `Dockerfile` and `render.yaml`. The Docker image builds the React app and serves it from the same FastAPI process, so there is one URL and nothing to configure.

| Setting | Purpose |
|---|---|
| `PORT` | Set by the host. |
| `SEED_DEMO=1` | Set in the Dockerfile. Loads the sample shop (11 items, 60 days of sales) when the database is empty. |
| `DATABASE_PATH` | Optional. Point at a mounted disk to keep data across restarts. |

On a free host the disk is wiped on every restart, so data resets to the sample shop. Attach a persistent disk and set `DATABASE_PATH` to keep real data.
