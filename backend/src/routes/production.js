const express = require('express');
const router = express.Router();
const productionService = require('../services/productionService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, limit, offset } = req.query;
        const result = productionService.getAllBatches({
            search,
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

router.get('/usage', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, limit, offset } = req.query;
        const result = productionService.getAllIngredientUsage({
            search,
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

router.post('/usage', authMiddleware, requireRole('ADMIN', 'MANAGER', 'PRODUCTION'), (req, res) => {
    try {
        const result = productionService.createIngredientUsage(req.body, req.user.id, req.user.username);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const batch = productionService.getBatchById(req.params.id);
        if (!batch) return res.status(404).json({ error: 'Production batch not found' });
        res.json(batch);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'PRODUCTION'), (req, res) => {
    try {
        const batch = productionService.createProduction(req.body, req.user.id, req.user.username);
        res.status(201).json(batch);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
