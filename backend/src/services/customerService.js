const { db, transaction } = require('../database/db');
const { logAction } = require('./auditService');

function getCustomerBalanceDetails(customerId) {
    const cust = db.prepare('SELECT opening_balance, credit_limit FROM customers WHERE id = ?').get(customerId);
    if (!cust) return null;

    // Total sales to this customer
    const salesRow = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total_sales, MAX(date) as last_sale_date
        FROM sales
        WHERE customer_id = ?
    `).get(customerId);

    // Total payments made by this customer
    const paymentsRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_payments, MAX(date) as last_payment_date
        FROM customer_payments
        WHERE customer_id = ?
    `).get(customerId);

    // Total returns credited
    const returnsRow = db.prepare(`
        SELECT COALESCE(SUM(total_return_value), 0) as total_returns, MAX(date) as last_return_date
        FROM sales_returns
        WHERE customer_id = ?
    `).get(customerId);

    const totalSales = salesRow ? salesRow.total_sales : 0;
    const totalPayments = paymentsRow ? paymentsRow.total_payments : 0;
    const totalReturns = returnsRow ? returnsRow.total_returns : 0;

    // Excel formula: Opening Balance + Total Sales - Payments (minus Returns if credited)
    const outstandingBalance = (cust.opening_balance || 0) + totalSales - totalPayments - totalReturns;

    // Calculate dates
    const dates = [salesRow?.last_sale_date, paymentsRow?.last_payment_date, returnsRow?.last_return_date].filter(Boolean);
    const lastTransactionDate = dates.length > 0 ? dates.sort().reverse()[0] : null;

    // Determine status matching Excel requirement:
    // IF(I>F, "OVER LIMIT", IF(I>0, "ACTIVE CREDIT", "CLEAR"))
    let status = 'CLEAR';
    if (cust.credit_limit > 0 && outstandingBalance > cust.credit_limit) {
        status = 'OVER LIMIT';
    } else if (outstandingBalance > 0.01) {
        status = 'ACTIVE CREDIT';
    }

    return {
        totalSales,
        totalPayments,
        totalReturns,
        outstandingBalance,
        lastTransactionDate,
        status
    };
}

function getAllCustomers({ search = '', status = '', activeOnly = false } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(name LIKE @search OR customer_code LIKE @search OR phone LIKE @search OR location LIKE @search)');
        params.search = `%${search}%`;
    }
    if (activeOnly) {
        where.push('active = 1');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const customers = db.prepare(`SELECT * FROM customers ${whereClause} ORDER BY name ASC`).all(params);

    const enriched = customers.map(c => {
        const details = getCustomerBalanceDetails(c.id);
        return {
            ...c,
            total_sales: details.totalSales,
            total_payments: details.totalPayments,
            total_returns: details.totalReturns,
            outstanding_balance: details.outstandingBalance,
            last_transaction_date: details.lastTransactionDate,
            account_status: details.status
        };
    });

    if (status) {
        return enriched.filter(c => c.account_status === status);
    }

    return enriched;
}

function getCustomerById(id) {
    const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    if (!customer) return null;

    const details = getCustomerBalanceDetails(id);
    return {
        ...customer,
        total_sales: details.totalSales,
        total_payments: details.totalPayments,
        total_returns: details.totalReturns,
        outstanding_balance: details.outstandingBalance,
        last_transaction_date: details.lastTransactionDate,
        account_status: details.status
    };
}

function createCustomer(data, userId, username) {
    return transaction(() => {
        let customerCode = data.customer_code;
        if (!customerCode) {
            const count = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
            customerCode = 'CUST-' + String(count + 1).padStart(3, '0');
        }

        const stmt = db.prepare(`
            INSERT INTO customers (
                customer_code, name, phone, location, opening_balance, credit_limit, notes, active, created_at, updated_at
            ) VALUES (
                @customer_code, @name, @phone, @location, @opening_balance, @credit_limit, @notes, @active,
                datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const info = stmt.run({
            customer_code: customerCode,
            name: data.name.trim(),
            phone: data.phone || '',
            location: data.location || '',
            opening_balance: Number(data.opening_balance) || 0,
            credit_limit: Number(data.credit_limit) || 0,
            notes: data.notes || '',
            active: data.active !== undefined ? (data.active ? 1 : 0) : 1
        });

        const newId = info.lastInsertRowid;

        logAction({
            userId,
            username,
            action: 'CUSTOMER_CREATED',
            tableName: 'customers',
            recordId: newId,
            newValues: data,
            details: `Created customer "${data.name}"`
        });

        return getCustomerById(newId);
    })();
}

function updateCustomer(id, data, userId, username) {
    return transaction(() => {
        const existing = getCustomerById(id);
        if (!existing) throw new Error('Customer not found');

        const stmt = db.prepare(`
            UPDATE customers SET
                name = COALESCE(@name, name),
                phone = COALESCE(@phone, phone),
                location = COALESCE(@location, location),
                opening_balance = COALESCE(@opening_balance, opening_balance),
                credit_limit = COALESCE(@credit_limit, credit_limit),
                notes = COALESCE(@notes, notes),
                active = COALESCE(@active, active),
                updated_at = datetime('now', 'localtime')
            WHERE id = @id
        `);

        stmt.run({
            id,
            name: data.name !== undefined ? data.name.trim() : existing.name,
            phone: data.phone !== undefined ? data.phone : existing.phone,
            location: data.location !== undefined ? data.location : existing.location,
            opening_balance: data.opening_balance !== undefined ? Number(data.opening_balance) : existing.opening_balance,
            credit_limit: data.credit_limit !== undefined ? Number(data.credit_limit) : existing.credit_limit,
            notes: data.notes !== undefined ? data.notes : existing.notes,
            active: data.active !== undefined ? (data.active ? 1 : 0) : existing.active
        });

        logAction({
            userId,
            username,
            action: 'CUSTOMER_UPDATED',
            tableName: 'customers',
            recordId: id,
            oldValues: existing,
            newValues: data,
            details: `Updated customer "${existing.name}"`
        });

        return getCustomerById(id);
    })();
}

// Full chronological statement with running balance
function getCustomerStatement(id, { startDate = '', endDate = '' } = {}) {
    const customer = getCustomerById(id);
    if (!customer) return null;

    // Fetch all sales, payments, and returns for this customer
    let salesQuery = `SELECT id, invoice_number as ref, date, 'INVOICE' as type, total_amount as debit, 0 as credit, notes FROM sales WHERE customer_id = ?`;
    let paymentsQuery = `SELECT id, payment_number as ref, date, 'PAYMENT' as type, 0 as debit, amount as credit, notes FROM customer_payments WHERE customer_id = ?`;
    let returnsQuery = `SELECT id, return_number as ref, date, 'RETURN' as type, 0 as debit, total_return_value as credit, notes FROM sales_returns WHERE customer_id = ?`;

    const sales = db.prepare(salesQuery).all(id);
    const payments = db.prepare(paymentsQuery).all(id);
    const returns = db.prepare(returnsQuery).all(id);

    // Merge and sort
    let allTransactions = [...sales, ...payments, ...returns].sort((a, b) => {
        if (a.date === b.date) return a.id - b.id;
        return a.date.localeCompare(b.date);
    });

    let runningBalance = customer.opening_balance;
    const history = [];

    // Add opening balance entry
    history.push({
        date: customer.created_at.split(' ')[0],
        type: 'OPENING_BALANCE',
        ref: 'OPENING',
        debit: customer.opening_balance >= 0 ? customer.opening_balance : 0,
        credit: customer.opening_balance < 0 ? Math.abs(customer.opening_balance) : 0,
        balance: runningBalance,
        notes: 'Initial Account Balance'
    });

    for (const tx of allTransactions) {
        runningBalance = runningBalance + tx.debit - tx.credit;
        history.push({
            ...tx,
            balance: runningBalance
        });
    }

    // Filter by date range if provided
    let filteredHistory = history;
    if (startDate) {
        filteredHistory = filteredHistory.filter(h => h.date >= startDate);
    }
    if (endDate) {
        filteredHistory = filteredHistory.filter(h => h.date <= endDate);
    }

    return {
        customer,
        statement: filteredHistory,
        currentBalance: runningBalance
    };
}

module.exports = {
    getCustomerBalanceDetails,
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    getCustomerStatement
};
