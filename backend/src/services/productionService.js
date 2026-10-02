const { db, transaction } = require('../database/db');
const { getIngredientStock, recordInventoryTransaction } = require('./inventoryService');
const { getRecipeByProduct, calculateRecipeRequirements } = require('./recipeService');
const { logAction } = require('./auditService');

function getAllBatches({ search = '', startDate = '', endDate = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(pb.batch_number LIKE @search OR pb.worker_name LIKE @search OR pb.notes LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('pb.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('pb.date <= @endDate');
        params.endDate = endDate;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM production_batches pb ${whereClause}`).get(params).total;

    const query = db.prepare(`
        SELECT 
            pb.*,
            u.full_name as created_by_name
        FROM production_batches pb
        LEFT JOIN users u ON pb.created_by = u.id
        ${whereClause}
        ORDER BY pb.date DESC, pb.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const batches = query.all({ ...params, limit, offset });

    const prodItemsStmt = db.prepare(`
        SELECT pi.*, p.name as product_name, p.unit as product_unit
        FROM production_items pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.batch_id = ?
    `);

    const usageStmt = db.prepare(`
        SELECT iu.*, ing.name as ingredient_name
        FROM ingredient_usage iu
        JOIN ingredients ing ON iu.ingredient_id = ing.id
        WHERE iu.batch_id = ?
    `);

    return {
        total,
        batches: batches.map(b => ({
            ...b,
            products: prodItemsStmt.all(b.id),
            ingredients_used: usageStmt.all(b.id)
        }))
    };
}

function getBatchById(id) {
    const batch = db.prepare(`
        SELECT pb.*, u.full_name as created_by_name
        FROM production_batches pb
        LEFT JOIN users u ON pb.created_by = u.id
        WHERE pb.id = ?
    `).get(id);

    if (!batch) return null;

    const products = db.prepare(`
        SELECT pi.*, p.name as product_name, p.unit as product_unit
        FROM production_items pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.batch_id = ?
    `).all(id);

    const ingredients_used = db.prepare(`
        SELECT iu.*, ing.name as ingredient_name
        FROM ingredient_usage iu
        JOIN ingredients ing ON iu.ingredient_id = ing.id
        WHERE iu.batch_id = ?
    `).all(id);

    return {
        ...batch,
        products,
        ingredients_used
    };
}

// Create a complete production record with batches, products produced, ingredient usage and worker metrics
function createProduction(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        let batchNumber = (data.batch_number || data.batch || '').trim();

        if (!batchNumber) {
            const count = db.prepare(`SELECT COUNT(*) as c FROM production_batches WHERE date = ?`).get(date).c;
            batchNumber = 'B' + date.replace(/-/g, '').substring(2) + '-' + String(count + 1).padStart(3, '0');
        }

        // Check negative inventory setting
        const allowNegSetting = db.prepare(`SELECT value FROM system_settings WHERE key = 'allow_negative_inventory'`).get();
        const allowNegative = allowNegSetting ? allowNegSetting.value === 'true' : true;

        // Normalize worker
        let workerId = data.worker_id || null;
        let workerName = data.worker_name || (data.worker ? data.worker.trim() : null);

        if (workerName && !workerId) {
            const wRow = db.prepare(`SELECT id, name FROM workers WHERE LOWER(name) = LOWER(?)`).get(workerName);
            if (wRow) {
                workerId = wRow.id;
                workerName = wRow.name;
            } else {
                // Auto create worker
                const countW = db.prepare(`SELECT COUNT(*) as c FROM workers`).get().c;
                const wCode = 'WRK-' + String(countW + 1).padStart(3, '0');
                const wRes = db.prepare(`
                    INSERT INTO workers (worker_code, name, role, active, created_at, updated_at)
                    VALUES (?, ?, 'Baker', 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(wCode, workerName);
                workerId = wRes.lastInsertRowid;
            }
        }

        const productionHours = Number(data.production_hours || data.productionHours) || 0;
        let activeRecipe = null;

        // Process Products Produced
        let productsProduced = data.products || [];
        if (productsProduced.length === 0 && (data.product_id || data.product_name || data.product)) {
            let prodId = data.product_id;
            const pName = data.product_name || data.product;
            if (!prodId && pName) {
                const pRow = db.prepare(`SELECT id FROM products WHERE LOWER(name) = LOWER(?)`).get(pName.trim());
                if (pRow) {
                    prodId = pRow.id;
                } else {
                    const countP = db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
                    const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                    const pRes = db.prepare(`
                        INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_by, created_at, updated_at)
                        VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(pCode, pName.trim(), userId);
                    prodId = pRes.lastInsertRowid;
                }
            }

            const qty = Number(data.quantity_produced || data.quantity || data['Quantity(cake produced)']) || 0;
            if (qty > 0) {
                productsProduced.push({
                    product_id: prodId,
                    quantity_produced: qty,
                    notes: data.notes || ''
                });
            }
        }

        // Process Ingredients Used
        let ingredientsUsed = data.ingredients_used || data.ingredients || [];

        if (productsProduced.length > 0 && ingredientsUsed.length === 0) {
            const recipeProducts = productsProduced.filter(p => p.product_id);
            for (const prod of recipeProducts) {
                const recipe = getRecipeByProduct(prod.product_id);
                if (!recipe) continue;
                activeRecipe = recipe;
                const requirementRows = calculateRecipeRequirements(recipe, Number(prod.quantity_produced || 0));
                for (const row of requirementRows) {
                    const existing = ingredientsUsed.find(item => Number(item.ingredient_id) === Number(row.ingredient_id));
                    if (existing) {
                        existing.quantity_used = Number(existing.quantity_used || 0) + Number(row.total_quantity);
                    } else {
                        ingredientsUsed.push({
                            ingredient_id: row.ingredient_id,
                            product_id: prod.product_id,
                            unit: row.unit,
                            quantity_used: Number(row.total_quantity),
                            no_of_cakes: Number(prod.quantity_produced || 0),
                            notes: row.notes || `Recipe requirement for ${recipe.name}`
                        });
                    }
                }
            }
        }

        // Support single entry format if called from Ingredient Usage screen
        if (ingredientsUsed.length === 0 && (data.ingredient_id || data.ingredient_name || data.ingredient)) {
            let ingId = data.ingredient_id;
            const ingName = data.ingredient_name || data.ingredient;
            if (!ingId && ingName) {
                const iRow = db.prepare(`SELECT id, unit FROM ingredients WHERE LOWER(name) = LOWER(?)`).get(ingName.trim());
                if (iRow) {
                    ingId = iRow.id;
                } else {
                    const countI = db.prepare(`SELECT COUNT(*) as c FROM ingredients`).get().c;
                    const iCode = 'ING-' + String(countI + 1).padStart(3, '0');
                    const iRes = db.prepare(`
                        INSERT INTO ingredients (ingredient_code, name, unit, min_stock_level, active, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, 10, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(iCode, ingName.trim(), data.unit || 'kg', userId);
                    ingId = iRes.lastInsertRowid;
                }
            }

            const qtyUsed = Number(data.quantity_used || data.quantity) || 0;
            if (qtyUsed > 0) {
                ingredientsUsed.push({
                    ingredient_id: ingId,
                    product_id: (productsProduced[0] && productsProduced[0].product_id) || data.product_id || null,
                    unit: data.unit || 'kg',
                    quantity_used: qtyUsed,
                    no_of_cakes: Number(data.no_of_cakes || data.no_cakes) || (productsProduced[0] ? productsProduced[0].quantity_produced : 0),
                    notes: data.notes || ''
                });
            }
        }

        // Validate ingredient stock availability
        let totalBatchCost = 0;
        const warnings = [];

        for (const ingUse of ingredientsUsed) {
            const ingStock = getIngredientStock(ingUse.ingredient_id);
            const qtyNeeded = Number(ingUse.quantity_used);

            if (ingStock.balance < qtyNeeded) {
                const ingObj = db.prepare(`SELECT name FROM ingredients WHERE id = ?`).get(ingUse.ingredient_id);
                const ingName = ingObj ? ingObj.name : `Ingredient #${ingUse.ingredient_id}`;
                const warningMsg = `Insufficient stock for ${ingName}: Available ${ingStock.balance}, Required ${qtyNeeded}`;

                if (!allowNegative && !data.override_negative_stock) {
                    throw new Error(warningMsg + '. Negative inventory is not permitted by current system settings.');
                } else {
                    warnings.push(warningMsg);
                }
            }

            // Calculate cost using current average cost
            const unitCost = ingUse.unit_cost !== undefined ? Number(ingUse.unit_cost) : ingStock.averageCost;
            const itemTotalCost = qtyNeeded * unitCost;
            totalBatchCost += itemTotalCost;

            ingUse.calculatedUnitCost = unitCost;
            ingUse.calculatedTotalCost = itemTotalCost;
        }

        // Calculate unit cost per product produced
        const totalCakesProduced = productsProduced.reduce((sum, p) => sum + Number(p.quantity_produced), 0);
        const unitProductionCost = totalCakesProduced > 0 ? (totalBatchCost / totalCakesProduced) : 0;

        // Insert production batch header
        const insertBatch = db.prepare(`
            INSERT INTO production_batches (
                batch_number, date, status, worker_id, worker_name, production_hours,
                total_cost, recipe_id, recipe_name, recipe_version, notes, created_by, created_at, updated_at
            ) VALUES (
                @batchNumber, @date, 'COMPLETED', @workerId, @workerName, @productionHours,
                @totalCost, @recipeId, @recipeName, @recipeVersion, @notes, @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        // Check if batch_number already exists; if so append unique suffix or reuse
        let finalBatchNumber = batchNumber;
        const existingBatch = db.prepare(`SELECT id FROM production_batches WHERE batch_number = ?`).get(finalBatchNumber);
        if (existingBatch) {
            finalBatchNumber = `${batchNumber}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        }

        const bInfo = insertBatch.run({
            batchNumber: finalBatchNumber,
            date,
            workerId,
            workerName,
            productionHours,
            totalCost: totalBatchCost,
            recipeId: activeRecipe ? activeRecipe.id : null,
            recipeName: activeRecipe ? activeRecipe.name : null,
            recipeVersion: activeRecipe ? `V${activeRecipe.version}` : null,
            notes: data.notes || '',
            createdBy: userId || null
        });

        const batchId = bInfo.lastInsertRowid;

        // Insert products produced and update finished-product inventory
        const insertProdItem = db.prepare(`
            INSERT INTO production_items (
                batch_id, product_id, quantity_produced, unit_cost, total_cost, notes, created_at
            ) VALUES (
                @batchId, @productId, @quantityProduced, @unitCost, @totalCost, @notes, datetime('now', 'localtime')
            )
        `);

        for (const prod of productsProduced) {
            const qty = Number(prod.quantity_produced);
            const cost = qty * unitProductionCost;

            insertProdItem.run({
                batchId,
                productId: prod.product_id,
                quantityProduced: qty,
                unitCost: unitProductionCost,
                totalCost: cost,
                notes: prod.notes || ''
            });

            // Increase product inventory ledger
            recordInventoryTransaction({
                date,
                itemType: 'PRODUCT',
                itemId: prod.product_id,
                transactionType: 'PRODUCTION',
                quantityChange: qty, // Positive: increases finished goods
                unitCost: unitProductionCost,
                totalValue: cost,
                batchReference: finalBatchNumber,
                referenceTable: 'production_batches',
                referenceId: batchId,
                notes: `Production Batch ${finalBatchNumber}`,
                createdBy: userId
            });

            // Update cost_price on product if calculated cost is > 0
            if (unitProductionCost > 0) {
                db.prepare(`UPDATE products SET cost_price = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(unitProductionCost, prod.product_id);
            }
        }

        // Insert ingredient usage and decrease ingredient inventory
        const insertUsage = db.prepare(`
            INSERT INTO ingredient_usage (
                usage_number, date, batch_id, batch_reference, product_id, ingredient_id,
                recipe_id, recipe_version, unit, quantity_used, unit_cost, total_cost, no_of_cakes, notes,
                created_by, created_at, updated_at
            ) VALUES (
                @usageNumber, @date, @batchId, @batchReference, @productId, @ingredientId,
                @recipeId, @recipeVersion, @unit, @quantityUsed, @unitCost, @totalCost, @noOfCakes, @notes,
                @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        for (let i = 0; i < ingredientsUsed.length; i++) {
            const iu = ingredientsUsed[i];
            const usageNum = `USG-${date.replace(/-/g, '')}-${batchId}-${i + 1}`;
            const qtyUsed = Number(iu.quantity_used);

            insertUsage.run({
                usageNumber: usageNum,
                date,
                batchId,
                batchReference: finalBatchNumber,
                productId: iu.product_id || (productsProduced[0] ? productsProduced[0].product_id : null),
                ingredientId: iu.ingredient_id,
                recipeId: activeRecipe ? activeRecipe.id : null,
                recipeVersion: activeRecipe ? `V${activeRecipe.version}` : null,
                unit: iu.unit || 'kg',
                quantityUsed: qtyUsed,
                unitCost: iu.calculatedUnitCost || 0,
                totalCost: iu.calculatedTotalCost || 0,
                noOfCakes: Number(iu.no_of_cakes) || totalCakesProduced,
                notes: iu.notes || '',
                createdBy: userId || null
            });

            // Decrease ingredient inventory in ledger
            recordInventoryTransaction({
                date,
                itemType: 'INGREDIENT',
                itemId: iu.ingredient_id,
                transactionType: 'PRODUCTION_USAGE',
                quantityChange: -qtyUsed, // Negative: consumes ingredient
                unitCost: iu.calculatedUnitCost || 0,
                totalValue: iu.calculatedTotalCost || 0,
                batchReference: finalBatchNumber,
                referenceTable: 'ingredient_usage',
                referenceId: batchId,
                notes: `Consumed for Batch ${finalBatchNumber}`,
                createdBy: userId
            });
        }

        // If worker assigned, record worker production performance
        if (workerName && totalCakesProduced > 0) {
            const kgPerHour = productionHours > 0 ? (totalCakesProduced / productionHours) : 0;
            const eightKgUnits = totalCakesProduced / 8; // Requirement 14 & Excel formula
            const prodName = productsProduced[0]
                ? db.prepare('SELECT name FROM products WHERE id = ?').get(productsProduced[0].product_id)?.name
                : 'Cakes';

            const wRecNum = `WKP-${date.replace(/-/g, '')}-${batchId}`;
            db.prepare(`
                INSERT INTO worker_production (
                    record_number, date, worker_id, worker_name, product_id, product_name,
                    quantity_produced, production_hours, kg_per_hour, eight_kg_units,
                    batch_reference, notes, created_by, created_at, updated_at
                ) VALUES (
                    @recordNumber, @date, @workerId, @workerName, @productId, @productName,
                    @quantityProduced, @productionHours, @kgPerHour, @eightKgUnits,
                    @batchReference, @notes, @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
                )
            `).run({
                recordNumber: wRecNum,
                date,
                workerId,
                workerName,
                productId: productsProduced[0] ? productsProduced[0].product_id : null,
                productName: prodName || 'Bakery Item',
                quantityProduced: totalCakesProduced,
                productionHours,
                kgPerHour,
                eightKgUnits,
                batchReference: finalBatchNumber,
                notes: data.notes || '',
                createdBy: userId || null
            });
        }

        // Audit entry
        logAction({
            userId,
            username,
            action: 'PRODUCTION_CREATED',
            tableName: 'production_batches',
            recordId: batchId,
            newValues: { batchNumber: finalBatchNumber, date, productsProduced, totalBatchCost, warnings },
            details: `Created production batch ${finalBatchNumber} (${totalCakesProduced} cakes)`
        });

        const createdBatch = getBatchById(batchId);
        return {
            ...createdBatch,
            warnings
        };
    })();
}

// Record standalone ingredient usage (based on 'Ingredients Used' sheet)
function createIngredientUsage(data, userId, username) {
    return transaction(() => {
        const date = data.date || new Date().toISOString().split('T')[0];
        const batchRef = (data.batch_reference || data.batch || '').trim() || null;

        let productId = data.product_id || null;
        const pName = data.product_name || data.cake_type || data['Cake Type'];
        if (!productId && pName) {
            const pRow = db.prepare(`SELECT id FROM products WHERE LOWER(name) = LOWER(?)`).get(pName.trim());
            if (pRow) {
                productId = pRow.id;
            } else {
                const countP = db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
                const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                const pRes = db.prepare(`
                    INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_by, created_at, updated_at)
                    VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(pCode, pName.trim(), userId);
                productId = pRes.lastInsertRowid;
            }
        }

        let ingredientId = data.ingredient_id || null;
        const ingName = data.ingredient_name || data.ingredient;
        if (!ingredientId && ingName) {
            const iRow = db.prepare(`SELECT id, unit FROM ingredients WHERE LOWER(name) = LOWER(?)`).get(ingName.trim());
            if (iRow) {
                ingredientId = iRow.id;
            } else {
                const countI = db.prepare(`SELECT COUNT(*) as c FROM ingredients`).get().c;
                const iCode = 'ING-' + String(countI + 1).padStart(3, '0');
                const iRes = db.prepare(`
                    INSERT INTO ingredients (ingredient_code, name, unit, min_stock_level, active, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, 10, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(iCode, ingName.trim(), data.unit || 'kg', userId);
                ingredientId = iRes.lastInsertRowid;
            }
        }

        const qtyUsed = Number(data.quantity_used || data.quantity) || 0;
        if (qtyUsed <= 0) throw new Error('Quantity used must be greater than zero');

        const stockInfo = getIngredientStock(ingredientId);

        // Check negative inventory setting
        const allowNegSetting = db.prepare(`SELECT value FROM system_settings WHERE key = 'allow_negative_inventory'`).get();
        const allowNegative = allowNegSetting ? allowNegSetting.value === 'true' : true;

        let warning = null;
        if (stockInfo.balance < qtyUsed) {
            warning = `Insufficient stock: Available ${stockInfo.balance}, Required ${qtyUsed}`;
            if (!allowNegative && !data.override_negative_stock) {
                throw new Error(warning + '. Negative inventory is not permitted.');
            }
        }

        const unitCost = stockInfo.averageCost || 0;
        const totalCost = qtyUsed * unitCost;
        const noOfCakes = Number(data.no_of_cakes || data.no_cakes) || 0;

        const countUsage = db.prepare(`SELECT COUNT(*) as c FROM ingredient_usage WHERE date = ?`).get(date).c;
        const usageNum = `USG-${date.replace(/-/g, '')}-${String(countUsage + 1).padStart(3, '0')}`;

        const insertStmt = db.prepare(`
            INSERT INTO ingredient_usage (
                usage_number, date, batch_reference, product_id, ingredient_id,
                unit, quantity_used, unit_cost, total_cost, no_of_cakes, notes,
                created_by, created_at, updated_at
            ) VALUES (
                @usageNumber, @date, @batchReference, @productId, @ingredientId,
                @unit, @quantityUsed, @unitCost, @totalCost, @noOfCakes, @notes,
                @createdBy, datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const info = insertStmt.run({
            usageNumber: usageNum,
            date,
            batchReference: batchRef,
            productId,
            ingredientId,
            unit: data.unit || 'kg',
            quantityUsed: qtyUsed,
            unitCost,
            totalCost,
            noOfCakes,
            notes: data.notes || '',
            createdBy: userId || null
        });

        const usageId = info.lastInsertRowid;

        // Ledger deduction
        recordInventoryTransaction({
            date,
            itemType: 'INGREDIENT',
            itemId: ingredientId,
            transactionType: 'USAGE',
            quantityChange: -qtyUsed,
            unitCost,
            totalValue: totalCost,
            batchReference: batchRef,
            referenceTable: 'ingredient_usage',
            referenceId: usageId,
            notes: `Usage for ${pName || 'Product'} (Ref: ${batchRef || usageNum})`,
            createdBy: userId
        });

        logAction({
            userId,
            username,
            action: 'INGREDIENT_USAGE_RECORDED',
            tableName: 'ingredient_usage',
            recordId: usageId,
            newValues: { usageNum, date, ingredientId, qtyUsed, batchRef },
            details: `Recorded usage of ${qtyUsed} for ${pName || 'Production'}`
        });

        return {
            id: usageId,
            usage_number: usageNum,
            warning
        };
    })();
}

function getAllIngredientUsage({ search = '', startDate = '', endDate = '', limit = 100, offset = 0 } = {}) {
    let where = [];
    let params = {};

    if (search) {
        where.push('(iu.usage_number LIKE @search OR iu.batch_reference LIKE @search OR ing.name LIKE @search OR p.name LIKE @search)');
        params.search = `%${search}%`;
    }
    if (startDate) {
        where.push('iu.date >= @startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        where.push('iu.date <= @endDate');
        params.endDate = endDate;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`
        SELECT COUNT(*) as total 
        FROM ingredient_usage iu
        JOIN ingredients ing ON iu.ingredient_id = ing.id
        LEFT JOIN products p ON iu.product_id = p.id
        ${whereClause}
    `).get(params).total;

    const query = db.prepare(`
        SELECT 
            iu.*,
            ing.name as ingredient_name,
            p.name as product_name,
            u.full_name as created_by_name
        FROM ingredient_usage iu
        JOIN ingredients ing ON iu.ingredient_id = ing.id
        LEFT JOIN products p ON iu.product_id = p.id
        LEFT JOIN users u ON iu.created_by = u.id
        ${whereClause}
        ORDER BY iu.date DESC, iu.id DESC
        LIMIT @limit OFFSET @offset
    `);

    const records = query.all({ ...params, limit, offset });
    return { total, records };
}

module.exports = {
    getAllBatches,
    getBatchById,
    createProduction,
    createIngredientUsage,
    getAllIngredientUsage
};
