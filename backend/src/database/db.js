const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const BACKUP_DIR = path.resolve(__dirname, '../../data/backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const DB_PATH = path.resolve(DATA_DIR, 'terrybakers.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Initialize schema
const schemaPath = path.resolve(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

function ensureColumn(tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some(col => col.name === columnName);
    if (!exists) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

const inventoryTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'inventory_transactions'").get();
if (inventoryTableInfo && inventoryTableInfo.sql && !inventoryTableInfo.sql.includes("'PRODUCTION_USAGE'")) {
    db.exec(`
        ALTER TABLE inventory_transactions RENAME TO inventory_transactions_old;
        CREATE TABLE inventory_transactions (
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
        INSERT INTO inventory_transactions (
            id, transaction_number, date, item_type, item_id, transaction_type,
            quantity_change, unit_cost, total_value, batch_reference,
            reference_table, reference_id, notes, created_by, created_at
        )
        SELECT
            id, transaction_number, date, item_type, item_id, transaction_type,
            quantity_change, unit_cost, total_value, batch_reference,
            reference_table, reference_id, notes, created_by, created_at
        FROM inventory_transactions_old;
        DROP TABLE inventory_transactions_old;
    `);
}

ensureColumn('production_batches', 'recipe_id', 'INTEGER REFERENCES recipes(id)');
ensureColumn('production_batches', 'recipe_name', 'TEXT');
ensureColumn('production_batches', 'recipe_version', 'TEXT');
ensureColumn('ingredient_usage', 'recipe_id', 'INTEGER REFERENCES recipes(id)');
ensureColumn('ingredient_usage', 'recipe_version', 'TEXT');

const recipeTables = ['recipes', 'recipe_items'];
for (const tableName of recipeTables) {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
    if (!tableExists) {
        // Schema file is already expected to create these tables; keep this as a safe fallback for older DB files.
        db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT)`);
    }
}

module.exports = {
    db,
    DB_PATH,
    DATA_DIR,
    BACKUP_DIR,
    // Helper to run operations within an atomic SQLite transaction
    transaction: (fn) => db.transaction(fn),
};
