const bcrypt = require('bcryptjs');
const { db } = require('./db');

function seedDatabase() {
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (existingUsers.count === 0) {
        console.log('Seeding initial users...');
        const salt = bcrypt.genSaltSync(10);

        const usersToSeed = [
            {
                username: 'admin',
                password: 'admin123',
                full_name: 'System Administrator',
                role: 'ADMIN'
            },
            {
                username: 'manager',
                password: 'manager123',
                full_name: 'Operations Manager',
                role: 'MANAGER'
            },
            {
                username: 'sales',
                password: 'sales123',
                full_name: 'Sales Cashier',
                role: 'SALES'
            },
            {
                username: 'production',
                password: 'production123',
                full_name: 'Head Baker',
                role: 'PRODUCTION'
            },
            {
                username: 'inventory',
                password: 'inventory123',
                full_name: 'Store Keeper',
                role: 'INVENTORY'
            }
        ];

        const insertUser = db.prepare(`
            INSERT INTO users (username, password_hash, full_name, role, active, created_at, updated_at)
            VALUES (@username, @password_hash, @full_name, @role, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
        `);

        for (const u of usersToSeed) {
            insertUser.run({
                username: u.username,
                password_hash: bcrypt.hashSync(u.password, salt),
                full_name: u.full_name,
                role: u.role
            });
        }
        console.log('Default users created successfully.');
    }

    // Default System Settings
    const defaultSettings = [
        { key: 'company_name', value: 'Terry Bakers', description: 'Bakery Business Name' },
        { key: 'currency_symbol', value: 'KES', description: 'Currency Symbol / Code' },
        { key: 'allow_negative_inventory', value: 'true', description: 'Allow ingredient consumption even if stock balance is negative (with warning)' },
        { key: 'low_stock_threshold', value: '10', description: 'Default low stock warning threshold' },
        { key: 'default_8kg_unit_divisor', value: '8', description: 'Worker production 8kg unit metric divisor' }
    ];

    const insertSetting = db.prepare(`
        INSERT OR IGNORE INTO system_settings (key, value, description, updated_at)
        VALUES (@key, @value, @description, datetime('now', 'localtime'))
    `);

    for (const s of defaultSettings) {
        insertSetting.run(s);
    }
}

if (require.main === module) {
    seedDatabase();
    console.log('Database seeded.');
}

module.exports = { seedDatabase };
