const { db, transaction } = require('../database/db');
const { getIngredientStock, recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

function getAllIngredients({ search = '', activeOnly = false } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(name LIKE @search OR ingredient_code LIKE @search)');
        params.search = `%${search}%`;
    }
    if (activeOnly) {
        where.push('active = 1');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const ingredients = db.prepare(`SELECT * FROM ingredients ${whereClause} ORDER BY name ASC`).all(params);

    return ingredients.map(ing => {
        const stockInfo = getIngredientStock(ing.id);
        return {
            ...ing,
            current_stock: stockInfo.balance,
            total_in: stockInfo.totalIn,
            total_cost_in: stockInfo.totalCostIn,
            average_cost: stockInfo.averageCost,
            is_low_stock: stockInfo.balance <= ing.min_stock_level && stockInfo.balance >= 0,
            is_negative_stock: stockInfo.balance < 0
        };
    });
}

function getIngredientById(id) {
    const ing = db.prepare(`SELECT * FROM ingredients WHERE id = ?`).get(id);
    if (!ing) return null;
    const stockInfo = getIngredientStock(ing.id);
    return {
        ...ing,
        current_stock: stockInfo.balance,
        total_in: stockInfo.totalIn,
        total_cost_in: stockInfo.totalCostIn,
        average_cost: stockInfo.averageCost,
        is_low_stock: stockInfo.balance <= ing.min_stock_level && stockInfo.balance >= 0,
        is_negative_stock: stockInfo.balance < 0
    };
}

function createIngredient(data, userId, username) {
    return transaction(() => {
        let ingredientCode = data.ingredient_code;
        if (!ingredientCode) {
            const count = db.prepare('SELECT COUNT(*) as c FROM ingredients').get().c;
            ingredientCode = 'ING-' + String(count + 1).padStart(3, '0');
        }

        const stmt = db.prepare(`
            INSERT INTO ingredients (
                ingredient_code, name, unit, min_stock_level, active, notes, created_by, created_at, updated_at
            ) VALUES (
                @ingredient_code, @name, @unit, @min_stock_level, @active, @notes, @created_by,
                datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const info = stmt.run({
            ingredient_code: ingredientCode,
            name: data.name.trim(),
            unit: data.unit ? data.unit.trim() : 'kg',
            min_stock_level: Number(data.min_stock_level) || 10,
            active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
            notes: data.notes || '',
            created_by: userId || null
        });

        const newId = info.lastInsertRowid;

        // If opening stock provided
        if (Number(data.opening_stock) > 0) {
            recordInventoryTransaction({
                date: data.opening_date || new Date().toISOString().split('T')[0],
                itemType: 'INGREDIENT',
                itemId: newId,
                transactionType: 'OPENING',
                quantityChange: Number(data.opening_stock),
                unitCost: Number(data.cost_per_unit) || 0,
                totalValue: (Number(data.opening_stock) * (Number(data.cost_per_unit) || 0)),
                notes: 'Initial opening stock',
                createdBy: userId
            });
        }

        logAction({
            userId,
            username,
            action: 'INGREDIENT_CREATED',
            tableName: 'ingredients',
            recordId: newId,
            newValues: data,
            details: `Created ingredient "${data.name}"`
        });

        return getIngredientById(newId);
    })();
}

function updateIngredient(id, data, userId, username) {
    return transaction(() => {
        const existing = getIngredientById(id);
        if (!existing) throw new Error('Ingredient not found');

        const stmt = db.prepare(`
            UPDATE ingredients SET
                name = COALESCE(@name, name),
                unit = COALESCE(@unit, unit),
                min_stock_level = COALESCE(@min_stock_level, min_stock_level),
                active = COALESCE(@active, active),
                notes = COALESCE(@notes, notes),
                updated_at = datetime('now', 'localtime')
            WHERE id = @id
        `);

        stmt.run({
            id,
            name: data.name !== undefined ? data.name.trim() : existing.name,
            unit: data.unit !== undefined ? data.unit.trim() : existing.unit,
            min_stock_level: data.min_stock_level !== undefined ? Number(data.min_stock_level) : existing.min_stock_level,
            active: data.active !== undefined ? (data.active ? 1 : 0) : existing.active,
            notes: data.notes !== undefined ? data.notes : existing.notes
        });

        logAction({
            userId,
            username,
            action: 'INGREDIENT_UPDATED',
            tableName: 'ingredients',
            recordId: id,
            oldValues: existing,
            newValues: data,
            details: `Updated ingredient "${existing.name}"`
        });

        return getIngredientById(id);
    })();
}

function toggleIngredientActive(id, userId, username) {
    const ing = getIngredientById(id);
    if (!ing) throw new Error('Ingredient not found');
    const newStatus = ing.active ? 0 : 1;
    db.prepare(`UPDATE ingredients SET active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(newStatus, id);

    logAction({
        userId,
        username,
        action: newStatus ? 'INGREDIENT_ACTIVATED' : 'INGREDIENT_DEACTIVATED',
        tableName: 'ingredients',
        recordId: id,
        details: `Ingredient "${ing.name}" marked as ${newStatus ? 'active' : 'inactive'}`
    });

    return getIngredientById(id);
}

module.exports = {
    getAllIngredients,
    getIngredientById,
    createIngredient,
    updateIngredient,
    toggleIngredientActive
};
