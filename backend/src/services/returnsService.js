const { db, transaction } = require('../database/db');
const { recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

function getAllReturns({ search = '', startDate = '', endDate = '', customerId = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(sr.return_number LIKE @search OR sr.invoice_number LIKE @search OR sr.customer_name LIKE @search OR sr.reason LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('sr.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('sr.date <= @endDate');
        params.endDate = endDate;
    }
    if (customerId) {
        where.push('sr.customer_id = @customerId');
        params.customerId = customerId;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = db.prepare(`SELECT COUNT(*) as total FROM sales_returns sr ${whereClause}`).get(params).total;

    const query = db.prepare(`
        SELECT 
            sr.*,
            u.full_name as created_by_name
        FROM sales_returns sr
        LEFT JOIN users u ON sr.created_by = u.id
        ${whereClause}
        ORDER BY sr.date DESC, sr.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const returns = query.all({ ...params, limit, offset });

    const itemStmt = db.prepare(`
        SELECT sri.*, p.name as product_name, p.unit as product_unit
        FROM sales_return_items sri
        JOIN products p ON sri.product_id = p.id
        WHERE sri.return_id = ?
    `);

    return {
        total,
        returns: returns.map(r => ({
            ...r,
            items: itemStmt.all(r.id)
        }))
    };
}

function createReturn(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const invoiceNumber = (data.invoice_number || data['Invoice No.'] || '').trim() || null;
        const customerName = (data.customer_name || data.customer || '').trim() || null;
        let customerId = data.customer_id || null;

        if (customerName && !customerId) {
            const cRow = db.prepare('SELECT id FROM customers WHERE LOWER(name) = LOWER(?)').get(customerName);
            if (cRow) customerId = cRow.id;
        }

        // Support single item format (from spreadsheet: Product, Quantity Returned, Unit Cost, Reason)
        let items = data.items;
        if (!items || !Array.isArray(items) || items.length === 0) {
            if (data.product_id || data.product_name || data.product) {
                let prodId = data.product_id;
                const pName = data.product_name || data.product;
                if (!prodId && pName) {
                    const pRow = db.prepare('SELECT id, selling_price, cost_price FROM products WHERE LOWER(name) = LOWER(?)').get(pName.trim());
                    if (pRow) prodId = pRow.id;
                    else {
                        const countP = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
                        const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                        const pRes = db.prepare(`
                            INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_at, updated_at)
                            VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                        `).run(pCode, pName.trim());
                        prodId = pRes.lastInsertRowid;
                    }
                }

                const qty = Number(data.quantity_returned || data.quantity || data['Quantity Returned']) || 0;
                const unitCost = Number(data.unit_cost || data['Unit Cost']) || 0;

                items = [{
                    product_id: prodId,
                    quantity: qty,
                    unit_cost: unitCost,
                    reason: data.reason || ''
                }];
            } else {
                throw new Error('No items in return');
            }
        }

        let totalReturnValue = 0;
        const processedItems = items.map(item => {
            const qty = Number(item.quantity || item.quantity_returned) || 0;
            const unitCost = Number(item.unit_cost) || 0;
            if (qty <= 0) throw new Error('Return quantity must be greater than zero');
            const retVal = qty * unitCost;
            totalReturnValue += retVal;

            return {
                ...item,
                quantity: qty,
                unit_cost: unitCost,
                return_value: retVal
            };
        });

        const dateStr = date.replace(/-/g, '');
        const count = db.prepare(`SELECT COUNT(*) as c FROM sales_returns WHERE date = ?`).get(date).c;
        const returnNumber = `RET-${dateStr}-${String(count + 1).padStart(3, '0')}`;

        const insertRet = db.prepare(`
            INSERT INTO sales_returns (
                return_number, date, customer_id, customer_name, sale_id, invoice_number,
                total_return_value, reason, notes, created_by, created_at, updated_at
            ) VALUES (
                @returnNumber, @date, @customerId, @customerName, @saleId, @invoiceNumber,
                @totalReturnValue, @reason, @notes, @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const rInfo = insertRet.run({
            returnNumber,
            date,
            customerId,
            customerName,
            saleId: data.sale_id || null,
            invoiceNumber,
            totalReturnValue,
            reason: data.reason || (processedItems[0] ? processedItems[0].reason : ''),
            notes: data.notes || '',
            createdBy: userId || null
        });

        const returnId = rInfo.lastInsertRowid;

        const insertItem = db.prepare(`
            INSERT INTO sales_return_items (
                return_id, product_id, quantity, unit_cost, return_value, reason, created_at
            ) VALUES (
                @returnId, @productId, @quantity, @unitCost, @returnValue, @reason, datetime('now', 'localtime')
            )
        `);

        for (const item of processedItems) {
            insertItem.run({
                returnId,
                productId: item.product_id,
                quantity: item.quantity,
                unitCost: item.unit_cost,
                returnValue: item.return_value,
                reason: item.reason || ''
            });

            // Increase product inventory in ledger (returned item back in stock)
            recordInventoryTransaction({
                date,
                itemType: 'PRODUCT',
                itemId: item.product_id,
                transactionType: 'SALE_RETURN',
                quantityChange: item.quantity, // Positive: returns stock
                unitCost: item.unit_cost,
                totalValue: item.return_value,
                batchReference: invoiceNumber || returnNumber,
                referenceTable: 'sales_returns',
                referenceId: returnId,
                notes: `Return on ${returnNumber} (Inv: ${invoiceNumber || 'N/A'}) - ${item.reason || ''}`,
                createdBy: userId
            });
        }

        logAction({
            userId,
            username,
            action: 'RETURN_CREATED',
            tableName: 'sales_returns',
            recordId: returnId,
            newValues: { returnNumber, date, invoiceNumber, totalReturnValue },
            details: `Processed return ${returnNumber} value ${totalReturnValue}`
        });

        return db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(returnId);
    })();
}

module.exports = {
    getAllReturns,
    createReturn
};
