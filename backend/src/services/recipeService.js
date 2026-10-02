const { db, transaction } = require('../database/db');
const { logAction } = require('./auditService');

function getRecipeByProduct(productId) {
    const recipe = db.prepare(`
        SELECT r.*
        FROM recipes r
        WHERE r.product_id = ? AND r.active = 1
        ORDER BY r.version DESC, r.id DESC
        LIMIT 1
    `).get(productId);

    if (!recipe) return null;

    const items = db.prepare(`
        SELECT ri.*, i.name as ingredient_name, i.unit as ingredient_unit
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
        ORDER BY i.name ASC
    `).all(recipe.id);

    return {
        ...recipe,
        items
    };
}

function getRecipeById(id) {
    const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(id);
    if (!recipe) return null;

    const items = db.prepare(`
        SELECT ri.*, i.name as ingredient_name, i.unit as ingredient_unit
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
        ORDER BY i.name ASC
    `).all(id);

    return { ...recipe, items };
}

function calculateRecipeRequirements(recipe, productionQuantity) {
    if (!recipe || !productionQuantity || Number(productionQuantity) <= 0) {
        return [];
    }

    const qty = Number(productionQuantity);
    const baseYield = Number(recipe.yield_quantity || 1);
    const multiplier = baseYield > 0 ? (qty / baseYield) : 0;

    return (recipe.items || []).map(item => {
        const requirement = Number(item.quantity_required || 0) * multiplier;
        const wastagePct = Number(item.wastage_percentage || 0);
        const wastage = requirement * (wastagePct / 100);
        const totalUsage = requirement + wastage;

        return {
            recipe_id: recipe.id,
            ingredient_id: item.ingredient_id,
            ingredient_name: item.ingredient_name,
            unit: item.unit || item.ingredient_unit || 'pcs',
            required_quantity: Number(requirement.toFixed(4)),
            wastage_percentage: wastagePct,
            wastage_quantity: Number(wastage.toFixed(4)),
            total_quantity: Number(totalUsage.toFixed(4)),
            notes: item.notes || ''
        };
    });
}

function getRecipes({ productId = '', search = '', activeOnly = false } = {}) {
    let where = [];
    let params = {};

    if (productId) {
        where.push('r.product_id = @productId');
        params.productId = Number(productId);
    }
    if (search) {
        where.push('(r.name LIKE @search OR p.name LIKE @search)');
        params.search = `%${search}%`;
    }
    if (activeOnly) {
        where.push('r.active = 1');
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
        SELECT r.*, p.name as product_name, p.unit as product_unit
        FROM recipes r
        JOIN products p ON p.id = r.product_id
        ${whereClause}
        ORDER BY r.product_id, r.version DESC, r.id DESC
    `).all(params);

    return rows.map(row => ({
        ...row,
        items: db.prepare(`
            SELECT ri.*, i.name as ingredient_name, i.unit as ingredient_unit
            FROM recipe_items ri
            JOIN ingredients i ON i.id = ri.ingredient_id
            WHERE ri.recipe_id = ?
            ORDER BY i.name ASC
        `).all(row.id)
    }));
}

function createRecipe(data, userId, username) {
    if (!data.product_id) throw new Error('A product is required');
    if (!data.name || !data.name.trim()) throw new Error('Recipe name is required');
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) throw new Error('At least one ingredient is required');

    const productId = Number(data.product_id);
    const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId);
    if (!product) throw new Error('Product not found');

    const yieldQuantity = Number(data.yield_quantity || data.yield || 0);
    if (yieldQuantity <= 0) throw new Error('Production yield must be greater than zero');

    const version = Number(data.version || 1);
    const active = data.active === undefined ? true : Boolean(data.active);

    return transaction(() => {
        if (active) {
            db.prepare('UPDATE recipes SET active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE product_id = ?').run(productId);
        }

        const recipeInfo = db.prepare(`
            INSERT INTO recipes (
                product_id, name, yield_quantity, yield_unit, version, active, notes, created_by, created_at, updated_at
            ) VALUES (
                @productId, @name, @yieldQuantity, @yieldUnit, @version, @active, @notes, @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `).run({
            productId,
            name: data.name.trim(),
            yieldQuantity,
            yieldUnit: data.yield_unit || data.yieldUnit || 'pcs',
            version,
            active: active ? 1 : 0,
            notes: data.notes || '',
            createdBy: userId || null
        });

        const recipeId = recipeInfo.lastInsertRowid;

        const itemStmt = db.prepare(`
            INSERT INTO recipe_items (
                recipe_id, ingredient_id, quantity_required, unit, wastage_percentage, notes, created_at
            ) VALUES (
                @recipeId, @ingredientId, @quantityRequired, @unit, @wastagePercentage, @notes, datetime('now', 'localtime')
            )
        `);

        for (const item of data.items) {
            if (!item.ingredient_id) continue;
            itemStmt.run({
                recipeId,
                ingredientId: Number(item.ingredient_id),
                quantityRequired: Number(item.quantity_required || item.quantity || 0),
                unit: item.unit || 'kg',
                wastagePercentage: Number(item.wastage_percentage || item.wastage || 0),
                notes: item.notes || ''
            });
        }

        logAction({
            userId,
            username,
            action: 'RECIPE_CREATED',
            tableName: 'recipes',
            recordId: recipeId,
            details: `Created recipe ${data.name.trim()} for product ${product.name}`
        });

        return getRecipeById(recipeId);
    })();
}

module.exports = {
    getRecipeByProduct,
    getRecipeById,
    getRecipes,
    calculateRecipeRequirements,
    createRecipe
};
