const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, status, activeOnly } = req.query;
        const customers = customerService.getAllCustomers({
            search,
            status,
            activeOnly: activeOnly === 'true'
        });
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const customer = customerService.getCustomerById(req.params.id);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/statement', authMiddleware, (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const statement = customerService.getCustomerStatement(req.params.id, { startDate, endDate });
        if (!statement) return res.status(404).json({ error: 'Customer not found' });
        res.json(statement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'SALES'), (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        const created = customerService.createCustomer(req.body, req.user.id, req.user.username);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id', authMiddleware, requireRole('ADMIN', 'MANAGER', 'SALES'), (req, res) => {
    try {
        const updated = customerService.updateCustomer(req.params.id, req.body, req.user.id, req.user.username);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
