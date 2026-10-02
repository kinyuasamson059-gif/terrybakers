const { db, transaction } = require('../database/db');
const { logAction } = require('./auditService');

function getAllWorkers() {
    return db.prepare('SELECT * FROM workers ORDER BY name ASC').all();
}

function createWorker(data, userId, username) {
    let workerCode = data.worker_code;
    if (!workerCode) {
        const count = db.prepare('SELECT COUNT(*) as c FROM workers').get().c;
        workerCode = 'WRK-' + String(count + 1).padStart(3, '0');
    }

    const stmt = db.prepare(`
        INSERT INTO workers (worker_code, name, phone, role, active, notes, created_at, updated_at)
        VALUES (@worker_code, @name, @phone, @role, @active, @notes, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    const info = stmt.run({
        worker_code: workerCode,
        name: data.name.trim(),
        phone: data.phone || '',
        role: data.role || 'Baker',
        active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
        notes: data.notes || ''
    });

    logAction({
        userId,
        username,
        action: 'WORKER_CREATED',
        tableName: 'workers',
        recordId: info.lastInsertRowid,
        details: `Created worker ${data.name}`
    });

    return db.prepare('SELECT * FROM workers WHERE id = ?').get(info.lastInsertRowid);
}

function recordWorkerProduction(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const workerName = (data.worker_name || data.worker || '').trim();
        let workerId = data.worker_id || null;

        if (workerName && !workerId) {
            const wRow = db.prepare('SELECT id FROM workers WHERE LOWER(name) = LOWER(?)').get(workerName);
            if (wRow) workerId = wRow.id;
            else {
                const countW = db.prepare('SELECT COUNT(*) as c FROM workers').get().c;
                const wCode = 'WRK-' + String(countW + 1).padStart(3, '0');
                const wRes = db.prepare(`
                    INSERT INTO workers (worker_code, name, role, active, created_at, updated_at)
                    VALUES (?, ?, 'Baker', 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(wCode, workerName);
                workerId = wRes.lastInsertRowid;
            }
        }

        let productId = data.product_id || null;
        let productName = (data.product_name || data.product || '').trim();
        if (productName && !productId) {
            const pRow = db.prepare('SELECT id, name FROM products WHERE LOWER(name) = LOWER(?)').get(productName);
            if (pRow) {
                productId = pRow.id;
                productName = pRow.name;
            } else {
                const countP = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
                const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                const pRes = db.prepare(`
                    INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_at, updated_at)
                    VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(pCode, productName);
                productId = pRes.lastInsertRowid;
            }
        }

        const qty = Number(data.quantity_produced || data['Quantity Produced']) || 0;
        const hours = Number(data.production_hours || data['Production Hours']) || 0;
        const kgPerHour = hours > 0 ? (qty / hours) : 0;
        const eightKgUnits = qty / 8; // Excel formula =D2/8

        const dateStr = date.replace(/-/g, '');
        const count = db.prepare(`SELECT COUNT(*) as c FROM worker_production WHERE date = ?`).get(date).c;
        const recordNumber = `WKP-${dateStr}-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO worker_production (
                record_number, date, worker_id, worker_name, product_id, product_name,
                quantity_produced, production_hours, kg_per_hour, eight_kg_units,
                batch_reference, notes, created_by, created_at, updated_at
            ) VALUES (
                @recordNumber, @date, @workerId, @workerName, @productId, @productName,
                @qty, @hours, @kgPerHour, @eightKgUnits,
                @batchReference, @notes, @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const info = stmt.run({
            recordNumber,
            date,
            workerId,
            workerName,
            productId,
            productName,
            qty,
            hours,
            kgPerHour,
            eightKgUnits,
            batchReference: data.batch_reference || data.batch || '',
            notes: data.notes || '',
            createdBy: userId || null
        });

        logAction({
            userId,
            username,
            action: 'WORKER_PRODUCTION_RECORDED',
            tableName: 'worker_production',
            recordId: info.lastInsertRowid,
            details: `Worker ${workerName} produced ${qty} ${productName} in ${hours} hrs`
        });

        return db.prepare('SELECT * FROM worker_production WHERE id = ?').get(info.lastInsertRowid);
    })();
}

// Display worker performance with aggregation by day, week, month, product, worker (Requirement 14)
function getWorkerPerformance({ groupBy = 'worker', startDate = '', endDate = '', workerId = '', productId = '' } = {}) {
    let where = [];
    let params = {};

    if (startDate) {
        where.push('wp.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('wp.date <= @endDate');
        params.endDate = endDate;
    }
    if (workerId) {
        where.push('wp.worker_id = @workerId');
        params.workerId = workerId;
    }
    if (productId) {
        where.push('wp.product_id = @productId');
        params.productId = productId;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Raw records
    const rawRecords = db.prepare(`
        SELECT wp.*, u.full_name as created_by_name
        FROM worker_production wp
        LEFT JOIN users u ON wp.created_by = u.id
        ${whereClause}
        ORDER BY wp.date DESC, wp.id DESC
    `).all(params);

    // Dynamic grouping
    let groupColumn = 'wp.worker_name';
    if (groupBy === 'day') groupColumn = 'wp.date';
    else if (groupBy === 'month') groupColumn = "strftime('%Y-%m', wp.date)";
    else if (groupBy === 'product') groupColumn = 'wp.product_name';
    else if (groupBy === 'week') groupColumn = "strftime('%Y-W%W', wp.date)";

    const aggregated = db.prepare(`
        SELECT 
            ${groupColumn} as group_key,
            COUNT(*) as shift_count,
            SUM(wp.quantity_produced) as total_produced,
            SUM(wp.production_hours) as total_hours,
            CASE 
                WHEN SUM(wp.production_hours) > 0 THEN SUM(wp.quantity_produced) / SUM(wp.production_hours)
                ELSE 0 
            END as avg_kg_per_hour,
            SUM(wp.eight_kg_units) as total_8kg_units
        FROM worker_production wp
        ${whereClause}
        GROUP BY ${groupColumn}
        ORDER BY total_produced DESC
    `).all(params);

    return {
        records: rawRecords,
        aggregated
    };
}

module.exports = {
    getAllWorkers,
    createWorker,
    recordWorkerProduction,
    getWorkerPerformance
};
