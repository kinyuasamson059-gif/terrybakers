const { verifyToken, ROLE_PERMISSIONS } = require('../services/authService');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        // Fallback for local dev/initial usage if needed, or query token
        const tokenQuery = req.query.token;
        if (tokenQuery) {
            const decoded = verifyToken(tokenQuery);
            if (decoded) {
                req.user = decoded;
                return next();
            }
        }
        return res.status(401).json({ error: 'Authentication required. No authorization header provided.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Malformed authorization header. Format: Bearer <token>' });
    }

    const decoded = verifyToken(parts[1]);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = decoded;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (roles.includes(req.user.role) || req.user.role === 'ADMIN') {
            return next();
        }
        return res.status(403).json({ error: `Access denied. Requires one of roles: ${roles.join(', ')}` });
    };
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userPerms = ROLE_PERMISSIONS[req.user.role] || [];
        if (req.user.role === 'ADMIN' || userPerms.includes(permission)) {
            return next();
        }
        return res.status(403).json({ error: `Access denied. Insufficient permissions for "${permission}"` });
    };
}

module.exports = {
    authMiddleware,
    requireRole,
    requirePermission
};
