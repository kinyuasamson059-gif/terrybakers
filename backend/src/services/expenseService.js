const { db, transaction } = require('../database/db');
const { logAction } = require('./auditService');

function getAllExpenses({ search = '', category = '', startDate = '', endDate = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(e.expense_number LIKE @search OR e.description LIKE @search OR e.reference LIKE @search)');
        params.search = `%${search}%`;
    }
    if (category) {
        where.push('e.category = @category');
        params.category = category;
    }
    if (startDate) {
        where.push('e.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('e.date <= @endDate');
        params.endDate = endDate;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = db.prepare(`SELECT COUNT(*) as total FROM expenses e ${whereClause}`).get(params).total;

    const query = db.prepare(`
        SELECT 
            e.*,
            u.full_name as created_by_name
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        ${whereClause}
        ORDER BY e.date DESC, e.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const expenses = query.all({ ...params, limit, offset });
    return { total, expenses };
}

function createExpense(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const amount = Number(data.amount);
        if (amount <= 0) throw new Error('Expense amount must be greater than zero');
        if (!data.description) throw new Error('Description is required');

        const dateStr = date.replace(/-/g, '');
        const count = db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE date = ?`).get(date).c;
        const expenseNumber = `EXP-${dateStr}-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO expenses (
                expense_number, date, category, description, amount, payment_method, reference, notes, created_by, created_at, updated_at
            ) VALUES (
                @expenseNumber, @date, @category, @description, @amount, @paymentMethod, @reference, @notes, @createdBy,
                datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const info = stmt.run({
            expenseNumber,
            date,
            category: data.category || 'General',
            description: data.description.trim(),
            amount,
            paymentMethod: data.payment_method || 'Cash',
            reference: data.reference || '',
            notes: data.notes || '',
            createdBy: userId || null
        });

        logAction({
            userId,
            username,
            action: 'EXPENSE_CREATED',
            tableName: 'expenses',
            recordId: info.lastInsertRowid,
            details: `Recorded expense ${expenseNumber}: ${data.description} (${amount})`
        });

        return db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    })();
}

function getExpenseCategories() {
    const rows = db.prepare(`SELECT DISTINCT category FROM expenses WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`).all();
    const defaults = ['Rent', 'Utilities & Electricity', 'Fuel & Gas', 'Transport', 'Salaries & Wages', 'Equipment Maintenance', 'Packaging Supplies', 'General / Other'];
    const existing = rows.map(r => r.category);
    return Array.from(new Set([...defaults, ...existing]));
}

module.exports = {
    getAllExpenses,
    createExpense,
    getExpenseCategories
};
