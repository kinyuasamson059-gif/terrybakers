const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, category, activeOnly } = req.query;
        const products = productService.getAllProducts({
            search,
            category,
            activeOnly: activeOnly === 'true'
        });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const product = productService.getProductById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'SALES', 'PRODUCTION'), (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Product name is required' });
        }
        const created = productService.createProduct(req.body, req.user.id, req.user.username);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id', authMiddleware, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    try {
        const updated = productService.updateProduct(req.params.id, req.body, req.user.id, req.user.username);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/:id/toggle', authMiddleware, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    try {
        const toggled = productService.toggleProductActive(req.params.id, req.user.id, req.user.username);
        res.json(toggled);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
