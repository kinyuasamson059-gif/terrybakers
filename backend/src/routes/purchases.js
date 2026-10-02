const express = require('express');
const router = express.Router();
const purchaseService = require('../services/purchaseService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, supplierId, limit, offset } = req.query;
        const result = purchaseService.getAllPurchases({
            search,
            startDate,
            endDate,
            supplierId,
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
        const purchase = purchaseService.getPurchaseById(req.params.id);
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        res.json(purchase);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'INVENTORY'), (req, res) => {
    try {
        const purchase = purchaseService.createPurchase(req.body, req.user.id, req.user.username);
        res.status(201).json(purchase);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
