const { db, transaction } = require('../database/db');
const { getProductStock, recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

function getAllProducts({ search = '', category = '', activeOnly = false } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(name LIKE @search OR product_code LIKE @search)');
        params.search = `%${search}%`;
    }
    if (category) {
        where.push('category = @category');
        params.category = category;
    }
    if (activeOnly) {
        where.push('active = 1');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const products = db.prepare(`SELECT * FROM products ${whereClause} ORDER BY name ASC`).all(params);

    // Attach calculated stock from inventory transactions
    return products.map(p => ({
        ...p,
        current_stock: getProductStock(p.id)
    }));
}

function getProductById(id) {
    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
    if (!product) return null;
    return {
        ...product,
        current_stock: getProductStock(product.id)
    };
}

function createProduct(data, userId, username) {
    return transaction(() => {
        // Generate product code if not provided
        let productCode = data.product_code;
        if (!productCode) {
            const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
            productCode = 'PRD-' + String(count + 1).padStart(3, '0');
        }

        const stmt = db.prepare(`
            INSERT INTO products (
                product_code, name, category, unit, selling_price, cost_price, active, notes, created_by, created_at, updated_at
            ) VALUES (
                @product_code, @name, @category, @unit, @selling_price, @cost_price, @active, @notes, @created_by,
                datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const info = stmt.run({
            product_code: productCode,
            name: data.name.trim(),
            category: data.category || 'Cakes',
            unit: data.unit || 'pcs',
            selling_price: Number(data.selling_price) || 0,
            cost_price: Number(data.cost_price) || 0,
            active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
            notes: data.notes || '',
            created_by: userId || null
        });

        const newId = info.lastInsertRowid;

        // If initial opening stock provided
        if (Number(data.opening_stock) > 0) {
            recordInventoryTransaction({
                date: data.opening_date || new Date().toISOString().split('T')[0],
                itemType: 'PRODUCT',
                itemId: newId,
                transactionType: 'OPENING',
                quantityChange: Number(data.opening_stock),
                unitCost: Number(data.cost_price) || 0,
                totalValue: (Number(data.opening_stock) * (Number(data.cost_price) || 0)),
                notes: 'Initial opening stock',
                createdBy: userId
            });
        }

        logAction({
            userId,
            username,
            action: 'PRODUCT_CREATED',
            tableName: 'products',
            recordId: newId,
            newValues: data,
            details: `Created product "${data.name}"`
        });

        return getProductById(newId);
    })();
}

function updateProduct(id, data, userId, username) {
    return transaction(() => {
        const existing = getProductById(id);
        if (!existing) throw new Error('Product not found');

        const stmt = db.prepare(`
            UPDATE products SET
                name = COALESCE(@name, name),
                category = COALESCE(@category, category),
                unit = COALESCE(@unit, unit),
                selling_price = COALESCE(@selling_price, selling_price),
                cost_price = COALESCE(@cost_price, cost_price),
                active = COALESCE(@active, active),
                notes = COALESCE(@notes, notes),
                updated_at = datetime('now', 'localtime')
            WHERE id = @id
        `);

        stmt.run({
            id,
            name: data.name !== undefined ? data.name.trim() : existing.name,
            category: data.category !== undefined ? data.category : existing.category,
            unit: data.unit !== undefined ? data.unit : existing.unit,
            selling_price: data.selling_price !== undefined ? Number(data.selling_price) : existing.selling_price,
            cost_price: data.cost_price !== undefined ? Number(data.cost_price) : existing.cost_price,
            active: data.active !== undefined ? (data.active ? 1 : 0) : existing.active,
            notes: data.notes !== undefined ? data.notes : existing.notes
        });

        logAction({
            userId,
            username,
            action: 'PRODUCT_UPDATED',
            tableName: 'products',
            recordId: id,
            oldValues: existing,
            newValues: data,
            details: `Updated product "${existing.name}"`
        });

        return getProductById(id);
    })();
}

function toggleProductActive(id, userId, username) {
    const product = getProductById(id);
    if (!product) throw new Error('Product not found');
    const newStatus = product.active ? 0 : 1;
    db.prepare(`UPDATE products SET active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(newStatus, id);

    logAction({
        userId,
        username,
        action: newStatus ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
        tableName: 'products',
        recordId: id,
        details: `Product "${product.name}" marked as ${newStatus ? 'active' : 'inactive'}`
    });

    return getProductById(id);
}

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    toggleProductActive
};
