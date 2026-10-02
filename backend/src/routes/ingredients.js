const express = require('express');
const router = express.Router();
const ingredientService = require('../services/ingredientService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { search, activeOnly } = req.query;
        const ingredients = ingredientService.getAllIngredients({
            search,
            activeOnly: activeOnly === 'true'
        });
        res.json(ingredients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const ingredient = ingredientService.getIngredientById(req.params.id);
        if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });
        res.json(ingredient);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'INVENTORY'), (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Ingredient name is required' });
        }
        const created = ingredientService.createIngredient(req.body, req.user.id, req.user.username);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id', authMiddleware, requireRole('ADMIN', 'MANAGER', 'INVENTORY'), (req, res) => {
    try {
        const updated = ingredientService.updateIngredient(req.params.id, req.body, req.user.id, req.user.username);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/:id/toggle', authMiddleware, requireRole('ADMIN', 'MANAGER', 'INVENTORY'), (req, res) => {
    try {
        const toggled = ingredientService.toggleIngredientActive(req.params.id, req.user.id, req.user.username);
        res.json(toggled);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
