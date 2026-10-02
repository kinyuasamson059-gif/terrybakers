const express = require('express');
const router = express.Router();
const workerService = require('../services/workerService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const workers = workerService.getAllWorkers();
        res.json(workers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Worker name is required' });
        }
        const created = workerService.createWorker(req.body, req.user.id, req.user.username);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/performance', authMiddleware, (req, res) => {
    try {
        const { groupBy, startDate, endDate, workerId, productId } = req.query;
        const result = workerService.getWorkerPerformance({
            groupBy: groupBy || 'worker',
            startDate,
            endDate,
            workerId,
            productId
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/production', authMiddleware, requireRole('ADMIN', 'MANAGER', 'PRODUCTION'), (req, res) => {
    try {
        const record = workerService.recordWorkerProduction(req.body, req.user.id, req.user.username);
        res.status(201).json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
