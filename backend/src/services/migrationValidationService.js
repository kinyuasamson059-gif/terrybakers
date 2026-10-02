const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/db');
const { getProductStockSummary, getIngredientStockSummary } = require('./inventoryService');
const { getDailyProfit } = require('./profitService');

function validateMigration(workbookPathOrBuffer) {
    let workbook;
    if (Buffer.isBuffer(workbookPathOrBuffer)) {
        workbook = xlsx.read(workbookPathOrBuffer, { type: 'buffer' });
    } else {
        const filePath = workbookPathOrBuffer || path.resolve(__dirname, '../../../Terry_Bakers_Production_Management_Template.xlsx');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Workbook not found at ${filePath}`);
        }
        workbook = xlsx.readFile(filePath);
    }

    const validationResults = {
        timestamp: new Date().toISOString(),
        overallStatus: 'PASS',
        metrics: [],
        cakeBalances: [],
        ingredientBalances: [],
        discrepancyCount: 0
    };

    // 1. TOTAL SALES
    let excelTotalSales = 0;
    const salesSheet = workbook.Sheets['Sales'];
    if (salesSheet) {
        const rows = xlsx.utils.sheet_to_json(salesSheet, { header: 1, defval: '' });
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const qty = Number(row[3]);
            const price = Number(row[4]);
            if (!isNaN(qty) && !isNaN(price)) {
                excelTotalSales += (qty * price);
            }
        }
    }

    const dbSalesRow = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales').get();
    const dbTotalSales = dbSalesRow ? dbSalesRow.total : 0;
    const salesDiff = Math.abs(excelTotalSales - dbTotalSales);
    const salesStatus = salesDiff < 0.01 ? 'MATCH' : 'DISCREPANCY';
    if (salesStatus !== 'MATCH') validationResults.overallStatus = 'WARNING';

    validationResults.metrics.push({
        category: 'Sales',
        name: 'Total Sales Amount',
        excelValue: excelTotalSales,
        dbValue: dbTotalSales,
        difference: salesDiff,
        status: salesStatus,
        details: salesStatus === 'MATCH' ? 'Exact match' : 'Values differ'
    });

    // 2. PRODUCTION TOTALS
    let excelTotalProduced = 0;
    const prodSheet = workbook.Sheets['Production'];
    if (prodSheet) {
        const rows = xlsx.utils.sheet_to_json(prodSheet, { header: 1, defval: '' });
        for (let r = 1; r < rows.length; r++) {
            const qty = Number(rows[r][3]);
            if (!isNaN(qty) && qty > 0) {
                excelTotalProduced += qty;
            }
        }
    }

    const dbProdRow = db.prepare('SELECT COALESCE(SUM(quantity_produced), 0) as total FROM production_items').get();
    const dbTotalProduced = dbProdRow ? dbProdRow.total : 0;
    const prodDiff = Math.abs(excelTotalProduced - dbTotalProduced);
    const prodStatus = prodDiff < 0.01 ? 'MATCH' : 'DISCREPANCY';
    if (prodStatus !== 'MATCH') validationResults.overallStatus = 'WARNING';

    validationResults.metrics.push({
        category: 'Production',
        name: 'Total Cakes Produced',
        excelValue: excelTotalProduced,
        dbValue: dbTotalProduced,
        difference: prodDiff,
        status: prodStatus,
        details: prodStatus === 'MATCH' ? 'Exact match' : 'Values differ'
    });

    // 3. CAKE BALANCES (Product by Product comparison)
    const cakeBalSheet = workbook.Sheets['Cake Balance'];
    const dbProductSummary = getProductStockSummary();

    if (cakeBalSheet) {
        const rows = xlsx.utils.sheet_to_json(cakeBalSheet, { header: 1, defval: '' });
        // Headers: ['Cake Type', 'Total Produced', 'Total Sold', 'Cakes Balance']
        for (let r = 1; r < rows.length; r++) {
            const cakeName = String(rows[r][0] || '').trim();
            if (!cakeName) continue;
            const excelProduced = Number(rows[r][1]) || 0;
            const excelSold = Number(rows[r][2]) || 0;
            const excelBal = Number(rows[r][3]) || 0;

            const dbMatch = dbProductSummary.find(p => p.productName.toLowerCase().trim() === cakeName.toLowerCase());
            const dbBal = dbMatch ? dbMatch.closing : 0;
            const dbProd = dbMatch ? dbMatch.produced : 0;
            const dbSold = dbMatch ? dbMatch.sold : 0;

            const balDiff = Math.abs(excelBal - dbBal);
            const status = balDiff < 0.01 ? 'MATCH' : 'DISCREPANCY';
            if (status !== 'MATCH') validationResults.discrepancyCount++;

            validationResults.cakeBalances.push({
                productName: cakeName,
                excelProduced,
                dbProduced: dbProd,
                excelSold,
                dbSold,
                excelBalance: excelBal,
                dbBalance: dbBal,
                status
            });
        }
    }

    // 4. INGREDIENTS BALANCES (Ingredient by Ingredient comparison)
    const ingBalSheet = workbook.Sheets['Ingredients Balances'];
    const dbIngredientSummary = getIngredientStockSummary();

    if (ingBalSheet) {
        const rows = xlsx.utils.sheet_to_json(ingBalSheet, { header: 1, defval: '' });
        // Headers: ['Ingredient', 'Unit', 'Total In', 'Total Used', 'Ingredient Balance', 'Total Cost In', 'Average Cost/Unit']
        for (let r = 1; r < rows.length; r++) {
            const ingName = String(rows[r][0] || '').trim();
            if (!ingName) continue;
            const unit = String(rows[r][1] || '').trim();
            const excelIn = Number(rows[r][2]) || 0;
            const excelUsed = Number(rows[r][3]) || 0;
            const excelBal = Number(rows[r][4]) || 0;
            const excelCostIn = Number(rows[r][5]) || 0;
            const excelAvgCost = Number(rows[r][6]) || 0;

            const dbMatch = dbIngredientSummary.find(i => i.name.toLowerCase().trim() === ingName.toLowerCase());
            const dbIn = dbMatch ? dbMatch.purchased : 0;
            const dbUsed = dbMatch ? dbMatch.used : 0;
            const dbBal = dbMatch ? dbMatch.balance : 0;
            const dbAvgCost = dbMatch ? dbMatch.averageCost : 0;

            const balDiff = Math.abs(excelBal - dbBal);
            const status = balDiff < 0.01 ? 'MATCH' : 'DISCREPANCY';
            if (status !== 'MATCH') validationResults.discrepancyCount++;

            validationResults.ingredientBalances.push({
                ingredientName: ingName,
                unit,
                excelIn,
                dbIn,
                excelUsed,
                dbUsed,
                excelBalance: excelBal,
                dbBalance: dbBal,
                excelAvgCost,
                dbAvgCost: Number(dbAvgCost.toFixed(2)),
                status
            });
        }
    }

    // 5. SALES RETURNS
    let excelReturns = 0;
    const retSheet = workbook.Sheets['Sales Returns'];
    if (retSheet) {
        const rows = xlsx.utils.sheet_to_json(retSheet, { header: 1, defval: '' });
        for (let r = 1; r < rows.length; r++) {
            const qty = Number(rows[r][4]);
            const cost = Number(rows[r][5]);
            if (!isNaN(qty) && !isNaN(cost)) excelReturns += (qty * cost);
        }
    }
    const dbReturns = db.prepare('SELECT COALESCE(SUM(total_return_value), 0) as val FROM sales_returns').get().val;
    validationResults.metrics.push({
        category: 'Returns',
        name: 'Total Sales Returns Value',
        excelValue: excelReturns,
        dbValue: dbReturns,
        difference: Math.abs(excelReturns - dbReturns),
        status: Math.abs(excelReturns - dbReturns) < 0.01 ? 'MATCH' : 'DISCREPANCY'
    });

    // 6. DAMAGES
    let excelDamages = 0;
    const dmgSheet = workbook.Sheets['Sales Damages'];
    if (dmgSheet) {
        const rows = xlsx.utils.sheet_to_json(dmgSheet, { header: 1, defval: '' });
        for (let r = 1; r < rows.length; r++) {
            const qty = Number(rows[r][2]);
            const cost = Number(rows[r][3]);
            if (!isNaN(qty) && !isNaN(cost)) excelDamages += (qty * cost);
        }
    }
    const dbDamages = db.prepare('SELECT COALESCE(SUM(damage_value), 0) as val FROM damages').get().val;
    validationResults.metrics.push({
        category: 'Damages',
        name: 'Total Damages Value',
        excelValue: excelDamages,
        dbValue: dbDamages,
        difference: Math.abs(excelDamages - dbDamages),
        status: Math.abs(excelDamages - dbDamages) < 0.01 ? 'MATCH' : 'DISCREPANCY'
    });

    // 7. CUSTOMER BALANCES
    let excelCustBal = 0;
    const custSheet = workbook.Sheets['Customer Management'];
    if (custSheet) {
        const rows = xlsx.utils.sheet_to_json(custSheet, { header: 1, defval: '' });
        for (let r = 1; r < rows.length; r++) {
            const openBal = Number(rows[r][4]) || 0;
            const sales = Number(rows[r][6]) || 0;
            const payments = Number(rows[r][7]) || 0;
            excelCustBal += (openBal + sales - payments);
        }
    }
    // Sum outstanding balances across all registered customers
    const allCustomers = db.prepare('SELECT id, opening_balance FROM customers').all();
    let dbCustBal = 0;
    for (const c of allCustomers) {
        const salesTotal = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE customer_id = ? AND payment_status != 'PAID'").get(c.id).s;
        const payTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as p FROM customer_payments WHERE customer_id = ?").get(c.id).p;
        dbCustBal += (c.opening_balance + salesTotal - payTotal);
    }

    validationResults.metrics.push({
        category: 'Customers',
        name: 'Total Customer Outstanding Balance',
        excelValue: excelCustBal,
        dbValue: dbCustBal,
        difference: Math.abs(excelCustBal - dbCustBal),
        status: Math.abs(excelCustBal - dbCustBal) < 0.01 ? 'MATCH' : 'DISCREPANCY'
    });

    // 8. DAILY PROFIT
    const dbProfit = getDailyProfit();
    validationResults.metrics.push({
        category: 'Profit',
        name: 'Calculated Net Profit',
        excelValue: 0, // Excel sheet was empty in template
        dbValue: dbProfit.summary.netProfit,
        difference: dbProfit.summary.netProfit,
        status: 'INFO',
        details: `Calculated from ${dbProfit.daily.length} days of activity`
    });

    if (validationResults.discrepancyCount > 0) {
        validationResults.overallStatus = 'DISCREPANCY_DETECTED';
    }

    return validationResults;
}

module.exports = {
    validateMigration
};
