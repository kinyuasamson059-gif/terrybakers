const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const result = authService.login(username, password);
        res.json(result);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

router.get('/me', authMiddleware, (req, res) => {
    res.json({
        user: {
            ...req.user,
            permissions: authService.ROLE_PERMISSIONS[req.user.role] || []
        }
    });
});

router.get('/users', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const users = authService.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const { username, password, full_name, role } = req.body;
        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ error: 'All fields (username, password, full_name, role) are required' });
        }
        const newUser = authService.createUser({ username, password, full_name, role }, req.user.id, req.user.username);
        res.status(201).json(newUser);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/users/:id', authMiddleware, requireRole('ADMIN'), (req, res) => {
    try {
        const updated = authService.updateUser(req.params.id, req.body, req.user.id, req.user.username);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
