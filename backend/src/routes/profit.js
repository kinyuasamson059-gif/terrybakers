const express = require('express');
const router = express.Router();
const { getDailyProfit } = require('../services/profitService');
const { authMiddleware } = require('../middleware/auth');

router.get('/daily', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const result = getDailyProfit({ startDate, endDate });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
