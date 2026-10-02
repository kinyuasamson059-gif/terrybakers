const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

router.get('/', authMiddleware, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json({ settings, details: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object is required' });
        }

        const updateStmt = db.prepare(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES (@key, @value, datetime('now', 'localtime'))
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now', 'localtime')
        `);

        for (const [key, value] of Object.entries(settings)) {
            updateStmt.run({ key, value: String(value) });
        }

        logAction({
            userId: req.user.id,
            username: req.user.username,
            action: 'SETTINGS_UPDATED',
            tableName: 'system_settings',
            newValues: settings,
            details: 'Updated system settings'
        });

        const rows = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
        const updated = {};
        rows.forEach(r => { updated[r.key] = r.value; });
        res.json({ settings: updated, details: rows });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
