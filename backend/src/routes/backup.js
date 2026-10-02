const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const backupService = require('../services/backupService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { BACKUP_DIR } = require('../database/db');

router.get('/list', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const backups = backupService.listBackups();
        res.json(backups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/create', authMiddleware, requireRole('ADMIN'), async (req, res) => {
    try {
        const info = await backupService.createBackup(req.user.id, req.user.username);
        res.status(201).json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/restore', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).json({ error: 'fileName is required' });
        const result = backupService.restoreBackup(fileName, req.user.id, req.user.username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/download/:fileName', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const { fileName } = req.params;
        const filePath = path.resolve(BACKUP_DIR, fileName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }
        res.download(filePath, fileName);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
