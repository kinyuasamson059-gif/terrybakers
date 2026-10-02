const { db, transaction } = require('../database/db');
const { recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

function getAllPurchases({ search = '', startDate = '', endDate = '', supplierId = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(p.purchase_number LIKE @search OR p.batch_reference LIKE @search OR p.supplier_name LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('p.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('p.date <= @endDate');
        params.endDate = endDate;
    }
    if (supplierId) {
        where.push('p.supplier_id = @supplierId');
        params.supplierId = supplierId;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const count = db.prepare(`SELECT COUNT(*) as total FROM purchases p ${whereClause}`).get(params).total;

    const query = db.prepare(`
        SELECT 
            p.*,
            u.full_name as created_by_name,
            COUNT(pi.id) as item_count
        FROM purchases p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.date DESC, p.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const purchases = query.all({ ...params, limit, offset });

    // Fetch items for each purchase
    const itemStmt = db.prepare(`
        SELECT pi.*, ing.name as ingredient_name
        FROM purchase_items pi
        JOIN ingredients ing ON pi.ingredient_id = ing.id
        WHERE pi.purchase_id = ?
    `);

    const enriched = purchases.map(p => ({
        ...p,
        items: itemStmt.all(p.id)
    }));

    return { total, purchases: enriched };
}

function getPurchaseById(id) {
    const purchase = db.prepare(`
        SELECT p.*, u.full_name as created_by_name
        FROM purchases p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
    `).get(id);

    if (!purchase) return null;

    const items = db.prepare(`
        SELECT pi.*, ing.name as ingredient_name
        FROM purchase_items pi
        JOIN ingredients ing ON pi.ingredient_id = ing.id
        WHERE pi.purchase_id = ?
    `).all(id);

    return {
        ...purchase,
        items
    };
}

// Create a purchase record with atomic inventory update and audit
function createPurchase(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const supplierName = data.supplier_name || (data.supplier ? data.supplier.trim() : null);
        const batchReference = data.batch_reference || data.batchReference || null;

        // Generate purchase number
        const dateStr = date.replace(/-/g, '');
        const count = db.prepare(`SELECT COUNT(*) as c FROM purchases WHERE date = ?`).get(date).c;
        const purchaseNumber = `PUR-${dateStr}-${String(count + 1).padStart(3, '0')}`;

        // Normalizing items array
        let items = data.items;
        if (!items || !Array.isArray(items) || items.length === 0) {
            // Support single entry format (e.g., from sheet: ingredient, unit, quantity, cost_per_unit)
            if (data.ingredient_id || data.ingredient_name) {
                let ingredientId = data.ingredient_id;
                if (!ingredientId && data.ingredient_name) {
                    const ing = db.prepare(`SELECT id, unit FROM ingredients WHERE LOWER(name) = LOWER(?)`).get(data.ingredient_name.trim());
                    if (ing) {
                        ingredientId = ing.id;
                    } else {
                        // Auto-create ingredient if not exists
                        const insertIng = db.prepare(`
                            INSERT INTO ingredients (ingredient_code, name, unit, min_stock_level, active, created_by, created_at, updated_at)
                            VALUES (?, ?, ?, 10, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                        `);
                        const ingCode = 'ING-' + String(db.prepare('SELECT COUNT(*) as c FROM ingredients').get().c + 1).padStart(3, '0');
                        const res = insertIng.run(ingCode, data.ingredient_name.trim(), data.unit || 'kg', userId);
                        ingredientId = res.lastInsertRowid;
                    }
                }

                const qty = Number(data.quantity || data.quantity_in) || 0;
                const costPerUnit = Number(data.cost_per_unit || data.cost_unit) || 0;
                items = [{
                    ingredient_id: ingredientId,
                    unit: data.unit || 'kg',
                    quantity: qty,
                    cost_per_unit: costPerUnit,
                    total_cost: qty * costPerUnit,
                    batch_reference: batchReference
                }];
            } else {
                throw new Error('No purchase items specified');
            }
        }

        // Calculate total purchase amount automatically: sum(Quantity * Cost per unit)
        let totalAmount = 0;
        const processedItems = items.map(item => {
            const qty = Number(item.quantity || item.quantity_in) || 0;
            const costPerUnit = Number(item.cost_per_unit || item.cost_unit) || 0;
            if (qty <= 0) throw new Error('Quantity must be greater than zero');
            if (costPerUnit < 0) throw new Error('Cost per unit cannot be negative');

            const itemTotal = qty * costPerUnit;
            totalAmount += itemTotal;

            return {
                ...item,
                quantity: qty,
                cost_per_unit: costPerUnit,
                total_cost: itemTotal,
                batch_reference: item.batch_reference || batchReference
            };
        });

        // Insert purchase header
        const insertPurchase = db.prepare(`
            INSERT INTO purchases (
                purchase_number, date, supplier_id, supplier_name, batch_reference,
                total_amount, payment_status, notes, created_by, created_at, updated_at
            ) VALUES (
                @purchaseNumber, @date, @supplierId, @supplierName, @batchReference,
                @totalAmount, @paymentStatus, @notes, @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const pInfo = insertPurchase.run({
            purchaseNumber,
            date,
            supplierId: data.supplier_id || null,
            supplierName,
            batchReference,
            totalAmount,
            paymentStatus: data.payment_status || 'PAID',
            notes: data.notes || '',
            createdBy: userId || null
        });

        const purchaseId = pInfo.lastInsertRowid;

        // Insert line items and inventory transactions
        const insertItem = db.prepare(`
            INSERT INTO purchase_items (
                purchase_id, ingredient_id, unit, quantity, cost_per_unit, total_cost, batch_reference, created_at
            ) VALUES (
                @purchaseId, @ingredientId, @unit, @quantity, @costPerUnit, @totalCost, @batchReference, datetime('now', 'localtime')
            )
        `);

        for (const item of processedItems) {
            insertItem.run({
                purchaseId,
                ingredientId: item.ingredient_id,
                unit: item.unit || 'kg',
                quantity: item.quantity,
                costPerUnit: item.cost_per_unit,
                totalCost: item.total_cost,
                batchReference: item.batch_reference
            });

            // Increase ingredient inventory in ledger
            recordInventoryTransaction({
                date,
                itemType: 'INGREDIENT',
                itemId: item.ingredient_id,
                transactionType: 'PURCHASE',
                quantityChange: item.quantity,
                unitCost: item.cost_per_unit,
                totalValue: item.total_cost,
                batchReference: item.batch_reference,
                referenceTable: 'purchases',
                referenceId: purchaseId,
                notes: `Purchased from ${supplierName || 'Supplier'} (Ref: ${purchaseNumber})`,
                createdBy: userId
            });
        }

        // Audit entry
        logAction({
            userId,
            username,
            action: 'PURCHASE_CREATED',
            tableName: 'purchases',
            recordId: purchaseId,
            newValues: { purchaseNumber, date, totalAmount, items: processedItems },
            details: `Created purchase ${purchaseNumber} for ${totalAmount}`
        });

        return getPurchaseById(purchaseId);
    })();
}

module.exports = {
    getAllPurchases,
    getPurchaseById,
    createPurchase
};
