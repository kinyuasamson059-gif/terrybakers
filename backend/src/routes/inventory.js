const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { authMiddleware } = require('../middleware/auth');

router.get('/products', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const summary = inventoryService.getProductStockSummary({ startDate, endDate });
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ingredients', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const summary = inventoryService.getIngredientStockSummary({ startDate, endDate });
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/alerts', authMiddleware, (req, res) => {
    try {
        const alerts = inventoryService.getStockAlerts();
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ledger', authMiddleware, (req, res) => {
    try {
        const { itemType, itemId, transactionType, startDate, endDate, limit, offset } = req.query;
        const result = inventoryService.getInventoryLedger({
            itemType,
            itemId,
            transactionType,
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
