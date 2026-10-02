const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure database and tables are seeded
const { seedDatabase } = require('./database/seed');
seedDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/production', require('./routes/production'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/damages', require('./routes/damages'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/profit', require('./routes/profit'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/excel', require('./routes/excel'));
app.use('/api/validation', require('./routes/validation'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        system: 'Terry Bakers Production & Management System',
        time: new Date().toISOString(),
        offlineReady: true
    });
});

// Serve frontend build if present
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api).*$/, (req, res) => {
        res.sendFile(path.resolve(frontendDist, 'index.html'));
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`====================================================`);
        console.log(` Terry Bakers Local Bakery Management System`);
        console.log(` Server running on http://localhost:${PORT}`);
        console.log(` Mode: OFFLINE LOCAL`);
        console.log(`====================================================`);
    });
}

module.exports = app;
