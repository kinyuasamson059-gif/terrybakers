const express = require('express');
const router = express.Router();
const { getReport } = require('../services/reportService');
const { createStyledWorkbook } = require('../services/excelExportService');
const { authMiddleware } = require('../middleware/auth');

router.get('/:type', authMiddleware, (req, res) => {
    try {
        const { type } = req.params;
        const report = getReport(type, req.query);
        res.json(report);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:type/export', authMiddleware, async (req, res) => {
    try {
        const { type } = req.params;
        const report = getReport(type, req.query);

        // Derive columns and rows based on report type
        let columns = [];
        let rows = report.rows || [];

        if (type === 'sales') {
            columns = [
                { header: 'Date', key: 'date', width: 14 },
                { header: 'Invoice No.', key: 'invoice_number', width: 16 },
                { header: 'Customer', key: 'customer_name', width: 22 },
                { header: 'Product', key: 'product_name', width: 20 },
                { header: 'Qty', key: 'quantity', width: 10, align: 'right', format: 'number' },
                { header: 'Unit Price', key: 'selling_price', width: 14, align: 'right', format: 'currency' },
                { header: 'Subtotal', key: 'subtotal', width: 14, align: 'right', format: 'currency' },
                { header: 'Payment Status', key: 'payment_status', width: 14 },
                { header: 'Payment Method', key: 'payment_method', width: 14 }
            ];
        } else if (type === 'production') {
            columns = [
                { header: 'Date', key: 'date', width: 14 },
                { header: 'Batch No.', key: 'batch_number', width: 16 },
                { header: 'Product', key: 'product_name', width: 20 },
                { header: 'Quantity Produced', key: 'quantity_produced', width: 16, align: 'right', format: 'number' },
                { header: 'Worker', key: 'worker_name', width: 18 },
                { header: 'Hours', key: 'production_hours', width: 10, align: 'right', format: 'number' },
                { header: 'Unit Cost', key: 'unit_cost', width: 14, align: 'right', format: 'currency' },
                { header: 'Total Cost', key: 'total_cost', width: 14, align: 'right', format: 'currency' }
            ];
        } else if (type === 'ingredient_purchases') {
            columns = [
                { header: 'Date', key: 'date', width: 14 },
                { header: 'Purchase No.', key: 'purchase_number', width: 16 },
                { header: 'Ingredient', key: 'ingredient_name', width: 20 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Quantity', key: 'quantity', width: 12, align: 'right', format: 'number' },
                { header: 'Cost/Unit', key: 'cost_per_unit', width: 14, align: 'right', format: 'currency' },
                { header: 'Total Cost', key: 'total_cost', width: 14, align: 'right', format: 'currency' },
                { header: 'Supplier', key: 'supplier_name', width: 20 },
                { header: 'Batch Ref', key: 'batch_reference', width: 14 }
            ];
        } else if (type === 'ingredient_usage') {
            columns = [
                { header: 'Date', key: 'date', width: 14 },
                { header: 'Batch Ref', key: 'batch_reference', width: 14 },
                { header: 'Product', key: 'product_name', width: 18 },
                { header: 'Ingredient', key: 'ingredient_name', width: 20 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Qty Used', key: 'quantity_used', width: 12, align: 'right', format: 'number' },
                { header: 'Unit Cost', key: 'unit_cost', width: 12, align: 'right', format: 'currency' },
                { header: 'Total Cost', key: 'total_cost', width: 14, align: 'right', format: 'currency' },
                { header: 'Cakes Produced', key: 'no_of_cakes', width: 14, align: 'right', format: 'number' }
            ];
        } else if (type === 'finished_product_inventory') {
            columns = [
                { header: 'Product', key: 'productName', width: 22 },
                { header: 'Opening', key: 'opening', width: 12, align: 'right', format: 'number' },
                { header: 'Produced', key: 'produced', width: 12, align: 'right', format: 'number' },
                { header: 'Sold', key: 'sold', width: 12, align: 'right', format: 'number' },
                { header: 'Returned', key: 'returned', width: 12, align: 'right', format: 'number' },
                { header: 'Damaged', key: 'damaged', width: 12, align: 'right', format: 'number' },
                { header: 'Closing Stock', key: 'closing', width: 14, align: 'right', format: 'number' }
            ];
        } else if (type === 'ingredient_inventory') {
            columns = [
                { header: 'Ingredient', key: 'name', width: 22 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Purchased', key: 'purchased', width: 12, align: 'right', format: 'number' },
                { header: 'Used', key: 'used', width: 12, align: 'right', format: 'number' },
                { header: 'Balance', key: 'balance', width: 12, align: 'right', format: 'number' },
                { header: 'Average Cost', key: 'averageCost', width: 14, align: 'right', format: 'currency' },
                { header: 'Stock Value', key: 'stockValue', width: 14, align: 'right', format: 'currency' }
            ];
        } else if (type === 'daily_profit') {
            columns = [
                { header: 'Date', key: 'date', width: 14 },
                { header: 'Gross Sales', key: 'grossSales', width: 14, align: 'right', format: 'currency' },
                { header: 'Returns', key: 'salesReturns', width: 14, align: 'right', format: 'currency' },
                { header: 'Net Sales', key: 'netSales', width: 14, align: 'right', format: 'currency' },
                { header: 'COGS', key: 'cogs', width: 14, align: 'right', format: 'currency' },
                { header: 'Damages', key: 'salesDamages', width: 14, align: 'right', format: 'currency' },
                { header: 'Expenses', key: 'otherExpenses', width: 14, align: 'right', format: 'currency' },
                { header: 'Gross Profit', key: 'grossProfit', width: 14, align: 'right', format: 'currency' },
                { header: 'Net Profit', key: 'netProfit', width: 14, align: 'right', format: 'currency' },
                { header: 'Margin %', key: 'profitMargin', width: 12, align: 'right' }
            ];
        } else {
            // General fallback columns from first row
            if (rows.length > 0) {
                columns = Object.keys(rows[0]).map(k => ({
                    header: k.replace(/_/g, ' ').toUpperCase(),
                    key: k,
                    width: 16
                }));
            }
        }

        const wb = await createStyledWorkbook(type.toUpperCase(), columns, rows, report.title);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="TerryBakers_${type}_Report.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
