-- Restaurant Management System — SQLite schema.
-- Applied by server/migrate.ts when the database is empty. Every connection
-- enables PRAGMA foreign_keys = ON (see server/db.ts and server/migrate.ts).
-- Money is stored as INTEGER minor units (paisa): 55000 = 550.00. Percentages
-- are stored as REAL percentages in the range 0..100. Ingredient stock,
-- low-stock thresholds, recipe quantities and stock-movement deltas are REAL
-- display-unit values (kg, litre or pcs) rounded to at most three decimals by
-- server/stock.ts; SQLite keeps the decimal API shape unchanged. All timestamps
-- are generated on the server at runtime; seed data uses relative day offsets,
-- never fixed dates.
--
-- INDEXES (all created at the end of this file unless noted as implicit)
--   implicit UNIQUE users.email                    - login lookup; no duplicate accounts
--   idx_users_role_active                          - staff lists filtered by role/status
--   implicit UNIQUE floors.name                    - unique floor/area names
--   idx_floors_sort_order                          - stable floor ordering on the table map
--   implicit UNIQUE tables(floor_id, number)       - a table number is unique within its floor
--   idx_tables_floor                               - all tables on one floor (FK lookup)
--   idx_tables_status                              - table map grouped by free/occupied/bill_pending
--   implicit UNIQUE menu_categories.name           - unique category names
--   idx_menu_categories_sort_order                 - stable menu category ordering
--   implicit UNIQUE menu_items(category_id, name)  - no duplicate item names in a category
--   idx_menu_items_category                        - menu items by category (FK lookup)
--   idx_menu_items_available                       - public/staff menu availability filter
--   idx_menu_items_prep_station                    - kitchen grouping by preparation station
--   implicit UNIQUE item_variants(item, name)      - no duplicate variant names per item
--   idx_item_variants_item                         - variants for one menu item (FK lookup)
--   implicit PK recipe_items(menu_item, ingredient)- one quantity per recipe line
--   idx_recipe_items_ingredient                    - reverse lookup: where an ingredient is used
--   idx_ingredients_stock_threshold                - low-stock alerts (stock <= threshold)
--   implicit UNIQUE ingredients.name               - unique ingredient names
--   implicit UNIQUE orders.order_number            - atomic order numbering; no duplicates
--   implicit UNIQUE orders.bill_number             - atomic bill numbering; no duplicates
--   idx_orders_table                               - open history for one table (FK lookup)
--   idx_orders_table_status                        - public order lookup and pending queue
--   idx_orders_opened_by                           - orders opened by a staff member (FK lookup)
--   idx_orders_status                              - kitchen/waiter queues by order status
--   idx_orders_created_at                          - recent orders and daily turnover reports
--   idx_order_items_order                          - all lines for one order (avoids N+1)
--   idx_order_items_menu_item                      - top-item reports (FK lookup)
--   idx_order_items_variant                        - variant popularity (FK lookup)
--   idx_order_items_status                         - kitchen display by item status
--   implicit UNIQUE payments.id                    - payment receipt identity
--   idx_payments_order                             - payments recorded for one order (FK lookup)
--   idx_stock_movements_ingredient                 - stock ledger by ingredient (FK lookup)
--   idx_stock_movements_order_item                 - one served deduction per order line
--   idx_stock_movements_created_by                 - manual adjustments by staff member
--   idx_bill_splits_order                          - split plan for one bill (FK lookup)
--   idx_order_item_events_item                     - per-item timer history (FK lookup)
--   idx_order_item_events_created                  - kitchen ticket ordering by event time
--   idx_table_transfers_order                      - transfer history for one order
--   idx_table_transfers_to_table                   - turnover by destination table
--   idx_daily_sales_sales_date (UNIQUE)            - one reporting snapshot per calendar day
--   implicit PK number_sequences.name              - atomic order/bill number counters
--   implicit PK schema_version.version             - idempotent migration tracking
-- Every foreign key declares an explicit ON DELETE rule. RESTRICT protects
-- financial history; CASCADE is used only for children owned by a parent row.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Atomic counters for order and bill numbers. Updated with UPDATE ... RETURNING
-- inside an IMMEDIATE transaction. A UNIQUE collision retries with a freshly
-- allocated value in a new transaction; gaps are possible but duplicates never are.
CREATE TABLE IF NOT EXISTS number_sequences (
  name TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value >= 0)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'waiter', 'kitchen', 'cashier')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  avatar TEXT,
  last_active TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per installation. No branch fields: multi-branch is out of scope.
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  restaurant_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  currency_symbol TEXT NOT NULL DEFAULT '৳',
  vat_percent REAL NOT NULL DEFAULT 0 CHECK (vat_percent >= 0 AND vat_percent <= 100),
  service_charge_percent REAL NOT NULL DEFAULT 0
    CHECK (service_charge_percent >= 0 AND service_charge_percent <= 100),
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  paper_size TEXT NOT NULL DEFAULT 'A4' CHECK (paper_size IN ('A4', '80mm')),
  receipt_footer TEXT NOT NULL DEFAULT '',
  low_stock_default REAL NOT NULL DEFAULT 0 CHECK (low_stock_default >= 0),
  -- When off (default), QR orders wait for waiter confirmation before the
  -- kitchen sees them. Managed in settings; never sent by a public request.
  auto_confirm_public_orders INTEGER NOT NULL DEFAULT 0
    CHECK (auto_confirm_public_orders IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- status and qr_secret_version are server-owned. No update endpoint may write
-- status directly; order and bill transitions maintain it.
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
  number TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2 CHECK (seats > 0),
  x INTEGER NOT NULL DEFAULT 0 CHECK (x >= 0),
  y INTEGER NOT NULL DEFAULT 0 CHECK (y >= 0),
  shape TEXT NOT NULL DEFAULT 'round' CHECK (shape IN ('round', 'square')),
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'occupied', 'bill_pending')),
  qr_secret_version INTEGER NOT NULL DEFAULT 1 CHECK (qr_secret_version > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (floor_id, number)
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#4F46E5',
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  prep_station TEXT NOT NULL DEFAULT 'kitchen'
    CHECK (prep_station IN ('kitchen', 'grill', 'beverage', 'dessert')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (category_id, name)
);

CREATE TABLE IF NOT EXISTS item_variants (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  UNIQUE (menu_item_id, name)
);

-- Stock is kept in the display unit and normalized to at most 3 decimals by
-- server/stock.ts before every write; the API still returns decimal numbers.
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'pcs',
  stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold REAL NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Recipes are per menu item (not per variant) in this phase. Quantity is the
-- per-item ingredient amount rounded to 3 decimals in server/stock.ts.
CREATE TABLE IF NOT EXISTS recipe_items (
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (menu_item_id, ingredient_id)
);

-- Financial history: bill_number and all money columns live on the order so
-- an invoice remains immutable. Deleting an order is RESTRICTED by payments.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  bill_number TEXT UNIQUE,
  table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'waiter' CHECK (source IN ('qr', 'waiter')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('pending_confirmation', 'new', 'preparing', 'ready', 'served', 'closed')),
  opened_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  guest_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  notes TEXT NOT NULL DEFAULT '',
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  vat_amount INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  service_charge INTEGER NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'void')),
  payment_method TEXT CHECK (payment_method IN ('Cash', 'bKash', 'Nagad', 'Card')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  closed_at TEXT,
  paid_at TEXT,
  CHECK ((source = 'qr' AND opened_by IS NULL) OR (source = 'waiter' AND opened_by IS NOT NULL))
);

-- Order lines are owned by the order and cascade only with it. Historical
-- menu items/variants are RESTRICTED so snapshots always have a source row.
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  variant_id TEXT REFERENCES item_variants(id) ON DELETE RESTRICT,
  name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'preparing', 'ready', 'served', 'cancelled')),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  served_at TEXT,
  cancel_reason TEXT
);

-- Payment method is a recorded selection only; no gateway data is stored.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('Cash', 'bKash', 'Nagad', 'Card')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL DEFAULT '',
  recorded_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per automatic deduction (order_item_id + 'served') or manual change.
-- The signed quantity delta is rounded to 3 decimals in server/stock.ts.
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('served', 'manual', 'waste', 'correction')),
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (order_item_id, ingredient_id, reason)
);

-- Server-computed split plan. One row per split; payment records reference a split.
CREATE TABLE IF NOT EXISTS bill_splits (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT CHECK (method IN ('Cash', 'bKash', 'Nagad', 'Card')),
  reference TEXT NOT NULL DEFAULT '',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (order_id, label)
);

-- Every item status change is recorded for kitchen timers and audit.
CREATE TABLE IF NOT EXISTS order_item_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS table_transfers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  to_table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  moved_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS daily_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_date TEXT NOT NULL,
  day TEXT NOT NULL,
  date_label TEXT NOT NULL,
  sales INTEGER NOT NULL DEFAULT 0 CHECK (sales >= 0),
  orders INTEGER NOT NULL DEFAULT 0 CHECK (orders >= 0),
  vat INTEGER NOT NULL DEFAULT 0 CHECK (vat >= 0),
  service_charge INTEGER NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  profit INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_floors_sort_order ON floors(sort_order);
CREATE INDEX IF NOT EXISTS idx_tables_floor ON tables(floor_id);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort_order ON menu_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_items_prep_station ON menu_items(prep_station);
CREATE INDEX IF NOT EXISTS idx_item_variants_item ON item_variants(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON recipe_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_stock_threshold ON ingredients(stock, low_stock_threshold);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_opened_by ON orders(opened_by);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_item ON stock_movements(order_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by ON stock_movements(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_sales_date ON daily_sales(sales_date);
CREATE INDEX IF NOT EXISTS idx_bill_splits_order ON bill_splits(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_events_item ON order_item_events(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_events_created ON order_item_events(created_at);
CREATE INDEX IF NOT EXISTS idx_table_transfers_order ON table_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_table_transfers_to_table ON table_transfers(to_table_id);
