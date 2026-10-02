const { db, transaction } = require('../database/db');
const { recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

function getAllDamages({ search = '', startDate = '', endDate = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(d.damage_number LIKE @search OR p.name LIKE @search OR d.reason LIKE @search OR d.approved_by LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('d.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('d.date <= @endDate');
        params.endDate = endDate;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = db.prepare(`
        SELECT COUNT(*) as total 
        FROM damages d
        JOIN products p ON d.product_id = p.id
        ${whereClause}
    `).get(params).total;

    const query = db.prepare(`
        SELECT 
            d.*,
            p.name as product_name,
            p.unit as product_unit,
            u.full_name as created_by_name
        FROM damages d
        JOIN products p ON d.product_id = p.id
        LEFT JOIN users u ON d.created_by = u.id
        ${whereClause}
        ORDER BY d.date DESC, d.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const damages = query.all({ ...params, limit, offset });
    return { total, damages };
}

function createDamage(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];

        let productId = data.product_id;
        const pName = data.product_name || data.product;
        if (!productId && pName) {
            const pRow = db.prepare('SELECT id, cost_price FROM products WHERE LOWER(name) = LOWER(?)').get(pName.trim());
            if (pRow) {
                productId = pRow.id;
            } else {
                const countP = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
                const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                const pRes = db.prepare(`
                    INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_at, updated_at)
                    VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(pCode, pName.trim());
                productId = pRes.lastInsertRowid;
            }
        }

        if (!productId) throw new Error('Product is required');

        const qty = Number(data.quantity_damaged || data.quantity || data['Quantity Damaged']) || 0;
        if (qty <= 0) throw new Error('Quantity damaged must be greater than zero');

        const prod = db.prepare('SELECT name, cost_price FROM products WHERE id = ?').get(productId);
        const unitCost = data.unit_cost !== undefined ? Number(data.unit_cost) : (prod?.cost_price || 0);
        const damageValue = qty * unitCost;

        const dateStr = date.replace(/-/g, '');
        const count = db.prepare(`SELECT COUNT(*) as c FROM damages WHERE date = ?`).get(date).c;
        const damageNumber = `DMG-${dateStr}-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO damages (
                damage_number, date, product_id, quantity, unit_cost, damage_value,
                reason, department_worker, approved_by, notes, created_by, created_at, updated_at
            ) VALUES (
                @damageNumber, @date, @productId, @quantity, @unitCost, @damageValue,
                @reason, @departmentWorker, @approvedBy, @notes, @createdBy,
                datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const dInfo = stmt.run({
            damageNumber,
            date,
            productId,
            quantity: qty,
            unitCost,
            damageValue,
            reason: data.reason || '',
            departmentWorker: data.department_worker || data['Department/Worker'] || '',
            approvedBy: data.approved_by || data['Approved By'] || username || 'Manager',
            notes: data.notes || '',
            createdBy: userId || null
        });

        const damageId = dInfo.lastInsertRowid;

        // Inventory ledger reduction for finished product
        recordInventoryTransaction({
            date,
            itemType: 'PRODUCT',
            itemId: productId,
            transactionType: 'DAMAGE',
            quantityChange: -qty, // Negative: reduces stock
            unitCost,
            totalValue: damageValue,
            batchReference: damageNumber,
            referenceTable: 'damages',
            referenceId: damageId,
            notes: `Damaged: ${data.reason || 'Spoilage/Defect'} (Approved by: ${data.approved_by || username})`,
            createdBy: userId
        });

        logAction({
            userId,
            username,
            action: 'DAMAGE_RECORDED',
            tableName: 'damages',
            recordId: damageId,
            newValues: { damageNumber, date, productName: prod?.name, qty, damageValue },
            details: `Approved damage of ${qty} ${prod?.name} value ${damageValue}`
        });

        return db.prepare(`
            SELECT d.*, p.name as product_name
            FROM damages d
            JOIN products p ON d.product_id = p.id
            WHERE d.id = ?
        `).get(damageId);
    })();
}

module.exports = {
    getAllDamages,
    createDamage
};
