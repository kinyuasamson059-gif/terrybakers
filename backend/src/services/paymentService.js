const { db, transaction } = require('../database/db');
const { logAction } = require('./auditService');

function getAllPayments({ search = '', startDate = '', endDate = '', customerId = '', paymentMethod = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(cp.payment_number LIKE @search OR cp.reference LIKE @search OR c.name LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('cp.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('cp.date <= @endDate');
        params.endDate = endDate;
    }
    if (customerId) {
        where.push('cp.customer_id = @customerId');
        params.customerId = customerId;
    }
    if (paymentMethod) {
        where.push('cp.payment_method = @paymentMethod');
        params.paymentMethod = paymentMethod;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = db.prepare(`
        SELECT COUNT(*) as total 
        FROM customer_payments cp
        JOIN customers c ON cp.customer_id = c.id
        ${whereClause}
    `).get(params).total;

    const query = db.prepare(`
        SELECT 
            cp.*,
            c.name as customer_name,
            c.phone as customer_phone,
            u.full_name as created_by_name
        FROM customer_payments cp
        JOIN customers c ON cp.customer_id = c.id
        LEFT JOIN users u ON cp.created_by = u.id
        ${whereClause}
        ORDER BY cp.date DESC, cp.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const payments = query.all({ ...params, limit, offset });
    return { total, payments };
}

function createPayment(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const customerId = data.customer_id;
        const amount = Number(data.amount);

        if (!customerId) throw new Error('Customer is required');
        if (amount <= 0) throw new Error('Payment amount must be greater than zero');

        const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId);
        if (!customer) throw new Error('Customer not found');

        const dateStr = date.replace(/-/g, '');
        const count = db.prepare(`SELECT COUNT(*) as c FROM customer_payments WHERE date = ?`).get(date).c;
        const paymentNumber = `PAY-${dateStr}-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO customer_payments (
                payment_number, date, customer_id, amount, payment_method, reference, notes, created_by, created_at, updated_at
            ) VALUES (
                @paymentNumber, @date, @customerId, @amount, @paymentMethod, @reference, @notes, @createdBy,
                datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const pInfo = stmt.run({
            paymentNumber,
            date,
            customerId,
            amount,
            paymentMethod: data.payment_method || 'Cash',
            reference: data.reference || '',
            notes: data.notes || '',
            createdBy: userId || null
        });

        const paymentId = pInfo.lastInsertRowid;

        logAction({
            userId,
            username,
            action: 'PAYMENT_RECORDED',
            tableName: 'customer_payments',
            recordId: paymentId,
            newValues: { paymentNumber, customerName: customer.name, amount, paymentMethod: data.payment_method },
            details: `Received payment of ${amount} from ${customer.name}`
        });

        return db.prepare(`
            SELECT cp.*, c.name as customer_name
            FROM customer_payments cp
            JOIN customers c ON cp.customer_id = c.id
            WHERE cp.id = ?
        `).get(paymentId);
    })();
}

module.exports = {
    getAllPayments,
    createPayment
};
