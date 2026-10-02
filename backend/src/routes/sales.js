const express = require('express');
const router = express.Router();
const salesService = require('../services/salesService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, customerId, paymentStatus, limit, offset } = req.query;
        const result = salesService.getAllSales({
            search,
            startDate,
            endDate,
            customerId,
            paymentStatus,
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const sale = salesService.getSaleById(req.params.id);
        if (!sale) return res.status(404).json({ error: 'Sale record not found' });
        res.json(sale);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'SALES'), (req, res) => {
    try {
        const sale = salesService.createSale(req.body, req.user.id, req.user.username);
        res.status(201).json(sale);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
