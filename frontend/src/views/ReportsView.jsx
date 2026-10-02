import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { FileSpreadsheet, Download, Printer, Search, Calendar, Filter } from 'lucide-react';

const REPORT_DEFINITIONS = [
  { id: 'sales', name: 'Sales Report', desc: 'All sales invoices, items sold, unit prices and revenue' },
  { id: 'production', name: 'Production Report', desc: 'Cakes produced by batch, shift hours, and unit costs' },
  { id: 'ingredient_purchases', name: 'Ingredient Purchases Report', desc: 'Raw material procurement, suppliers, and purchase costs' },
  { id: 'ingredient_usage', name: 'Ingredient Usage Report', desc: 'Recipe consumption per product batch and stock reduction' },
  { id: 'finished_product_inventory', name: 'Finished Product Inventory Report', desc: 'Stock movements: Opening, Produced, Sold, Returned, Damaged, Closing' },
  { id: 'ingredient_inventory', name: 'Ingredient Inventory Report', desc: 'Raw stock: Purchased, Used, Current Balance, Average Cost, Valuation' },
  { id: 'customer_outstanding', name: 'Customer Outstanding Report', desc: 'Debtors list, opening balances, total sales, payments, and credit status' },
  { id: 'sales_returns', name: 'Sales Returns Report', desc: 'Customer returned cakes, credit values, and return reasons' },
  { id: 'damages', name: 'Damage & Spoilage Report', desc: 'Wastage records, defect reasons, values, and supervisory approvals' },
  { id: 'worker_production', name: 'Worker Production Performance Report', desc: 'Baker shift volumes, hours, and productivity (KG/Hour & 8KG units)' },
  { id: 'daily_profit', name: 'Daily Profit & Loss Report', desc: 'Daily net sales, COGS, gross profit, expenses, net profit and margins' },
  { id: 'expenses', name: 'Operating Expenses Report', desc: 'Itemized bakery overheads categorized by utilities, rent, transport' },
  { id: 'stock_movement', name: 'Stock Movement Audit Ledger', desc: 'Chronological inventory movement log of all additions and deductions' }
];

export default function ReportsView() {
  const [selectedReport, setSelectedReport] = useState('sales');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.getReport(selectedReport, { search, startDate, endDate });
      setReportData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedReport, search, startDate, endDate]);

  const activeDef = REPORT_DEFINITIONS.find(r => r.id === selectedReport);
  const rows = reportData?.rows || [];
  const totals = reportData?.totals || {};

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Business Reports & Analytics</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            14 production and financial audit reports with live filtering, printable views, and Excel export.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }} className="no-print">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print Report
          </button>
          <a
            href={api.getReportExportUrl(selectedReport, { startDate, endDate, search })}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            title="Download Clean Excel Report"
          >
            <Download size={15} /> Export to Excel
          </a>
        </div>
      </div>

      {/* Report Selector Pills */}
      <div className="no-print" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px',
        padding: '14px',
        backgroundColor: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)'
      }}>
        {REPORT_DEFINITIONS.map(rep => (
          <button
            key={rep.id}
            className={`btn btn-sm ${selectedReport === rep.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedReport(rep.id)}
            style={{ fontSize: '0.8rem' }}
          >
            {rep.name}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="card no-print" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
              {activeDef?.name}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {activeDef?.desc}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter rows..."
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', padding: '6px 10px 6px 30px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <input
              type="date"
              className="form-input"
              style={{ width: '135px', padding: '6px 10px', fontSize: '0.8rem' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '135px', padding: '6px 10px', fontSize: '0.8rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate || search) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Printable Report Header */}
      <div style={{ display: 'none', marginBottom: '20px' }} className="print-only">
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>TERRY BAKERS</h2>
        <h3>{activeDef?.name}</h3>
        <p style={{ fontSize: '0.8rem' }}>
          Date Range: {startDate || 'All Time'} to {endDate || 'All Time'} • Generated: {new Date().toLocaleString()}
        </p>
      </div>

      {/* Render Dynamic Table based on selectedReport */}
      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading report data...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No records match the report criteria.</div>
        ) : (
          <table className="data-table">
            <thead>
              {/* Dynamic Header based on report */}
              {selectedReport === 'sales' && (
                <tr>
                  <th>Date</th>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Subtotal</th>
                  <th>Payment Status</th>
                  <th>Method</th>
                </tr>
              )}

              {selectedReport === 'production' && (
                <tr>
                  <th>Date</th>
                  <th>Batch #</th>
                  <th>Product</th>
                  <th className="text-right">Quantity Produced</th>
                  <th>Baker</th>
                  <th className="text-right">Hours</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Total Cost</th>
                </tr>
              )}

              {selectedReport === 'ingredient_purchases' && (
                <tr>
                  <th>Date</th>
                  <th>Purchase #</th>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Cost / Unit</th>
                  <th className="text-right">Total Cost</th>
                  <th>Supplier</th>
                  <th>Batch Ref</th>
                </tr>
              )}

              {selectedReport === 'ingredient_usage' && (
                <tr>
                  <th>Date</th>
                  <th>Batch Ref</th>
                  <th>Cake Type</th>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th className="text-right">Quantity Used</th>
                  <th className="text-right">No. of Cakes</th>
                  <th className="text-right">Total Cost</th>
                </tr>
              )}

              {selectedReport === 'finished_product_inventory' && (
                <tr>
                  <th>Product</th>
                  <th className="text-right">Opening</th>
                  <th className="text-right">Produced (+)</th>
                  <th className="text-right">Sold (-)</th>
                  <th className="text-right">Returned (+)</th>
                  <th className="text-right">Damaged (-)</th>
                  <th className="text-right">Closing Stock</th>
                </tr>
              )}

              {selectedReport === 'ingredient_inventory' && (
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th className="text-right">Purchased (+)</th>
                  <th className="text-right">Used (-)</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Average Cost</th>
                  <th className="text-right">Stock Valuation</th>
                </tr>
              )}

              {selectedReport === 'customer_outstanding' && (
                <tr>
                  <th>Customer Code</th>
                  <th>Customer Name</th>
                  <th>Phone & Location</th>
                  <th className="text-right">Opening Bal</th>
                  <th className="text-right">Total Sales</th>
                  <th className="text-right">Payments</th>
                  <th className="text-right">Outstanding Balance</th>
                  <th className="text-center">Status</th>
                </tr>
              )}

              {selectedReport === 'sales_returns' && (
                <tr>
                  <th>Date</th>
                  <th>Return #</th>
                  <th>Customer</th>
                  <th>Invoice #</th>
                  <th>Product</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Unit Value</th>
                  <th className="text-right">Return Value</th>
                  <th>Reason</th>
                </tr>
              )}

              {selectedReport === 'damages' && (
                <tr>
                  <th>Date</th>
                  <th>Damage #</th>
                  <th>Product</th>
                  <th className="text-right">Quantity Damaged</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Loss Value</th>
                  <th>Reason</th>
                  <th>Approved By</th>
                </tr>
              )}

              {selectedReport === 'worker_production' && (
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th>Product</th>
                  <th className="text-right">Quantity Produced</th>
                  <th className="text-right">Hours</th>
                  <th className="text-right">KG / Hour</th>
                  <th className="text-right">8KG Units</th>
                </tr>
              )}

              {selectedReport === 'daily_profit' && (
                <tr>
                  <th>Date</th>
                  <th className="text-right">Gross Sales</th>
                  <th className="text-right">Returns (-)</th>
                  <th className="text-right">Net Sales</th>
                  <th className="text-right">COGS (-)</th>
                  <th className="text-right">Damages (-)</th>
                  <th className="text-right">Expenses (-)</th>
                  <th className="text-right">Net Profit</th>
                  <th className="text-right">Margin %</th>
                </tr>
              )}

              {selectedReport === 'expenses' && (
                <tr>
                  <th>Date</th>
                  <th>Expense #</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                </tr>
              )}

              {selectedReport === 'stock_movement' && (
                <tr>
                  <th>Tx #</th>
                  <th>Date</th>
                  <th>Item Type</th>
                  <th>Item Name</th>
                  <th>Movement Type</th>
                  <th className="text-right">Quantity Change</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Total Value</th>
                </tr>
              )}
            </thead>

            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {selectedReport === 'sales' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.invoice_number}</strong></td>
                      <td>{r.customer_name || 'Walk-in'}</td>
                      <td>{r.product_name}</td>
                      <td className="text-right tabular-nums">{r.quantity}</td>
                      <td className="text-right tabular-nums">KES {Number(r.selling_price).toLocaleString()}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>KES {Number(r.subtotal).toLocaleString()}</td>
                      <td><span className="badge badge-success">{r.payment_status}</span></td>
                      <td>{r.payment_method}</td>
                    </>
                  )}

                  {selectedReport === 'production' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.batch_number}</strong></td>
                      <td>{r.product_name}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>{r.quantity_produced}</td>
                      <td>{r.worker_name || '—'}</td>
                      <td className="text-right tabular-nums">{r.production_hours}</td>
                      <td className="text-right tabular-nums">KES {Number(r.unit_cost || 0).toLocaleString()}</td>
                      <td className="text-right tabular-nums">KES {Number(r.total_cost || 0).toLocaleString()}</td>
                    </>
                  )}

                  {selectedReport === 'ingredient_purchases' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.purchase_number}</strong></td>
                      <td>{r.ingredient_name}</td>
                      <td>{r.unit}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>+{r.quantity}</td>
                      <td className="text-right tabular-nums">KES {Number(r.cost_per_unit).toLocaleString()}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>KES {Number(r.total_cost).toLocaleString()}</td>
                      <td>{r.supplier_name || '—'}</td>
                      <td><span className="badge badge-neutral">{r.batch_reference || '—'}</span></td>
                    </>
                  )}

                  {selectedReport === 'ingredient_usage' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.batch_reference || '—'}</strong></td>
                      <td>{r.product_name || '—'}</td>
                      <td>{r.ingredient_name}</td>
                      <td>{r.unit}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--danger-text)', fontWeight: 700 }}>-{r.quantity_used}</td>
                      <td className="text-right tabular-nums">{r.no_of_cakes || '—'}</td>
                      <td className="text-right tabular-nums">KES {Number(r.total_cost).toLocaleString()}</td>
                    </>
                  )}

                  {selectedReport === 'finished_product_inventory' && (
                    <>
                      <td><strong>{r.productName}</strong></td>
                      <td className="text-right tabular-nums">{r.opening}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>+{r.produced}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--danger-text)' }}>-{r.sold}</td>
                      <td className="text-right tabular-nums">+{r.returned}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--danger-text)' }}>-{r.damaged}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800, fontSize: '0.95rem' }}>{r.closing} {r.unit}</td>
                    </>
                  )}

                  {selectedReport === 'ingredient_inventory' && (
                    <>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.unit}</td>
                      <td className="text-right tabular-nums">+{r.purchased}</td>
                      <td className="text-right tabular-nums">-{r.used}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>{r.balance} {r.unit}</td>
                      <td className="text-right tabular-nums">KES {Number(r.averageCost).toFixed(2)}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>KES {Number(r.stockValue).toLocaleString()}</td>
                    </>
                  )}

                  {selectedReport === 'customer_outstanding' && (
                    <>
                      <td>{r.customer_code}</td>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.phone} • {r.location}</td>
                      <td className="text-right tabular-nums">KES {Number(r.opening_balance).toLocaleString()}</td>
                      <td className="text-right tabular-nums">KES {Number(r.total_sales).toLocaleString()}</td>
                      <td className="text-right tabular-nums">KES {Number(r.total_payments).toLocaleString()}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800, color: 'var(--warning-text)' }}>
                        KES {Number(r.outstanding_balance).toLocaleString()}
                      </td>
                      <td className="text-center"><span className="badge badge-warning">{r.account_status}</span></td>
                    </>
                  )}

                  {selectedReport === 'sales_returns' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.return_number}</strong></td>
                      <td>{r.customer_name || 'Walk-in'}</td>
                      <td>{r.invoice_number || '—'}</td>
                      <td>{r.product_name}</td>
                      <td className="text-right tabular-nums">+{r.quantity}</td>
                      <td className="text-right tabular-nums">KES {Number(r.unit_cost).toLocaleString()}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>KES {Number(r.return_value).toLocaleString()}</td>
                      <td>{r.reason}</td>
                    </>
                  )}

                  {selectedReport === 'damages' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong style={{ color: 'var(--danger)' }}>{r.damage_number}</strong></td>
                      <td>{r.product_name}</td>
                      <td className="text-right tabular-nums">-{r.quantity}</td>
                      <td className="text-right tabular-nums">KES {Number(r.unit_cost).toLocaleString()}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>KES {Number(r.damage_value).toLocaleString()}</td>
                      <td>{r.reason}</td>
                      <td>{r.approved_by}</td>
                    </>
                  )}

                  {selectedReport === 'worker_production' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.worker_name}</strong></td>
                      <td>{r.product_name}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>{r.quantity_produced}</td>
                      <td className="text-right tabular-nums">{r.production_hours}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(r.kg_per_hour).toFixed(1)}</td>
                      <td className="text-right tabular-nums">{Number(r.eight_kg_units).toFixed(1)}</td>
                    </>
                  )}

                  {selectedReport === 'daily_profit' && (
                    <>
                      <td>{r.date}</td>
                      <td className="text-right tabular-nums">KES {Number(r.grossSales).toLocaleString()}</td>
                      <td className="text-right tabular-nums">-KES {Number(r.salesReturns).toLocaleString()}</td>
                      <td className="text-right tabular-nums">KES {Number(r.netSales).toLocaleString()}</td>
                      <td className="text-right tabular-nums">KES {Number(r.cogs).toLocaleString()}</td>
                      <td className="text-right tabular-nums">-KES {Number(r.salesDamages).toLocaleString()}</td>
                      <td className="text-right tabular-nums">-KES {Number(r.otherExpenses).toLocaleString()}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800, color: r.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        KES {Number(r.netProfit).toLocaleString()}
                      </td>
                      <td className="text-right tabular-nums">{r.profitMargin}%</td>
                    </>
                  )}

                  {selectedReport === 'expenses' && (
                    <>
                      <td>{r.date}</td>
                      <td><strong>{r.expense_number}</strong></td>
                      <td><span className="badge badge-neutral">{r.category}</span></td>
                      <td>{r.description}</td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>KES {Number(r.amount).toLocaleString()}</td>
                      <td>{r.payment_method}</td>
                      <td>{r.reference || '—'}</td>
                    </>
                  )}

                  {selectedReport === 'stock_movement' && (
                    <>
                      <td>{r.transaction_number}</td>
                      <td>{r.date}</td>
                      <td><span className="badge badge-neutral">{r.item_type}</span></td>
                      <td><strong>{r.item_name}</strong></td>
                      <td><span className="badge badge-info">{r.transaction_type}</span></td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800, color: r.quantity_change > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {r.quantity_change > 0 ? `+${r.quantity_change}` : r.quantity_change}
                      </td>
                      <td className="text-right tabular-nums">KES {Number(r.unit_cost || 0).toLocaleString()}</td>
                      <td className="text-right tabular-nums">KES {Number(r.total_value || 0).toLocaleString()}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
