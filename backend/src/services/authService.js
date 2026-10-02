const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { logAction } = require('./auditService');

const JWT_SECRET = 'terry_bakers_local_secret_key_offline_2026';

const ROLE_PERMISSIONS = {
    ADMIN: ['dashboard', 'sales', 'customers', 'production', 'recipes', 'purchases', 'ingredients', 'inventory', 'workers', 'returns', 'damages', 'expenses', 'reports', 'users', 'settings', 'backup', 'migration'],
    MANAGER: ['dashboard', 'sales', 'customers', 'production', 'recipes', 'purchases', 'ingredients', 'inventory', 'workers', 'returns', 'damages', 'expenses', 'reports'],
    SALES: ['dashboard', 'sales', 'customers', 'returns', 'reports'],
    PRODUCTION: ['dashboard', 'production', 'recipes', 'ingredients', 'workers', 'reports'],
    INVENTORY: ['dashboard', 'recipes', 'purchases', 'ingredients', 'inventory', 'damages', 'returns', 'reports']
};

function login(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (!user) {
        throw new Error('Invalid username or password');
    }
    if (!user.active) {
        throw new Error('This user account has been deactivated');
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
        throw new Error('Invalid username or password');
    }

    const payload = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    logAction({
        userId: user.id,
        username: user.username,
        action: 'USER_LOGIN',
        tableName: 'users',
        recordId: user.id,
        details: `User ${user.username} logged in successfully`
    });

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            permissions: ROLE_PERMISSIONS[user.role] || []
        }
    };
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

function getAllUsers() {
    const users = db.prepare('SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY id ASC').all();
    return users.map(u => ({
        ...u,
        permissions: ROLE_PERMISSIONS[u.role] || []
    }));
}

function createUser({ username, password, full_name, role }, currentUserId = null, currentUsername = 'ADMIN') {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
    if (existing) {
        throw new Error('Username already exists');
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, full_name, role, active, created_at, updated_at)
        VALUES (@username, @hash, @full_name, @role, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    const info = stmt.run({
        username: username.trim(),
        hash,
        full_name: full_name.trim(),
        role
    });

    logAction({
        userId: currentUserId,
        username: currentUsername,
        action: 'USER_CREATED',
        tableName: 'users',
        recordId: info.lastInsertRowid,
        details: `Created user ${username} with role ${role}`
    });

    return db.prepare('SELECT id, username, full_name, role, active, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function updateUser(id, { full_name, role, active, password }, currentUserId = null, currentUsername = 'ADMIN') {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) throw new Error('User not found');

    let newHash = existing.password_hash;
    if (password && password.trim() !== '') {
        const salt = bcrypt.genSaltSync(10);
        newHash = bcrypt.hashSync(password, salt);
    }

    db.prepare(`
        UPDATE users SET
            full_name = COALESCE(?, full_name),
            role = COALESCE(?, role),
            active = COALESCE(?, active),
            password_hash = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
    `).run(
        full_name !== undefined ? full_name : existing.full_name,
        role !== undefined ? role : existing.role,
        active !== undefined ? (active ? 1 : 0) : existing.active,
        newHash,
        id
    );

    logAction({
        userId: currentUserId,
        username: currentUsername,
        action: 'USER_UPDATED',
        tableName: 'users',
        recordId: id,
        details: `Updated user ${existing.username}`
    });

    return db.prepare('SELECT id, username, full_name, role, active, updated_at FROM users WHERE id = ?').get(id);
}

module.exports = {
    login,
    verifyToken,
    getAllUsers,
    createUser,
    updateUser,
    ROLE_PERMISSIONS
};
