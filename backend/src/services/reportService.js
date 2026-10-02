const { db } = require('../database/db');
const { getProductStockSummary, getIngredientStockSummary, getInventoryLedger } = require('./inventoryService');
const { getAllCustomers, getCustomerStatement } = require('./customerService');
const { getDailyProfit } = require('./profitService');
const { getWorkerPerformance } = require('./workerService');

function getReport(reportType, { startDate = '', endDate = '', search = '', customerId = '', workerId = '', productId = '', ingredientId = '' } = {}) {
    switch (reportType) {
        case 'sales': {
            let where = [];
            let params = {};
            if (startDate) { where.push('s.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('s.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(s.invoice_number LIKE @search OR s.customer_name LIKE @search OR p.name LIKE @search)'); params.search = `%${search}%`; }
            if (customerId) { where.push('s.customer_id = @customerId'); params.customerId = customerId; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    s.date,
                    s.invoice_number,
                    s.customer_name,
                    p.name as product_name,
                    si.quantity,
                    si.selling_price,
                    si.subtotal,
                    s.payment_status,
                    s.payment_method,
                    s.reference
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                JOIN products p ON si.product_id = p.id
                ${whereClause}
                ORDER BY s.date DESC, s.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalQuantity += r.quantity;
                acc.totalAmount += r.subtotal;
                return acc;
            }, { totalQuantity: 0, totalAmount: 0 });

            return { title: 'Sales Report', rows, totals };
        }

        case 'production': {
            let where = [];
            let params = {};
            if (startDate) { where.push('pb.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('pb.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(pb.batch_number LIKE @search OR p.name LIKE @search OR pb.worker_name LIKE @search)'); params.search = `%${search}%`; }
            if (productId) { where.push('pi.product_id = @productId'); params.productId = productId; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    pb.date,
                    pb.batch_number,
                    p.name as product_name,
                    pi.quantity_produced,
                    pb.worker_name,
                    pb.production_hours,
                    pi.unit_cost,
                    pi.total_cost,
                    pb.notes
                FROM production_items pi
                JOIN production_batches pb ON pi.batch_id = pb.id
                JOIN products p ON pi.product_id = p.id
                ${whereClause}
                ORDER BY pb.date DESC, pb.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalProduced += r.quantity_produced;
                acc.totalCost += r.total_cost;
                acc.totalHours += r.production_hours;
                return acc;
            }, { totalProduced: 0, totalCost: 0, totalHours: 0 });

            return { title: 'Production Report', rows, totals };
        }

        case 'ingredient_purchases': {
            let where = [];
            let params = {};
            if (startDate) { where.push('p.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('p.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(p.purchase_number LIKE @search OR ing.name LIKE @search OR p.supplier_name LIKE @search)'); params.search = `%${search}%`; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    p.date,
                    p.purchase_number,
                    ing.name as ingredient_name,
                    pi.unit,
                    pi.quantity,
                    pi.cost_per_unit,
                    pi.total_cost,
                    p.supplier_name,
                    p.batch_reference
                FROM purchase_items pi
                JOIN purchases p ON pi.purchase_id = p.id
                JOIN ingredients ing ON pi.ingredient_id = ing.id
                ${whereClause}
                ORDER BY p.date DESC, p.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalQuantity += r.quantity;
                acc.totalCost += r.total_cost;
                return acc;
            }, { totalQuantity: 0, totalCost: 0 });

            return { title: 'Ingredient Purchase Report', rows, totals };
        }

        case 'ingredient_usage': {
            let where = [];
            let params = {};
            if (startDate) { where.push('iu.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('iu.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(iu.usage_number LIKE @search OR ing.name LIKE @search OR p.name LIKE @search OR iu.batch_reference LIKE @search)'); params.search = `%${search}%`; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    iu.date,
                    iu.batch_reference,
                    p.name as product_name,
                    ing.name as ingredient_name,
                    iu.unit,
                    iu.quantity_used,
                    iu.unit_cost,
                    iu.total_cost,
                    iu.no_of_cakes,
                    iu.notes
                FROM ingredient_usage iu
                JOIN ingredients ing ON iu.ingredient_id = ing.id
                LEFT JOIN products p ON iu.product_id = p.id
                ${whereClause}
                ORDER BY iu.date DESC, iu.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalQuantityUsed += r.quantity_used;
                acc.totalCost += r.total_cost;
                acc.totalCakes += r.no_of_cakes;
                return acc;
            }, { totalQuantityUsed: 0, totalCost: 0, totalCakes: 0 });

            return { title: 'Ingredient Usage Report', rows, totals };
        }

        case 'finished_product_inventory': {
            const summary = getProductStockSummary({ startDate, endDate });
            let rows = summary;
            if (search) {
                const s = search.toLowerCase();
                rows = rows.filter(r => r.productName.toLowerCase().includes(s) || r.productCode.toLowerCase().includes(s));
            }
            const totals = rows.reduce((acc, r) => {
                acc.opening += r.opening;
                acc.produced += r.produced;
                acc.sold += r.sold;
                acc.returned += r.returned;
                acc.damaged += r.damaged;
                acc.closing += r.closing;
                return acc;
            }, { opening: 0, produced: 0, sold: 0, returned: 0, damaged: 0, closing: 0 });

            return { title: 'Finished Product Inventory Report', rows, totals };
        }

        case 'ingredient_inventory': {
            const summary = getIngredientStockSummary({ startDate, endDate });
            let rows = summary;
            if (search) {
                const s = search.toLowerCase();
                rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.ingredientCode.toLowerCase().includes(s));
            }
            const totals = rows.reduce((acc, r) => {
                acc.purchased += r.purchased;
                acc.used += r.used;
                acc.balance += r.balance;
                acc.stockValue += r.stockValue;
                return acc;
            }, { purchased: 0, used: 0, balance: 0, stockValue: 0 });

            return { title: 'Ingredient Inventory Report', rows, totals };
        }

        case 'customer_statement': {
            if (!customerId) {
                return { title: 'Customer Statement', rows: [], message: 'Please select a customer to view their statement.' };
            }
            const statement = getCustomerStatement(customerId, { startDate, endDate });
            return {
                title: `Customer Statement - ${statement?.customer?.name}`,
                customer: statement?.customer,
                rows: statement?.statement || [],
                currentBalance: statement?.currentBalance || 0
            };
        }

        case 'customer_outstanding': {
            const customers = getAllCustomers({ search });
            const filtered = customers.filter(c => c.outstanding_balance > 0.01);
            const totals = filtered.reduce((acc, c) => {
                acc.totalOpening += c.opening_balance;
                acc.totalSales += c.total_sales;
                acc.totalPayments += c.total_payments;
                acc.totalOutstanding += c.outstanding_balance;
                return acc;
            }, { totalOpening: 0, totalSales: 0, totalPayments: 0, totalOutstanding: 0 });

            return { title: 'Customer Outstanding Report', rows: filtered, totals };
        }

        case 'sales_returns': {
            let where = [];
            let params = {};
            if (startDate) { where.push('sr.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('sr.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(sr.return_number LIKE @search OR sr.invoice_number LIKE @search OR p.name LIKE @search OR sr.customer_name LIKE @search)'); params.search = `%${search}%`; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    sr.date,
                    sr.return_number,
                    sr.customer_name,
                    sr.invoice_number,
                    p.name as product_name,
                    sri.quantity,
                    sri.unit_cost,
                    sri.return_value,
                    sri.reason
                FROM sales_return_items sri
                JOIN sales_returns sr ON sri.return_id = sr.id
                JOIN products p ON sri.product_id = p.id
                ${whereClause}
                ORDER BY sr.date DESC, sr.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalQuantity += r.quantity;
                acc.totalReturnValue += r.return_value;
                return acc;
            }, { totalQuantity: 0, totalReturnValue: 0 });

            return { title: 'Sales Returns Report', rows, totals };
        }

        case 'damages': {
            let where = [];
            let params = {};
            if (startDate) { where.push('d.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('d.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(d.damage_number LIKE @search OR p.name LIKE @search OR d.reason LIKE @search)'); params.search = `%${search}%`; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    d.date,
                    d.damage_number,
                    p.name as product_name,
                    d.quantity,
                    d.unit_cost,
                    d.damage_value,
                    d.reason,
                    d.department_worker,
                    d.approved_by
                FROM damages d
                JOIN products p ON d.product_id = p.id
                ${whereClause}
                ORDER BY d.date DESC, d.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalQuantity += r.quantity;
                acc.totalDamageValue += r.damage_value;
                return acc;
            }, { totalQuantity: 0, totalDamageValue: 0 });

            return { title: 'Damages & Spoilage Report', rows, totals };
        }

        case 'worker_production': {
            const perf = getWorkerPerformance({ startDate, endDate, workerId, productId });
            return { title: 'Worker Production Performance Report', rows: perf.records, aggregated: perf.aggregated };
        }

        case 'daily_profit': {
            const profit = getDailyProfit({ startDate, endDate });
            return { title: 'Daily Profit & Loss Report', rows: profit.daily, summary: profit.summary };
        }

        case 'expenses': {
            let where = [];
            let params = {};
            if (startDate) { where.push('e.date >= @startDate'); params.startDate = startDate; }
            if (endDate) { where.push('e.date <= @endDate'); params.endDate = endDate; }
            if (search) { where.push('(e.expense_number LIKE @search OR e.category LIKE @search OR e.description LIKE @search)'); params.search = `%${search}%`; }

            const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT 
                    e.date,
                    e.expense_number,
                    e.category,
                    e.description,
                    e.amount,
                    e.payment_method,
                    e.reference,
                    e.notes
                FROM expenses e
                ${whereClause}
                ORDER BY e.date DESC, e.id DESC
            `).all(params);

            const totals = rows.reduce((acc, r) => {
                acc.totalAmount += r.amount;
                return acc;
            }, { totalAmount: 0 });

            return { title: 'Business Expenses Report', rows, totals };
        }

        case 'stock_movement': {
            const ledger = getInventoryLedger({ startDate, endDate, limit: 500 });
            return { title: 'Stock Movement Ledger Report', rows: ledger.transactions, total: ledger.total };
        }

        default:
            throw new Error(`Unknown report type: ${reportType}`);
    }
}

module.exports = {
    getReport
};
