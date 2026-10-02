const { db } = require('../database/db');

// Record a transaction in the inventory ledger
function recordInventoryTransaction({
    date,
    itemType, // 'PRODUCT' or 'INGREDIENT'
    itemId,
    transactionType, // 'OPENING', 'PURCHASE', 'USAGE', 'PRODUCTION', 'SALE', 'SALE_RETURN', 'DAMAGE', 'ADJUSTMENT'
    quantityChange, // Positive for addition, negative for reduction
    unitCost = 0,
    totalValue = 0,
    batchReference = null,
    referenceTable = null,
    referenceId = null,
    notes = null,
    createdBy = null
}) {
    const txNum = 'TX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const effectiveDate = date || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
        INSERT INTO inventory_transactions (
            transaction_number, date, item_type, item_id, transaction_type,
            quantity_change, unit_cost, total_value, batch_reference,
            reference_table, reference_id, notes, created_by, created_at
        ) VALUES (
            @txNum, @effectiveDate, @itemType, @itemId, @transactionType,
            @quantityChange, @unitCost, @totalValue, @batchReference,
            @referenceTable, @referenceId, @notes, @createdBy, datetime('now', 'localtime')
        )
    `);

    stmt.run({
        txNum,
        effectiveDate,
        itemType,
        itemId,
        transactionType,
        quantityChange,
        unitCost,
        totalValue,
        batchReference,
        referenceTable,
        referenceId,
        notes,
        createdBy
    });

    return txNum;
}

// Calculate current stock balance for a single product
function getProductStock(productId) {
    const row = db.prepare(`
        SELECT COALESCE(SUM(quantity_change), 0) as balance
        FROM inventory_transactions
        WHERE item_type = 'PRODUCT' AND item_id = ?
    `).get(productId);
    return row ? row.balance : 0;
}

// Calculate current stock balance and average cost for a single ingredient
function getIngredientStock(ingredientId) {
    const balanceRow = db.prepare(`
        SELECT COALESCE(SUM(quantity_change), 0) as balance
        FROM inventory_transactions
        WHERE item_type = 'INGREDIENT' AND item_id = ?
    `).get(ingredientId);

    // Calculate total purchased and total purchase cost to match Excel Ingredients Balances
    const costRow = db.prepare(`
        SELECT 
            COALESCE(SUM(quantity_change), 0) as total_in,
            COALESCE(SUM(total_value), 0) as total_cost_in
        FROM inventory_transactions
        WHERE item_type = 'INGREDIENT' AND item_id = ? AND transaction_type IN ('PURCHASE', 'OPENING')
    `).get(ingredientId);

    const balance = balanceRow ? balanceRow.balance : 0;
    const totalIn = costRow ? costRow.total_in : 0;
    const totalCostIn = costRow ? costRow.total_cost_in : 0;
    const averageCost = totalIn > 0 ? (totalCostIn / totalIn) : 0;

    return {
        balance,
        totalIn,
        totalCostIn,
        averageCost
    };
}

// Get comprehensive finished product stock table (Requirement 16)
// Columns: Product, Opening, Produced, Sold, Returned, Damaged, Closing
function getProductStockSummary({ startDate = null, endDate = null } = {}) {
    const products = db.prepare(`SELECT * FROM products WHERE active = 1 ORDER BY name ASC`).all();

    return products.map(prod => {
        let opening = 0;
        let produced = 0;
        let sold = 0;
        let returned = 0;
        let damaged = 0;

        if (startDate) {
            // Opening balance before startDate
            const opRow = db.prepare(`
                SELECT COALESCE(SUM(quantity_change), 0) as bal
                FROM inventory_transactions
                WHERE item_type = 'PRODUCT' AND item_id = ? AND date < ?
            `).get(prod.id, startDate);
            opening = opRow ? opRow.bal : 0;

            // Movements within [startDate, endDate]
            let query = `
                SELECT 
                    transaction_type,
                    COALESCE(SUM(ABS(quantity_change)), 0) as qty
                FROM inventory_transactions
                WHERE item_type = 'PRODUCT' AND item_id = ? AND date >= ?
            `;
            const params = [prod.id, startDate];
            if (endDate) {
                query += ` AND date <= ?`;
                params.push(endDate);
            }
            query += ` GROUP BY transaction_type`;
            const rows = db.prepare(query).all(...params);

            rows.forEach(r => {
                if (r.transaction_type === 'PRODUCTION' || r.transaction_type === 'OPENING') produced += r.qty;
                else if (r.transaction_type === 'SALE') sold += r.qty;
                else if (r.transaction_type === 'SALE_RETURN') returned += r.qty;
                else if (r.transaction_type === 'DAMAGE') damaged += r.qty;
            });
        } else {
            // Lifetime totals
            const rows = db.prepare(`
                SELECT 
                    transaction_type,
                    COALESCE(SUM(ABS(quantity_change)), 0) as qty
                FROM inventory_transactions
                WHERE item_type = 'PRODUCT' AND item_id = ?
                GROUP BY transaction_type
            `).all(prod.id);

            rows.forEach(r => {
                if (r.transaction_type === 'OPENING') opening += r.qty;
                else if (r.transaction_type === 'PRODUCTION') produced += r.qty;
                else if (r.transaction_type === 'SALE') sold += r.qty;
                else if (r.transaction_type === 'SALE_RETURN') returned += r.qty;
                else if (r.transaction_type === 'DAMAGE') damaged += r.qty;
            });
        }

        const closing = opening + produced + returned - sold - damaged;

        return {
            productId: prod.id,
            productCode: prod.product_code,
            productName: prod.name,
            category: prod.category,
            unit: prod.unit,
            sellingPrice: prod.selling_price,
            costPrice: prod.cost_price,
            opening,
            produced,
            sold,
            returned,
            damaged,
            closing
        };
    });
}

// Get comprehensive ingredient stock table (Requirement 16)
// Columns: Ingredient, Unit, Purchased, Used, Balance, Average Cost, Total Cost
function getIngredientStockSummary({ startDate = null, endDate = null } = {}) {
    const ingredients = db.prepare(`SELECT * FROM ingredients WHERE active = 1 ORDER BY name ASC`).all();

    return ingredients.map(ing => {
        let purchased = 0;
        let totalCostIn = 0;
        let used = 0;

        let query = `
            SELECT 
                transaction_type,
                COALESCE(SUM(ABS(quantity_change)), 0) as total_qty,
                COALESCE(SUM(total_value), 0) as total_cost
            FROM inventory_transactions
            WHERE item_type = 'INGREDIENT' AND item_id = ?
        `;
        const params = [ing.id];

        if (startDate) {
            query += ` AND date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND date <= ?`;
            params.push(endDate);
        }
        query += ` GROUP BY transaction_type`;

        const rows = db.prepare(query).all(...params);

        rows.forEach(r => {
            if (r.transaction_type === 'PURCHASE' || r.transaction_type === 'OPENING') {
                purchased += r.total_qty;
                totalCostIn += r.total_cost;
            } else if (r.transaction_type === 'USAGE' || r.transaction_type === 'PRODUCTION_USAGE') {
                used += r.total_qty;
            }
        });

        // Current overall balance
        const balanceRow = db.prepare(`
            SELECT COALESCE(SUM(quantity_change), 0) as balance
            FROM inventory_transactions
            WHERE item_type = 'INGREDIENT' AND item_id = ?
        `).get(ing.id);

        const balance = balanceRow ? balanceRow.balance : 0;

        // Average cost = Total Cost In / Total Quantity In (matching Excel IFERROR(F/C, ""))
        const allInRow = db.prepare(`
            SELECT 
                COALESCE(SUM(quantity_change), 0) as all_in,
                COALESCE(SUM(total_value), 0) as all_cost
            FROM inventory_transactions
            WHERE item_type = 'INGREDIENT' AND item_id = ? AND transaction_type IN ('PURCHASE', 'OPENING')
        `).get(ing.id);

        const totalAllIn = allInRow ? allInRow.all_in : 0;
        const totalAllCost = allInRow ? allInRow.all_cost : 0;
        const averageCost = totalAllIn > 0 ? (totalAllCost / totalAllIn) : 0;

        const isLowStock = balance <= ing.min_stock_level && balance >= 0;
        const isNegativeStock = balance < 0;

        return {
            ingredientId: ing.id,
            ingredientCode: ing.ingredient_code,
            name: ing.name,
            unit: ing.unit,
            minStockLevel: ing.min_stock_level,
            purchased,
            used,
            balance,
            averageCost,
            totalCostIn,
            stockValue: balance * averageCost,
            isLowStock,
            isNegativeStock
        };
    });
}

// Low-stock and negative-stock warnings
function getStockAlerts() {
    const ingredientSummary = getIngredientStockSummary();
    const productSummary = getProductStockSummary();

    const lowStockIngredients = ingredientSummary.filter(i => i.balance <= i.minStockLevel && i.balance >= 0);
    const negativeStockIngredients = ingredientSummary.filter(i => i.balance < 0);
    const negativeStockProducts = productSummary.filter(p => p.closing < 0);
    const lowStockProducts = productSummary.filter(p => p.closing <= 50 && p.closing >= 0);

    return {
        lowStockIngredients,
        negativeStockIngredients,
        negativeStockProducts,
        lowStockProducts,
        totalAlerts: lowStockIngredients.length + negativeStockIngredients.length + negativeStockProducts.length
    };
}

// Get raw ledger movement log
function getInventoryLedger({ itemType, itemId, transactionType, startDate, endDate, limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (itemType) {
        where.push('it.item_type = @itemType');
        params.itemType = itemType;
    }
    if (itemId) {
        where.push('it.item_id = @itemId');
        params.itemId = itemId;
    }
    if (transactionType) {
        where.push('it.transaction_type = @transactionType');
        params.transactionType = transactionType;
    }
    if (startDate) {
        where.push('it.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('it.date <= @endDate');
        params.endDate = endDate;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM inventory_transactions it ${whereClause}`);
    const total = countStmt.get(params).total;

    const query = db.prepare(`
        SELECT 
            it.*,
            CASE 
                WHEN it.item_type = 'PRODUCT' THEN p.name 
                ELSE ing.name 
            END as item_name,
            CASE 
                WHEN it.item_type = 'PRODUCT' THEN p.unit 
                ELSE ing.unit 
            END as unit,
            u.full_name as created_by_name
        FROM inventory_transactions it
        LEFT JOIN products p ON it.item_type = 'PRODUCT' AND it.item_id = p.id
        LEFT JOIN ingredients ing ON it.item_type = 'INGREDIENT' AND it.item_id = ing.id
        LEFT JOIN users u ON it.created_by = u.id
        ${whereClause}
        ORDER BY it.date DESC, it.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const transactions = query.all({ ...params, limit, offset });
    return { total, transactions };
}

module.exports = {
    recordInventoryTransaction,
    getProductStock,
    getIngredientStock,
    getProductStockSummary,
    getIngredientStockSummary,
    getStockAlerts,
    getInventoryLedger
};
