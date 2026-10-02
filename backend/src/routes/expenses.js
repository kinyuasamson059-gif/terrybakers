const express = require('express');
const router = express.Router();
const expenseService = require('../services/expenseService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, category, startDate, endDate, limit, offset } = req.query;
        const result = expenseService.getAllExpenses({
            search,
            category,
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

router.get('/categories', authMiddleware, (req, res) => {
    try {
        const categories = expenseService.getExpenseCategories();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    try {
        const expense = expenseService.createExpense(req.body, req.user.id, req.user.username);
        res.status(201).json(expense);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
