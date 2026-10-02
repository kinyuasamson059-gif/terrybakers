const { db } = require('../database/db');
const { getDailyProfit } = require('./profitService');
const { getProductStockSummary, getIngredientStockSummary, getStockAlerts } = require('./inventoryService');

function getDashboardData({ period = 'all', startDate = '', endDate = '' } = {}) {
    const today = new Date().toISOString().split('T')[0];

    // Compute effective date range if period preset used
    let start = startDate;
    let end = endDate;

    if (period === 'today') {
        start = today;
        end = today;
    } else if (period === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yStr = d.toISOString().split('T')[0];
        start = yStr;
        end = yStr;
    } else if (period === 'this_week') {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
        start = monday;
        end = today;
    } else if (period === 'this_month') {
        const d = new Date();
        start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        end = today;
    } else if (period === 'last_month') {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Profit & Sales metrics for period
    const profitData = getDailyProfit({ startDate: start, endDate: end });
    const { summary } = profitData;

    // Production metrics
    let prodQuery = `
        SELECT COALESCE(SUM(quantity_produced), 0) as total_cakes_produced
        FROM production_items pi
        JOIN production_batches pb ON pi.batch_id = pb.id
    `;
    let prodParams = [];
    if (start) {
        prodQuery += ` WHERE pb.date >= ?`;
        prodParams.push(start);
        if (end) {
            prodQuery += ` AND pb.date <= ?`;
            prodParams.push(end);
        }
    }
    const cakesProduced = db.prepare(prodQuery).get(...prodParams).total_cakes_produced;

    // Cakes Sold
    let soldQuery = `
        SELECT COALESCE(SUM(si.quantity), 0) as total_cakes_sold
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
    `;
    let soldParams = [];
    if (start) {
        soldQuery += ` WHERE s.date >= ?`;
        soldParams.push(start);
        if (end) {
            soldQuery += ` AND s.date <= ?`;
            soldParams.push(end);
        }
    }
    const cakesSold = db.prepare(soldQuery).get(...soldParams).total_cakes_sold;

    // Stock metrics (Current state)
    const productStock = getProductStockSummary();
    const cakesInStock = productStock.reduce((sum, p) => sum + p.closing, 0);

    const ingredientStock = getIngredientStockSummary();
    const ingredientStockValue = ingredientStock.reduce((sum, i) => sum + (i.balance > 0 ? (i.balance * i.averageCost) : 0), 0);
    const totalIngredientsReceived = ingredientStock.reduce((sum, i) => sum + i.purchased, 0);
    const totalIngredientsUsed = ingredientStock.reduce((sum, i) => sum + i.used, 0);

    // Customer Outstanding Balance (Across registered credit accounts)
    const allCustomers = db.prepare('SELECT id, opening_balance FROM customers').all();
    let customerOutstanding = 0;
    for (const c of allCustomers) {
        const salesTotal = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE customer_id = ? AND payment_status != 'PAID'").get(c.id).s;
        const payTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as p FROM customer_payments WHERE customer_id = ?").get(c.id).p;
        customerOutstanding += Math.max(0, c.opening_balance + salesTotal - payTotal);
    }

    // Today's specific metrics
    const todaySalesRow = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE date = ?`).get(today);
    const todaySales = todaySalesRow ? todaySalesRow.s : 0;

    const todayProdRow = db.prepare(`
        SELECT COALESCE(SUM(pi.quantity_produced), 0) as p
        FROM production_items pi
        JOIN production_batches pb ON pi.batch_id = pb.id
        WHERE pb.date = ?
    `).get(today);
    const todayProduction = todayProdRow ? todayProdRow.p : 0;

    // Charts: Sales over time (last 30 days or filtered range)
    const salesOverTime = db.prepare(`
        SELECT date, SUM(total_amount) as amount, COUNT(*) as transactions
        FROM sales
        ${start ? `WHERE date >= '${start}' ${end ? `AND date <= '${end}'` : ''}` : ''}
        GROUP BY date
        ORDER BY date ASC
    `).all();

    // Charts: Production over time
    const productionOverTime = db.prepare(`
        SELECT pb.date, SUM(pi.quantity_produced) as quantity
        FROM production_items pi
        JOIN production_batches pb ON pi.batch_id = pb.id
        ${start ? `WHERE pb.date >= '${start}' ${end ? `AND pb.date <= '${end}'` : ''}` : ''}
        GROUP BY pb.date
        ORDER BY pb.date ASC
    `).all();

    // Charts: Product sales breakdown
    const productSalesDistribution = db.prepare(`
        SELECT p.name, SUM(si.quantity) as quantity_sold, SUM(si.subtotal) as total_sales
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        ${start ? `WHERE s.date >= '${start}' ${end ? `AND s.date <= '${end}'` : ''}` : ''}
        GROUP BY p.id
        ORDER BY total_sales DESC
    `).all();

    // Worker production breakdown
    const workerProductionStats = db.prepare(`
        SELECT worker_name, SUM(quantity_produced) as total_produced, SUM(production_hours) as total_hours
        FROM worker_production
        ${start ? `WHERE date >= '${start}' ${end ? `AND date <= '${end}'` : ''}` : ''}
        GROUP BY worker_name
        ORDER BY total_produced DESC
    `).all();

    // Stock alerts
    const alerts = getStockAlerts();

    return {
        filter: { period, startDate: start, endDate: end },
        kpis: {
            totalSales: summary.grossSales,
            salesReturns: summary.salesReturns,
            netSales: summary.netSales,
            cogs: summary.cogs,
            grossProfit: summary.grossProfit,
            netProfit: summary.netProfit,
            profitMargin: summary.profitMargin,
            cakesProduced,
            cakesSold,
            cakesInStock,
            totalIngredientsReceived,
            totalIngredientsUsed,
            ingredientStockValue,
            customerOutstanding: Math.max(0, customerOutstanding),
            damages: summary.salesDamages,
            expenses: summary.otherExpenses,
            todaySales,
            todayProduction
        },
        charts: {
            salesOverTime,
            productionOverTime,
            profitOverTime: profitData.daily.slice(0, 30).reverse(),
            productSalesDistribution,
            workerProductionStats,
            productStockBreakdown: productStock.map(p => ({ name: p.productName, closing: p.closing }))
        },
        alerts
    };
}

module.exports = {
    getDashboardData
};
