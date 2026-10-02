const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { importWorkbook } = require('../services/excelImportService');
const { createStyledWorkbook } = require('../services/excelExportService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const productService = require('../services/productService');
const ingredientService = require('../services/ingredientService');
const salesService = require('../services/salesService');
const customerService = require('../services/customerService');
const productionService = require('../services/productionService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

// Import uploaded Excel workbook or default local workbook
router.post('/import', authMiddleware, requireRole('ADMIN'), upload.single('file'), (req, res) => {
    try {
        const dryRun = req.query.dryRun === 'true' || req.body.dryRun === 'true';
        const defaultDate = req.query.defaultDate || req.body.defaultDate || new Date().toISOString().split('T')[0];

        let bufferOrPath;
        if (req.file) {
            bufferOrPath = req.file.buffer;
        } else {
            // Check default workbook in workspace
            const localWorkbook = path.resolve(__dirname, '../../../Terry_Bakers_Production_Management_Template.xlsx');
            if (fs.existsSync(localWorkbook)) {
                bufferOrPath = localWorkbook;
            } else {
                return res.status(400).json({ error: 'No file uploaded and default template not found.' });
            }
        }

        const summary = importWorkbook(bufferOrPath, {
            defaultDate,
            dryRun,
            userId: req.user.id,
            username: req.user.username
        });

        res.json(summary);
    } catch (err) {
        res.status(400).json({ error: err.message, stack: err.stack });
    }
});

// Export a whole module to formatted Excel
router.get('/export/:module', authMiddleware, async (req, res) => {
    try {
        const { module } = req.params;
        let columns = [];
        let rows = [];
        let title = `${module.toUpperCase()} EXPORT`;

        if (module === 'products') {
            const products = productService.getAllProducts();
            columns = [
                { header: 'Code', key: 'product_code', width: 14 },
                { header: 'Product Name', key: 'name', width: 24 },
                { header: 'Category', key: 'category', width: 16 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Selling Price', key: 'selling_price', width: 14, align: 'right', format: 'currency' },
                { header: 'Cost Price', key: 'cost_price', width: 14, align: 'right', format: 'currency' },
                { header: 'Stock Balance', key: 'current_stock', width: 14, align: 'right', format: 'number' },
                { header: 'Status', key: 'active', width: 12 }
            ];
            rows = products.map(p => ({ ...p, active: p.active ? 'Active' : 'Inactive' }));
        } else if (module === 'ingredients') {
            const ings = ingredientService.getAllIngredients();
            columns = [
                { header: 'Code', key: 'ingredient_code', width: 14 },
                { header: 'Ingredient Name', key: 'name', width: 24 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Min Stock Level', key: 'min_stock_level', width: 14, align: 'right', format: 'number' },
                { header: 'Current Stock', key: 'current_stock', width: 14, align: 'right', format: 'number' },
                { header: 'Average Cost', key: 'average_cost', width: 14, align: 'right', format: 'currency' }
            ];
            rows = ings;
        } else if (module === 'customers') {
            const custs = customerService.getAllCustomers();
            columns = [
                { header: 'Code', key: 'customer_code', width: 14 },
                { header: 'Name', key: 'name', width: 24 },
                { header: 'Phone', key: 'phone', width: 16 },
                { header: 'Location', key: 'location', width: 18 },
                { header: 'Credit Limit', key: 'credit_limit', width: 14, align: 'right', format: 'currency' },
                { header: 'Total Sales', key: 'total_sales', width: 14, align: 'right', format: 'currency' },
                { header: 'Payments', key: 'total_payments', width: 14, align: 'right', format: 'currency' },
                { header: 'Outstanding', key: 'outstanding_balance', width: 14, align: 'right', format: 'currency' },
                { header: 'Status', key: 'account_status', width: 14 }
            ];
            rows = custs;
        } else {
            return res.status(400).json({ error: `Unknown export module: ${module}` });
        }

        const wb = await createStyledWorkbook(module.toUpperCase(), columns, rows, title);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="TerryBakers_${module}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
