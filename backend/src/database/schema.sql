-- SQLite schema for Terry Bakers Bakery Production & Management System
PRAGMA foreign_keys = ON;

-- Users and Local Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'SALES', 'PRODUCTION', 'INVENTORY')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Products (Finished Cakes & Bakery Items)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT 'Cakes',
    unit TEXT NOT NULL DEFAULT 'pcs',
    selling_price REAL NOT NULL DEFAULT 0.0,
    cost_price REAL NOT NULL DEFAULT 0.0,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Ingredients (Raw materials & packaging)
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    min_stock_level REAL NOT NULL DEFAULT 10.0,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Recipe Management / BOM
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    name TEXT NOT NULL,
    yield_quantity REAL NOT NULL DEFAULT 1.0,
    yield_unit TEXT NOT NULL DEFAULT 'pcs',
    version INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    quantity_required REAL NOT NULL DEFAULT 0.0,
    unit TEXT NOT NULL,
    wastage_percentage REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Workers / Bakers
CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'Baker',
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    location TEXT,
    opening_balance REAL NOT NULL DEFAULT 0.0,
    credit_limit REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Purchases Header (Ingredients In)
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    supplier_name TEXT,
    batch_reference TEXT,
    total_amount REAL NOT NULL DEFAULT 0.0,
    payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK(payment_status IN ('PAID', 'PENDING', 'PARTIAL')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Purchases Line Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_per_unit REAL NOT NULL,
    total_cost REAL NOT NULL,
    batch_reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Production Batches
CREATE TABLE IF NOT EXISTS production_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    worker_id INTEGER REFERENCES workers(id),
    worker_name TEXT,
    production_hours REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    recipe_id INTEGER REFERENCES recipes(id),
    recipe_name TEXT,
    recipe_version TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Production Items (Cakes produced in batch)
CREATE TABLE IF NOT EXISTS production_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_produced REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Ingredient Usage (Ingredients consumed for production)
CREATE TABLE IF NOT EXISTS ingredient_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usage_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    batch_id INTEGER REFERENCES production_batches(id) ON DELETE SET NULL,
    batch_reference TEXT,
    product_id INTEGER REFERENCES products(id),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    recipe_id INTEGER REFERENCES recipes(id),
    recipe_version TEXT,
    unit TEXT NOT NULL,
    quantity_used REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    no_of_cakes REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sales Orders / Invoices
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT,
    total_amount REAL NOT NULL DEFAULT 0.0,
    payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK(payment_status IN ('PAID', 'CREDIT', 'PARTIAL')),
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    amount_paid REAL NOT NULL DEFAULT 0.0,
    reference TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sales Line Items
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    selling_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sales Returns
CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT,
    sale_id INTEGER REFERENCES sales(id),
    invoice_number TEXT,
    total_return_value REAL NOT NULL DEFAULT 0.0,
    reason TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sales Return Items
CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    return_value REAL NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Product Damages / Wastage
CREATE TABLE IF NOT EXISTS damages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    damage_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    damage_value REAL NOT NULL,
    reason TEXT,
    department_worker TEXT,
    approved_by TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Customer Payments (Receipts on account)
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'Bank', 'Card', 'Mobile Money', 'Other')),
    reference TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Business Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    reference TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Worker Production / Performance Records
CREATE TABLE IF NOT EXISTS worker_production (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    worker_id INTEGER REFERENCES workers(id),
    worker_name TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity_produced REAL NOT NULL,
    production_hours REAL NOT NULL,
    kg_per_hour REAL NOT NULL DEFAULT 0.0,
    eight_kg_units REAL NOT NULL DEFAULT 0.0,
    batch_reference TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Inventory Transaction Ledger (Source of truth for all stock movements)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('PRODUCT', 'INGREDIENT')),
    item_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN (
        'OPENING',
        'PURCHASE',
        'USAGE',
        'PRODUCTION_USAGE',
        'PRODUCTION',
        'SALE',
        'SALE_RETURN',
        'DAMAGE',
        'ADJUSTMENT'
    )),
    quantity_change REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    total_value REAL NOT NULL DEFAULT 0.0,
    batch_reference TEXT,
    reference_table TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    user_id INTEGER REFERENCES users(id),
    username TEXT NOT NULL DEFAULT 'SYSTEM',
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    details TEXT
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Helpful indices for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(item_type, item_id, date);
CREATE INDEX IF NOT EXISTS idx_inv_tx_date ON inventory_transactions(date);
CREATE INDEX IF NOT EXISTS idx_recipe_product ON recipes(product_id, active);
CREATE INDEX IF NOT EXISTS idx_recipe_item_ingredient ON recipe_items(ingredient_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_production_date ON production_batches(date);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_usage_date ON ingredient_usage(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_worker_prod_date ON worker_production(date);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
