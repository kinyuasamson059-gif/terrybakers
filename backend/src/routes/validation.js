const express = require('express');
const router = express.Router();
const path = require('path');
const { validateMigration } = require('../services/migrationValidationService');
const { authMiddleware } = require('../middleware/auth');

router.get('/migration', authMiddleware, (req, res) => {
    try {
        const localWorkbook = path.resolve(__dirname, '../../../Terry_Bakers_Production_Management_Template.xlsx');
        const results = validateMigration(localWorkbook);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
