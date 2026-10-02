const express = require('express');
const router = express.Router();
const recipeService = require('../services/recipeService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
    try {
        const { productId, search, activeOnly } = req.query;
        const recipes = recipeService.getRecipes({
            productId,
            search,
            activeOnly: activeOnly === 'true' || activeOnly === '1'
        });
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/product/:productId', authMiddleware, (req, res) => {
    try {
        const recipe = recipeService.getRecipeByProduct(req.params.productId);
        if (!recipe) {
            return res.status(404).json({ error: 'No active recipe found for this product' });
        }
        res.json(recipe);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER', 'PRODUCTION', 'INVENTORY'), (req, res) => {
    try {
        const recipe = recipeService.createRecipe(req.body, req.user.id, req.user.username);
        res.status(201).json(recipe);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
