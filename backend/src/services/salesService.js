const { db, transaction } = require('../database/db');
const { getProductStock, recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

function getAllSales({ search = '', startDate = '', endDate = '', customerId = '', paymentStatus = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(s.invoice_number LIKE @search OR s.reference LIKE @search OR s.customer_name LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('s.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('s.date <= @endDate');
        params.endDate = endDate;
    }
    if (customerId) {
        where.push('s.customer_id = @customerId');
        params.customerId = customerId;
    }
    if (paymentStatus) {
        where.push('s.payment_status = @paymentStatus');
        params.paymentStatus = paymentStatus;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = db.prepare(`SELECT COUNT(*) as total FROM sales s ${whereClause}`).get(params).total;

    const query = db.prepare(`
        SELECT 
            s.*,
            c.phone as customer_phone,
            u.full_name as created_by_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.created_by = u.id
        ${whereClause}
        ORDER BY s.date DESC, s.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const sales = query.all({ ...params, limit, offset });

    const itemStmt = db.prepare(`
        SELECT si.*, p.name as product_name, p.unit as product_unit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    `);

    return {
        total,
        sales: sales.map(s => ({
            ...s,
            items: itemStmt.all(s.id)
        }))
    };
}

function getSaleById(id) {
    const sale = db.prepare(`
        SELECT s.*, c.phone as customer_phone, c.location as customer_location, u.full_name as created_by_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.id = ?
    `).get(id);

    if (!sale) return null;

    const items = db.prepare(`
        SELECT si.*, p.name as product_name, p.unit as product_unit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    `).all(id);

    return {
        ...sale,
        items
    };
}

// Create a sale transaction
function createSale(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const reference = data.reference || null;

        // Generate Invoice Number
        let invoiceNumber = data.invoice_number;
        if (!invoiceNumber) {
            const count = db.prepare(`SELECT COUNT(*) as c FROM sales WHERE date = ?`).get(date).c;
            invoiceNumber = `INV-${date.replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;
        }

        // Customer resolution
        let customerId = data.customer_id || null;
        let customerName = data.customer_name || (data.customer ? data.customer.trim() : null);

        if (customerName && !customerId) {
            const cRow = db.prepare(`SELECT id, name FROM customers WHERE LOWER(name) = LOWER(?)`).get(customerName);
            if (cRow) {
                customerId = cRow.id;
                customerName = cRow.name;
            } else {
                const countC = db.prepare(`SELECT COUNT(*) as c FROM customers`).get().c;
                const cCode = 'CUST-' + String(countC + 1).padStart(3, '0');
                const cRes = db.prepare(`
                    INSERT INTO customers (customer_code, name, phone, location, opening_balance, credit_limit, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 0, 0, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(cCode, customerName, data.customer_phone || '', data.customer_location || '');
                customerId = cRes.lastInsertRowid;
            }
        }

        // Items resolution
        let items = data.items;
        if (!items || !Array.isArray(items) || items.length === 0) {
            // Support single item format (e.g. from POS quick sale or spreadsheet)
            if (data.product_id || data.product_name || data.product) {
                let prodId = data.product_id;
                const pName = data.product_name || data.product;
                if (!prodId && pName) {
                    const pRow = db.prepare(`SELECT id, selling_price, cost_price FROM products WHERE LOWER(name) = LOWER(?)`).get(pName.trim());
                    if (pRow) {
                        prodId = pRow.id;
                    } else {
                        const countP = db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
                        const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                        const pRes = db.prepare(`
                            INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_by, created_at, updated_at)
                            VALUES (?, ?, 'Cakes', 'pcs', ?, 0, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                        `).run(pCode, pName.trim(), Number(data.selling_price || data.selling_price_cake || data['Selling Price/Cake']) || 0, userId);
                        prodId = pRes.lastInsertRowid;
                    }
                }

                const qty = Number(data.quantity || data.quantity_sold || data['Quantity Sold']) || 0;
                const price = Number(data.selling_price || data.selling_price_cake || data['Selling Price/Cake']) || 0;

                items = [{
                    product_id: prodId,
                    quantity: qty,
                    selling_price: price
                }];
            } else {
                throw new Error('No items in sale order');
            }
        }

        // Validate items, check stock, calculate sales amount
        let totalAmount = 0;
        const warnings = [];
        const processedItems = [];

        for (const item of items) {
            const qty = Number(item.quantity);
            const price = Number(item.selling_price);

            if (qty <= 0) throw new Error('Sale quantity must be greater than zero');
            if (price < 0) throw new Error('Selling price cannot be negative');

            const prod = db.prepare(`SELECT id, name, cost_price FROM products WHERE id = ?`).get(item.product_id);
            if (!prod) throw new Error(`Product #${item.product_id} not found`);

            const currentStock = getProductStock(prod.id);
            if (currentStock < qty) {
                const warnMsg = `Low/Insufficient finished product stock for "${prod.name}": Available ${currentStock}, Selling ${qty}`;
                warnings.push(warnMsg);
                if (data.prevent_negative_stock) {
                    throw new Error(warnMsg);
                }
            }

            const subtotal = qty * price;
            totalAmount += subtotal;

            processedItems.push({
                product_id: prod.id,
                product_name: prod.name,
                quantity: qty,
                selling_price: price,
                subtotal,
                unit_cost: prod.cost_price || 0
            });
        }

        const paymentStatus = data.payment_status || 'PAID';
        const paymentMethod = data.payment_method || 'Cash';
        const amountPaid = paymentStatus === 'PAID' ? totalAmount : (Number(data.amount_paid) || 0);

        // Insert sale header
        const insertSale = db.prepare(`
            INSERT INTO sales (
                invoice_number, date, customer_id, customer_name, total_amount,
                payment_status, payment_method, amount_paid, reference, notes,
                created_by, created_at, updated_at
            ) VALUES (
                @invoiceNumber, @date, @customerId, @customerName, @totalAmount,
                @paymentStatus, @paymentMethod, @amountPaid, @reference, @notes,
                @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const sInfo = insertSale.run({
            invoiceNumber,
            date,
            customerId,
            customerName,
            totalAmount,
            paymentStatus,
            paymentMethod,
            amountPaid,
            reference,
            notes: data.notes || '',
            createdBy: userId || null
        });

        const saleId = sInfo.lastInsertRowid;

        // Insert sale items and deduct finished product inventory
        const insertItem = db.prepare(`
            INSERT INTO sale_items (
                sale_id, product_id, quantity, selling_price, subtotal, unit_cost, created_at
            ) VALUES (
                @saleId, @productId, @quantity, @sellingPrice, @subtotal, @unitCost, datetime('now', 'localtime')
            )
        `);

        for (const item of processedItems) {
            insertItem.run({
                saleId,
                productId: item.product_id,
                quantity: item.quantity,
                sellingPrice: item.selling_price,
                subtotal: item.subtotal,
                unitCost: item.unit_cost
            });

            // Finished product inventory reduction
            recordInventoryTransaction({
                date,
                itemType: 'PRODUCT',
                itemId: item.product_id,
                transactionType: 'SALE',
                quantityChange: -item.quantity, // Negative: reduces finished product stock
                unitCost: item.unit_cost,
                totalValue: item.quantity * item.unit_cost,
                batchReference: reference || invoiceNumber,
                referenceTable: 'sales',
                referenceId: saleId,
                notes: `Sold on ${invoiceNumber} to ${customerName || 'Walk-in'}`,
                createdBy: userId
            });
        }

        // If paid or partial payment received from a customer, record payment receipt
        if (customerId && amountPaid > 0) {
            const payNum = `PAY-${date.replace(/-/g, '')}-${saleId}`;
            db.prepare(`
                INSERT INTO customer_payments (
                    payment_number, date, customer_id, amount, payment_method, reference, notes, created_by, created_at, updated_at
                ) VALUES (
                    @paymentNumber, @date, @customerId, @amount, @paymentMethod, @reference, @notes, @createdBy,
                    datetime('now', 'localtime'), datetime('now', 'localtime')
                )
            `).run({
                paymentNumber: payNum,
                date,
                customerId,
                amount: amountPaid,
                paymentMethod,
                reference: invoiceNumber,
                notes: `Payment for Invoice ${invoiceNumber}`,
                createdBy: userId || null
            });
        }

        // Audit log
        logAction({
            userId,
            username,
            action: 'SALE_CREATED',
            tableName: 'sales',
            recordId: saleId,
            newValues: { invoiceNumber, date, customerName, totalAmount, paymentStatus, warnings },
            details: `Completed sale ${invoiceNumber} for ${totalAmount}`
        });

        const createdSale = getSaleById(saleId);
        return {
            ...createdSale,
            warnings
        };
    })();
}

module.exports = {
    getAllSales,
    getSaleById,
    createSale
};
