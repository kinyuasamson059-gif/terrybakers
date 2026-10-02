const { db } = require('../database/db');

function getDailyProfit({ startDate = '', endDate = '' } = {}) {
    // Collect all distinct dates from sales, returns, production/usage, damages, expenses
    let dateQueries = [
        'SELECT DISTINCT date FROM sales',
        'SELECT DISTINCT date FROM sales_returns',
        'SELECT DISTINCT date FROM ingredient_usage',
        'SELECT DISTINCT date FROM production_batches',
        'SELECT DISTINCT date FROM damages',
        'SELECT DISTINCT date FROM expenses'
    ];

    let allDatesQuery = dateQueries.join(' UNION ') + ' ORDER BY date DESC';
    let dates = db.prepare(allDatesQuery).all().map(r => r.date).filter(Boolean);

    if (startDate) {
        dates = dates.filter(d => d >= startDate);
    }
    if (endDate) {
        dates = dates.filter(d => d <= endDate);
    }

    const rows = dates.map(date => {
        // Gross Sales
        const salesRow = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as gross FROM sales WHERE date = ?`).get(date);
        const grossSales = salesRow ? salesRow.gross : 0;

        // Sales Returns
        const retRow = db.prepare(`SELECT COALESCE(SUM(total_return_value), 0) as returns FROM sales_returns WHERE date = ?`).get(date);
        const salesReturns = retRow ? retRow.returns : 0;

        // Net Sales = Gross Sales - Sales Returns
        const netSales = grossSales - salesReturns;

        // COGS / Production Cost:
        // Check ingredient usage cost for that day or sale item cost
        const usageRow = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) as cost FROM ingredient_usage WHERE date = ?`).get(date);
        const usageCost = usageRow ? usageRow.cost : 0;

        // Also check sale items cogs
        const saleItemsCogsRow = db.prepare(`
            SELECT COALESCE(SUM(si.quantity * si.unit_cost), 0) as cogs
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.date = ?
        `).get(date);
        const salesCogs = saleItemsCogsRow ? saleItemsCogsRow.cogs : 0;

        // Use usage cost if production happened that day; else fallback to sales cogs
        const cogs = usageCost > 0 ? usageCost : salesCogs;

        // Sales Damages
        const dmgRow = db.prepare(`SELECT COALESCE(SUM(damage_value), 0) as damages FROM damages WHERE date = ?`).get(date);
        const salesDamages = dmgRow ? dmgRow.damages : 0;

        // Other Expenses
        const expRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as expenses FROM expenses WHERE date = ?`).get(date);
        const otherExpenses = expRow ? expRow.expenses : 0;

        // Calculations matching Excel formulas:
        // Gross Profit = Net Sales - COGS
        const grossProfit = netSales - cogs;

        // Net Profit = Gross Profit - Sales Damages - Other Expenses
        const netProfit = grossProfit - salesDamages - otherExpenses;

        // Profit Margin % = IFERROR(Net Profit / Net Sales, 0)
        const profitMargin = netSales > 0 ? ((netProfit / netSales) * 100) : 0;

        return {
            date,
            grossSales,
            salesReturns,
            netSales,
            cogs,
            salesDamages,
            otherExpenses,
            grossProfit,
            netProfit,
            profitMargin: Number(profitMargin.toFixed(2))
        };
    });

    // Summary totals for period
    const summary = rows.reduce((acc, r) => {
        acc.grossSales += r.grossSales;
        acc.salesReturns += r.salesReturns;
        acc.netSales += r.netSales;
        acc.cogs += r.cogs;
        acc.salesDamages += r.salesDamages;
        acc.otherExpenses += r.otherExpenses;
        acc.grossProfit += r.grossProfit;
        acc.netProfit += r.netProfit;
        return acc;
    }, {
        grossSales: 0,
        salesReturns: 0,
        netSales: 0,
        cogs: 0,
        salesDamages: 0,
        otherExpenses: 0,
        grossProfit: 0,
        netProfit: 0
    });

    summary.profitMargin = summary.netSales > 0
        ? Number(((summary.netProfit / summary.netSales) * 100).toFixed(2))
        : 0;

    return {
        daily: rows,
        summary
    };
}

module.exports = {
    getDailyProfit
};
