const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, startDate, endDate, customerId, paymentMethod, limit, offset } = req.query;
        const result = paymentService.getAllPayments({
            search,
            startDate,
            endDate,
            customerId,
            paymentMethod,
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'SALES'), (req, res) => {
    try {
        const payment = paymentService.createPayment(req.body, req.user.id, req.user.username);
        res.status(201).json(payment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
