const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { db, transaction } = require('../database/db');
const { recordInventoryTransaction } = require('./inventoryService');
const { logAction } = require('./auditService');

// Helper to format or parse Excel date values
function parseExcelDate(val, defaultDate) {
    if (!val || String(val).trim() === '') {
        return { date: defaultDate, isDefault: true };
    }
    if (typeof val === 'number') {
        // Excel serial date number
        const dateObj = xlsx.SSF.parse_date_code(val);
        if (dateObj) {
            const y = dateObj.y;
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            return { date: `${y}-${m}-${d}`, isDefault: false };
        }
    }
    const str = String(val).trim();
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return { date: parsed.toISOString().split('T')[0], isDefault: false };
    }
    return { date: defaultDate, isDefault: true };
}

function importWorkbook(filePathOrBuffer, { defaultDate = new Date().toISOString().split('T')[0], dryRun = false, userId = null, username = 'ADMIN' } = {}) {
    let workbook;
    if (Buffer.isBuffer(filePathOrBuffer)) {
        workbook = xlsx.read(filePathOrBuffer, { type: 'buffer' });
    } else {
        workbook = xlsx.readFile(filePathOrBuffer);
    }

    const summary = {
        dryRun,
        totalSheets: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
        recordsImported: 0,
        recordsSkipped: 0,
        validationErrors: [],
        warnings: [],
        duplicates: 0,
        breakdown: {
            products: { imported: 0, skipped: 0 },
            ingredients: { imported: 0, skipped: 0 },
            purchases: { imported: 0, skipped: 0 },
            ingredientUsage: { imported: 0, skipped: 0 },
            production: { imported: 0, skipped: 0 },
            sales: { imported: 0, skipped: 0 },
            workers: { imported: 0, skipped: 0 },
            returns: { imported: 0, skipped: 0 },
            damages: { imported: 0, skipped: 0 },
            customers: { imported: 0, skipped: 0 }
        }
    };

    const runImport = () => {
        // 1. PRODUCTS & INGREDIENTS DISCOVERY & CREATION
        // Extract known products from 'Cake Balance' or 'Production' or 'Sales'
        const productMap = new Map(); // name.toLowerCase() -> id
        // Load existing products
        db.prepare('SELECT id, name, selling_price, cost_price FROM products').all().forEach(p => {
            productMap.set(p.name.toLowerCase().trim(), p.id);
        });

        const ingredientMap = new Map(); // name.toLowerCase() -> { id, unit }
        // Load existing ingredients
        db.prepare('SELECT id, name, unit FROM ingredients').all().forEach(i => {
            ingredientMap.set(i.name.toLowerCase().trim(), { id: i.id, unit: i.unit });
        });

        const workerMap = new Map(); // name.toLowerCase() -> id
        db.prepare('SELECT id, name FROM workers').all().forEach(w => {
            workerMap.set(w.name.toLowerCase().trim(), w.id);
        });

        const customerMap = new Map(); // name.toLowerCase() -> id
        db.prepare('SELECT id, name FROM customers').all().forEach(c => {
            customerMap.set(c.name.toLowerCase().trim(), c.id);
        });

        // 2. PARSE 'Ingredients In(Purchases)'
        const purchasesSheet = workbook.Sheets['Ingredients In(Purchases)'];
        if (purchasesSheet) {
            const rows = xlsx.utils.sheet_to_json(purchasesSheet, { header: 1, defval: '' });
            // Header is row 0: ['Date', 'Ingredient', 'Unit', 'Quantity In', 'Cost/Unit', 'Total Cost', 'Supplier', 'Batch/Reference']
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const ingName = String(row[1] || '').trim();
                const unit = String(row[2] || '').trim() || 'kg';
                const qtyVal = row[3];
                const costVal = row[4];
                const supplier = String(row[6] || '').trim() || null;
                const batchRef = String(row[7] || '').trim() || 'B0001';

                if (!ingName) {
                    continue; // empty row
                }

                // If quantity or cost is empty or zero
                const qty = Number(qtyVal);
                const costPerUnit = Number(costVal);

                if (!qtyVal && !costVal) {
                    summary.recordsSkipped++;
                    summary.breakdown.purchases.skipped++;
                    summary.warnings.push({
                        sheet: 'Ingredients In(Purchases)',
                        row: r + 1,
                        message: `Skipped ingredient "${ingName}" (Batch: ${batchRef}): Quantity and Cost are empty.`
                    });
                    continue;
                }

                if (isNaN(qty) || qty <= 0) {
                    summary.validationErrors.push({
                        sheet: 'Ingredients In(Purchases)',
                        row: r + 1,
                        message: `Invalid quantity "${qtyVal}" for ingredient "${ingName}".`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.purchases.skipped++;
                    continue;
                }

                if (isNaN(costPerUnit) || costPerUnit < 0) {
                    summary.validationErrors.push({
                        sheet: 'Ingredients In(Purchases)',
                        row: r + 1,
                        message: `Invalid cost per unit "${costVal}" for ingredient "${ingName}".`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.purchases.skipped++;
                    continue;
                }

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                if (dateInfo.isDefault) {
                    summary.warnings.push({
                        sheet: 'Ingredients In(Purchases)',
                        row: r + 1,
                        message: `Date was empty for purchase "${ingName}". Defaulted to ${defaultDate}.`
                    });
                }

                // Ensure ingredient exists
                let ingObj = ingredientMap.get(ingName.toLowerCase());
                if (!ingObj) {
                    const count = db.prepare('SELECT COUNT(*) as c FROM ingredients').get().c;
                    const ingCode = 'ING-' + String(count + 1).padStart(3, '0');
                    const res = db.prepare(`
                        INSERT INTO ingredients (ingredient_code, name, unit, min_stock_level, active, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, 10, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(ingCode, ingName, unit, userId);
                    ingObj = { id: res.lastInsertRowid, unit };
                    ingredientMap.set(ingName.toLowerCase(), ingObj);
                    summary.breakdown.ingredients.imported++;
                }

                const totalCost = qty * costPerUnit;

                // Check duplicate purchase
                const existing = db.prepare(`
                    SELECT pi.id FROM purchase_items pi
                    JOIN purchases p ON pi.purchase_id = p.id
                    WHERE p.date = ? AND pi.ingredient_id = ? AND pi.quantity = ? AND pi.batch_reference = ?
                `).get(dateInfo.date, ingObj.id, qty, batchRef);

                if (existing) {
                    summary.duplicates++;
                    summary.recordsSkipped++;
                    summary.breakdown.purchases.skipped++;
                    continue;
                }

                // Insert purchase header & item
                const purCount = db.prepare('SELECT COUNT(*) as c FROM purchases WHERE date = ?').get(dateInfo.date).c;
                const purNum = `PUR-${dateInfo.date.replace(/-/g, '')}-${String(purCount + 1).padStart(3, '0')}`;

                const pInfo = db.prepare(`
                    INSERT INTO purchases (purchase_number, date, supplier_name, batch_reference, total_amount, payment_status, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'PAID', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(purNum, dateInfo.date, supplier, batchRef, totalCost, userId);

                const purchaseId = pInfo.lastInsertRowid;

                db.prepare(`
                    INSERT INTO purchase_items (purchase_id, ingredient_id, unit, quantity, cost_per_unit, total_cost, batch_reference, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                `).run(purchaseId, ingObj.id, unit, qty, costPerUnit, totalCost, batchRef);

                // Add inventory ledger record
                recordInventoryTransaction({
                    date: dateInfo.date,
                    itemType: 'INGREDIENT',
                    itemId: ingObj.id,
                    transactionType: 'PURCHASE',
                    quantityChange: qty,
                    unitCost: costPerUnit,
                    totalValue: totalCost,
                    batchReference: batchRef,
                    referenceTable: 'purchases',
                    referenceId: purchaseId,
                    notes: `Imported purchase of ${ingName}`,
                    createdBy: userId
                });

                summary.recordsImported++;
                summary.breakdown.purchases.imported++;
            }
        }

        // 3. PARSE 'Ingredients Used'
        const usedSheet = workbook.Sheets['Ingredients Used'];
        if (usedSheet) {
            const rows = xlsx.utils.sheet_to_json(usedSheet, { header: 1, defval: '' });
            // ['Date', 'Cake Type', 'Ingredient', 'Unit', 'Quantity Used', 'No. of Cakes', 'Batch/Reference', 'Notes']
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const cakeType = String(row[1] || '').trim();
                const ingName = String(row[2] || '').trim();
                const unit = String(row[3] || '').trim() || 'kg';
                const qtyVal = row[4];
                const noOfCakes = Number(row[5]) || 0;
                const batchRef = String(row[6] || '').trim() || 'B0001';
                const notes = String(row[7] || '').trim();

                if (!ingName) continue;

                const qtyUsed = Number(qtyVal);
                if (isNaN(qtyUsed) || qtyUsed <= 0) {
                    summary.validationErrors.push({
                        sheet: 'Ingredients Used',
                        row: r + 1,
                        message: `Invalid quantity used "${qtyVal}" for ${ingName}.`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.ingredientUsage.skipped++;
                    continue;
                }

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                if (dateInfo.isDefault) {
                    summary.warnings.push({
                        sheet: 'Ingredients Used',
                        row: r + 1,
                        message: `Date was empty for ingredient usage "${ingName}". Defaulted to ${defaultDate}.`
                    });
                }

                // Ensure cake product exists
                let prodId = null;
                if (cakeType) {
                    prodId = productMap.get(cakeType.toLowerCase());
                    if (!prodId) {
                        const countP = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
                        const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                        const resP = db.prepare(`
                            INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_by, created_at, updated_at)
                            VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                        `).run(pCode, cakeType, userId);
                        prodId = resP.lastInsertRowid;
                        productMap.set(cakeType.toLowerCase(), prodId);
                        summary.breakdown.products.imported++;
                    }
                }

                // Ensure ingredient exists
                let ingObj = ingredientMap.get(ingName.toLowerCase());
                if (!ingObj) {
                    const countI = db.prepare('SELECT COUNT(*) as c FROM ingredients').get().c;
                    const iCode = 'ING-' + String(countI + 1).padStart(3, '0');
                    const resI = db.prepare(`
                        INSERT INTO ingredients (ingredient_code, name, unit, min_stock_level, active, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, 10, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(iCode, ingName, unit, userId);
                    ingObj = { id: resI.lastInsertRowid, unit };
                    ingredientMap.set(ingName.toLowerCase(), ingObj);
                    summary.breakdown.ingredients.imported++;
                }

                // Check duplicate
                const dup = db.prepare(`
                    SELECT id FROM ingredient_usage
                    WHERE date = ? AND ingredient_id = ? AND quantity_used = ? AND batch_reference = ?
                `).get(dateInfo.date, ingObj.id, qtyUsed, batchRef);

                if (dup) {
                    summary.duplicates++;
                    summary.recordsSkipped++;
                    summary.breakdown.ingredientUsage.skipped++;
                    continue;
                }

                // Unit cost from purchases
                const avgRow = db.prepare(`
                    SELECT COALESCE(SUM(total_value) / NULLIF(SUM(quantity_change), 0), 0) as avg_cost
                    FROM inventory_transactions
                    WHERE item_type = 'INGREDIENT' AND item_id = ? AND transaction_type = 'PURCHASE'
                `).get(ingObj.id);

                const unitCost = avgRow ? avgRow.avg_cost : 0;
                const totalCost = qtyUsed * unitCost;

                const countU = db.prepare('SELECT COUNT(*) as c FROM ingredient_usage WHERE date = ?').get(dateInfo.date).c;
                const usageNum = `USG-${dateInfo.date.replace(/-/g, '')}-${String(countU + 1).padStart(3, '0')}`;

                const uInfo = db.prepare(`
                    INSERT INTO ingredient_usage (
                        usage_number, date, batch_reference, product_id, ingredient_id, unit,
                        quantity_used, unit_cost, total_cost, no_of_cakes, notes, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(usageNum, dateInfo.date, batchRef, prodId, ingObj.id, unit, qtyUsed, unitCost, totalCost, noOfCakes, notes, userId);

                // Deduct from inventory ledger
                recordInventoryTransaction({
                    date: dateInfo.date,
                    itemType: 'INGREDIENT',
                    itemId: ingObj.id,
                    transactionType: 'USAGE',
                    quantityChange: -qtyUsed,
                    unitCost,
                    totalValue: totalCost,
                    batchReference: batchRef,
                    referenceTable: 'ingredient_usage',
                    referenceId: uInfo.lastInsertRowid,
                    notes: `Usage for ${cakeType || 'Production'} (Batch ${batchRef})`,
                    createdBy: userId
                });

                summary.recordsImported++;
                summary.breakdown.ingredientUsage.imported++;
            }
        }

        // 4. PARSE 'Production'
        const prodSheet = workbook.Sheets['Production'];
        if (prodSheet) {
            const rows = xlsx.utils.sheet_to_json(prodSheet, { header: 1, defval: '' });
            // ['Date', 'Product', 'Batch', 'Quantity(cake produced)', 'Worker', 'Production Hours', 'Notes']
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const prodName = String(row[1] || '').trim();
                const batch = String(row[2] || '').trim() || 'B0001';
                const qtyVal = row[3];
                const worker = String(row[4] || '').trim() || null;
                const hours = Number(row[5]) || 0;
                const notes = String(row[6] || '').trim();

                if (!prodName) continue;

                const qty = Number(qtyVal);
                if (isNaN(qty) || qty <= 0) {
                    summary.validationErrors.push({
                        sheet: 'Production',
                        row: r + 1,
                        message: `Invalid production quantity "${qtyVal}" for "${prodName}".`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.production.skipped++;
                    continue;
                }

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                if (dateInfo.isDefault) {
                    summary.warnings.push({
                        sheet: 'Production',
                        row: r + 1,
                        message: `Date was empty for production "${prodName}". Defaulted to ${defaultDate}.`
                    });
                }

                // Ensure product exists
                let prodId = productMap.get(prodName.toLowerCase());
                if (!prodId) {
                    const countP = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
                    const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                    const resP = db.prepare(`
                        INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_by, created_at, updated_at)
                        VALUES (?, ?, 'Cakes', 'pcs', 0, 0, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(pCode, prodName, userId);
                    prodId = resP.lastInsertRowid;
                    productMap.set(prodName.toLowerCase(), prodId);
                    summary.breakdown.products.imported++;
                }

                // Check duplicate production
                const dup = db.prepare(`
                    SELECT pi.id FROM production_items pi
                    JOIN production_batches pb ON pi.batch_id = pb.id
                    WHERE pb.date = ? AND pi.product_id = ? AND pi.quantity_produced = ? AND pb.batch_number = ?
                `).get(dateInfo.date, prodId, qty, batch);

                if (dup) {
                    summary.duplicates++;
                    summary.recordsSkipped++;
                    summary.breakdown.production.skipped++;
                    continue;
                }

                // Calculate batch ingredient cost for this product/batch if any
                const costRow = db.prepare(`
                    SELECT COALESCE(SUM(total_cost), 0) as cost
                    FROM ingredient_usage
                    WHERE batch_reference = ? AND (product_id = ? OR product_id IS NULL)
                `).get(batch, prodId);
                const totalCost = costRow ? costRow.cost : 0;
                const unitCost = qty > 0 ? (totalCost / qty) : 0;

                // Create or find production batch
                let batchObj = db.prepare(`SELECT id FROM production_batches WHERE batch_number = ? AND date = ?`).get(batch, dateInfo.date);
                let batchId;
                if (batchObj) {
                    batchId = batchObj.id;
                } else {
                    const bInfo = db.prepare(`
                        INSERT INTO production_batches (batch_number, date, status, worker_name, production_hours, total_cost, notes, created_by, created_at, updated_at)
                        VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(batch, dateInfo.date, worker, hours, totalCost, notes, userId);
                    batchId = bInfo.lastInsertRowid;
                }

                db.prepare(`
                    INSERT INTO production_items (batch_id, product_id, quantity_produced, unit_cost, total_cost, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                `).run(batchId, prodId, qty, unitCost, totalCost, notes);

                // Inventory ledger: Add finished goods
                recordInventoryTransaction({
                    date: dateInfo.date,
                    itemType: 'PRODUCT',
                    itemId: prodId,
                    transactionType: 'PRODUCTION',
                    quantityChange: qty, // Positive
                    unitCost,
                    totalValue: totalCost,
                    batchReference: batch,
                    referenceTable: 'production_batches',
                    referenceId: batchId,
                    notes: `Production of ${prodName} (Batch ${batch})`,
                    createdBy: userId
                });

                summary.recordsImported++;
                summary.breakdown.production.imported++;
            }
        }

        // 5. PARSE 'Sales'
        const salesSheet = workbook.Sheets['Sales'];
        if (salesSheet) {
            const rows = xlsx.utils.sheet_to_json(salesSheet, { header: 1, defval: '' });
            // ['Date', 'Product', 'Customer', 'Quantity Sold', 'Selling Price/Cake', 'Sales Amount', 'Payment Status', 'Reference']
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const prodName = String(row[1] || '').trim();
                const custName = String(row[2] || '').trim() || 'Walk-in Customer';
                const qtyVal = row[3];
                const priceVal = row[4];
                const payStatus = String(row[6] || '').trim().toUpperCase() || 'PAID';
                const ref = String(row[7] || '').trim() || null;

                if (!prodName) continue;

                const qty = Number(qtyVal);
                const price = Number(priceVal);

                if (isNaN(qty) || qty <= 0) {
                    summary.validationErrors.push({
                        sheet: 'Sales',
                        row: r + 1,
                        message: `Invalid quantity sold "${qtyVal}" for "${prodName}".`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.sales.skipped++;
                    continue;
                }

                if (isNaN(price) || price < 0) {
                    summary.validationErrors.push({
                        sheet: 'Sales',
                        row: r + 1,
                        message: `Invalid selling price "${priceVal}" for "${prodName}".`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.sales.skipped++;
                    continue;
                }

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                if (dateInfo.isDefault) {
                    summary.warnings.push({
                        sheet: 'Sales',
                        row: r + 1,
                        message: `Date was empty for sale of "${prodName}". Defaulted to ${defaultDate}.`
                    });
                }

                // Ensure product exists & update selling_price if needed
                let prodId = productMap.get(prodName.toLowerCase());
                if (!prodId) {
                    const countP = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
                    const pCode = 'PRD-' + String(countP + 1).padStart(3, '0');
                    const resP = db.prepare(`
                        INSERT INTO products (product_code, name, category, unit, selling_price, cost_price, active, created_by, created_at, updated_at)
                        VALUES (?, ?, 'Cakes', 'pcs', ?, 0, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(pCode, prodName, price, userId);
                    prodId = resP.lastInsertRowid;
                    productMap.set(prodName.toLowerCase(), prodId);
                    summary.breakdown.products.imported++;
                } else if (price > 0) {
                    db.prepare('UPDATE products SET selling_price = ? WHERE id = ?').run(price, prodId);
                }

                // Customer resolution
                let custId = null;
                if (custName && custName !== 'Walk-in Customer') {
                    custId = customerMap.get(custName.toLowerCase());
                    if (!custId) {
                        const countC = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
                        const cCode = 'CUST-' + String(countC + 1).padStart(3, '0');
                        const resC = db.prepare(`
                            INSERT INTO customers (customer_code, name, phone, location, opening_balance, credit_limit, active, created_at, updated_at)
                            VALUES (?, ?, '', '', 0, 0, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                        `).run(cCode, custName);
                        custId = resC.lastInsertRowid;
                        customerMap.set(custName.toLowerCase(), custId);
                        summary.breakdown.customers.imported++;
                    }
                }

                // Check duplicate sale
                const dup = db.prepare(`
                    SELECT si.id FROM sale_items si
                    JOIN sales s ON si.sale_id = s.id
                    WHERE s.date = ? AND si.product_id = ? AND si.quantity = ? AND si.selling_price = ?
                `).get(dateInfo.date, prodId, qty, price);

                if (dup) {
                    summary.duplicates++;
                    summary.recordsSkipped++;
                    summary.breakdown.sales.skipped++;
                    continue;
                }

                const subtotal = qty * price;
                const saleCount = db.prepare('SELECT COUNT(*) as c FROM sales WHERE date = ?').get(dateInfo.date).c;
                const invNum = `INV-${dateInfo.date.replace(/-/g, '')}-${String(saleCount + 1).padStart(3, '0')}`;

                const sInfo = db.prepare(`
                    INSERT INTO sales (
                        invoice_number, date, customer_id, customer_name, total_amount, payment_status,
                        payment_method, amount_paid, reference, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'Cash', ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(invNum, dateInfo.date, custId, custName, subtotal, payStatus, payStatus === 'PAID' ? subtotal : 0, ref, userId);

                const saleId = sInfo.lastInsertRowid;

                db.prepare(`
                    INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, subtotal, unit_cost, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))
                `).run(saleId, prodId, qty, price, subtotal);

                // Deduct finished cake inventory
                recordInventoryTransaction({
                    date: dateInfo.date,
                    itemType: 'PRODUCT',
                    itemId: prodId,
                    transactionType: 'SALE',
                    quantityChange: -qty, // Negative
                    unitCost: 0,
                    totalValue: 0,
                    batchReference: ref || invNum,
                    referenceTable: 'sales',
                    referenceId: saleId,
                    notes: `Sale to ${custName} (${invNum})`,
                    createdBy: userId
                });

                summary.recordsImported++;
                summary.breakdown.sales.imported++;
            }
        }

        // 6. PARSE 'Worker Production'
        const workerSheet = workbook.Sheets['Worker Production'];
        if (workerSheet) {
            const rows = xlsx.utils.sheet_to_json(workerSheet, { header: 1, defval: '' });
            // ['Date', 'Worker', 'Product', 'Quantity Produced', 'Production Hours', 'KG/Hour', '8KG Units']
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const workerName = String(row[1] || '').trim();
                const prodName = String(row[2] || '').trim();
                const qtyVal = row[3];
                const hoursVal = row[4];

                if (!workerName && !prodName) continue;

                const qty = Number(qtyVal);
                const hours = Number(hoursVal) || 0;

                if (isNaN(qty) || qty <= 0) {
                    summary.validationErrors.push({
                        sheet: 'Worker Production',
                        row: r + 1,
                        message: `Invalid quantity produced "${qtyVal}" for worker "${workerName}".`
                    });
                    summary.recordsSkipped++;
                    summary.breakdown.workers.skipped++;
                    continue;
                }

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                if (dateInfo.isDefault) {
                    summary.warnings.push({
                        sheet: 'Worker Production',
                        row: r + 1,
                        message: `Date was empty for worker "${workerName}". Defaulted to ${defaultDate}.`
                    });
                }

                let workerId = workerMap.get(workerName.toLowerCase());
                if (!workerId) {
                    const countW = db.prepare('SELECT COUNT(*) as c FROM workers').get().c;
                    const wCode = 'WRK-' + String(countW + 1).padStart(3, '0');
                    const resW = db.prepare(`
                        INSERT INTO workers (worker_code, name, role, active, created_at, updated_at)
                        VALUES (?, ?, 'Baker', 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(wCode, workerName);
                    workerId = resW.lastInsertRowid;
                    workerMap.set(workerName.toLowerCase(), workerId);
                    summary.breakdown.workers.imported++;
                }

                let prodId = productMap.get(prodName.toLowerCase()) || null;

                const kgPerHour = hours > 0 ? (qty / hours) : 0;
                const eightKgUnits = qty / 8; // Excel formula

                const wCount = db.prepare('SELECT COUNT(*) as c FROM worker_production WHERE date = ?').get(dateInfo.date).c;
                const recNum = `WKP-${dateInfo.date.replace(/-/g, '')}-${String(wCount + 1).padStart(3, '0')}`;

                db.prepare(`
                    INSERT INTO worker_production (
                        record_number, date, worker_id, worker_name, product_id, product_name,
                        quantity_produced, production_hours, kg_per_hour, eight_kg_units, notes, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(recNum, dateInfo.date, workerId, workerName, prodId, prodName, qty, hours, kgPerHour, eightKgUnits, userId);

                summary.recordsImported++;
                summary.breakdown.workers.imported++;
            }
        }

        // 7. PARSE 'Customer Management' (if any rows present)
        const custSheet = workbook.Sheets['Customer Management'];
        if (custSheet) {
            const rows = xlsx.utils.sheet_to_json(custSheet, { header: 1, defval: '' });
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const custCode = String(row[0] || '').trim();
                const custName = String(row[1] || '').trim();
                const phone = String(row[2] || '').trim();
                const location = String(row[3] || '').trim();
                const openBal = Number(row[4]) || 0;
                const creditLimit = Number(row[5]) || 0;

                if (!custName) continue;

                if (!customerMap.has(custName.toLowerCase())) {
                    const countC = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
                    const code = custCode || ('CUST-' + String(countC + 1).padStart(3, '0'));
                    const resC = db.prepare(`
                        INSERT INTO customers (customer_code, name, phone, location, opening_balance, credit_limit, active, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
                    `).run(code, custName, phone, location, openBal, creditLimit);
                    customerMap.set(custName.toLowerCase(), resC.lastInsertRowid);
                    summary.recordsImported++;
                    summary.breakdown.customers.imported++;
                }
            }
        }

        // 8. PARSE 'Sales Returns' (if any rows present)
        const retSheet = workbook.Sheets['Sales Returns'];
        if (retSheet) {
            const rows = xlsx.utils.sheet_to_json(retSheet, { header: 1, defval: '' });
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const custName = String(row[1] || '').trim();
                const invNum = String(row[2] || '').trim();
                const prodName = String(row[3] || '').trim();
                const qtyVal = row[4];
                const costVal = row[5];
                const reason = String(row[7] || '').trim();

                if (!prodName) continue;
                const qty = Number(qtyVal);
                const unitCost = Number(costVal) || 0;
                if (isNaN(qty) || qty <= 0) continue;

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                const prodId = productMap.get(prodName.toLowerCase());
                if (!prodId) continue;

                const retVal = qty * unitCost;
                const retCount = db.prepare('SELECT COUNT(*) as c FROM sales_returns WHERE date = ?').get(dateInfo.date).c;
                const retNum = `RET-${dateInfo.date.replace(/-/g, '')}-${String(retCount + 1).padStart(3, '0')}`;

                const rInfo = db.prepare(`
                    INSERT INTO sales_returns (return_number, date, customer_name, invoice_number, total_return_value, reason, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(retNum, dateInfo.date, custName, invNum, retVal, reason, userId);

                db.prepare(`
                    INSERT INTO sales_return_items (return_id, product_id, quantity, unit_cost, return_value, reason, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                `).run(rInfo.lastInsertRowid, prodId, qty, unitCost, retVal, reason);

                recordInventoryTransaction({
                    date: dateInfo.date,
                    itemType: 'PRODUCT',
                    itemId: prodId,
                    transactionType: 'SALE_RETURN',
                    quantityChange: qty,
                    unitCost,
                    totalValue: retVal,
                    batchReference: invNum || retNum,
                    referenceTable: 'sales_returns',
                    referenceId: rInfo.lastInsertRowid,
                    notes: `Imported Return: ${reason}`,
                    createdBy: userId
                });

                summary.recordsImported++;
                summary.breakdown.returns.imported++;
            }
        }

        // 9. PARSE 'Sales Damages' (if any rows present)
        const dmgSheet = workbook.Sheets['Sales Damages'];
        if (dmgSheet) {
            const rows = xlsx.utils.sheet_to_json(dmgSheet, { header: 1, defval: '' });
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const rawDate = row[0];
                const prodName = String(row[1] || '').trim();
                const qtyVal = row[2];
                const costVal = row[3];
                const reason = String(row[5] || '').trim();
                const deptWorker = String(row[6] || '').trim();
                const approvedBy = String(row[7] || '').trim();

                if (!prodName) continue;
                const qty = Number(qtyVal);
                const unitCost = Number(costVal) || 0;
                if (isNaN(qty) || qty <= 0) continue;

                const dateInfo = parseExcelDate(rawDate, defaultDate);
                const prodId = productMap.get(prodName.toLowerCase());
                if (!prodId) continue;

                const dmgVal = qty * unitCost;
                const dmgCount = db.prepare('SELECT COUNT(*) as c FROM damages WHERE date = ?').get(dateInfo.date).c;
                const dmgNum = `DMG-${dateInfo.date.replace(/-/g, '')}-${String(dmgCount + 1).padStart(3, '0')}`;

                const dInfo = db.prepare(`
                    INSERT INTO damages (damage_number, date, product_id, quantity, unit_cost, damage_value, reason, department_worker, approved_by, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `).run(dmgNum, dateInfo.date, prodId, qty, unitCost, dmgVal, reason, deptWorker, approvedBy, userId);

                recordInventoryTransaction({
                    date: dateInfo.date,
                    itemType: 'PRODUCT',
                    itemId: prodId,
                    transactionType: 'DAMAGE',
                    quantityChange: -qty,
                    unitCost,
                    totalValue: dmgVal,
                    batchReference: dmgNum,
                    referenceTable: 'damages',
                    referenceId: dInfo.lastInsertRowid,
                    notes: `Imported Damage: ${reason}`,
                    createdBy: userId
                });

                summary.recordsImported++;
                summary.breakdown.damages.imported++;
            }
        }

        if (!dryRun) {
            logAction({
                userId,
                username,
                action: 'EXCEL_MIGRATION_COMPLETED',
                tableName: 'system',
                details: `Imported ${summary.recordsImported} records from Excel workbook.`
            });
        }

        return summary;
    };

    if (dryRun) {
        // Rollback dry-run by wrapping in transaction that throws after collecting summary
        const testTx = db.transaction(() => {
            const res = runImport();
            throw new Error('__DRY_RUN_ROLLBACK__');
        });
        try {
            testTx();
        } catch (e) {
            if (e.message !== '__DRY_RUN_ROLLBACK__') throw e;
        }
        return summary;
    } else {
        return transaction(runImport)();
    }
}

module.exports = {
    importWorkbook
};
