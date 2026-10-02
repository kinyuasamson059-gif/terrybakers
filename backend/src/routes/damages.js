const express = require('express');
const router = express.Router();
const damagesService = require('../services/damagesService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, limit, offset } = req.query;
        const result = damagesService.getAllDamages({
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

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'INVENTORY'), (req, res) => {
    try {
        const damage = damagesService.createDamage(req.body, req.user.id, req.user.username);
        res.status(201).json(damage);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
