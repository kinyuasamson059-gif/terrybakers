const express = require('express');
const router = express.Router();
const returnsService = require('../services/returnsService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, customerId, limit, offset } = req.query;
        const result = returnsService.getAllReturns({
            search,
            startDate,
            endDate,
            customerId,
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'SALES', 'INVENTORY'), (req, res) => {
    try {
        const ret = returnsService.createReturn(req.body, req.user.id, req.user.username);
        res.status(201).json(ret);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
