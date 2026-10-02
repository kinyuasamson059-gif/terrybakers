const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../services/dashboardService');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        const data = getDashboardData({ period, startDate, endDate });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
