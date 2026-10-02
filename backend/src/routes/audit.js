const express = require('express');
const router = express.Router();
const { getLogs } = require('../services/auditService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/logs', authMiddleware, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    try {
        const { search, action, tableName, startDate, endDate, limit, offset } = req.query;
        const result = getLogs({
            search,
            action,
            tableName,
            startDate,
            endDate,
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
