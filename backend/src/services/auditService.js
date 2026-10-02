const { db } = require('../database/db');

function logAction({ userId, username, action, tableName, recordId, oldValues = null, newValues = null, details = null, ipAddress = null }) {
    try {
        const stmt = db.prepare(`
            INSERT INTO audit_logs (timestamp, user_id, username, action, table_name, record_id, old_values, new_values, ip_address, details)
            VALUES (datetime('now', 'localtime'), @userId, @username, @action, @tableName, @recordId, @oldValues, @newValues, @ipAddress, @details)
        `);
        stmt.run({
            userId: userId || null,
            username: username || 'SYSTEM',
            action,
            tableName,
            recordId: recordId ? String(recordId) : null,
            oldValues: oldValues ? JSON.stringify(oldValues) : null,
            newValues: newValues ? JSON.stringify(newValues) : null,
            ipAddress: ipAddress || null,
            details: details || null
        });
    } catch (err) {
        console.error('Audit log error:', err);
    }
}

function getLogs({ search, action, tableName, startDate, endDate, limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(username LIKE @search OR action LIKE @search OR table_name LIKE @search OR details LIKE @search)');
        params.search = `%${search}%`;
    }
    if (action) {
        where.push('action = @action');
        params.action = action;
    }
    if (tableName) {
        where.push('table_name = @tableName');
        params.tableName = tableName;
    }
    if (startDate) {
        where.push('timestamp >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('timestamp <= @endDate');
        params.endDate = endDate;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`);
    const total = countStmt.get(params).total;

    const queryStmt = db.prepare(`
        SELECT * FROM audit_logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT @limit OFFSET @offset
    `);
    const logs = queryStmt.all({ ...params, limit, offset });

    return { total, logs };
}

module.exports = {
    logAction,
    getLogs
};
