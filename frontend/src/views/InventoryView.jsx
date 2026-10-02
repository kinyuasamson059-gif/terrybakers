import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { FolderTree, Boxes, Wheat, Search, AlertTriangle, Download, ArrowDownRight, ArrowUpRight, History } from 'lucide-react';

export default function InventoryView() {
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'ingredients', 'ledger'
  const [productStock, setProductStock] = useState([]);
  const [ingredientStock, setIngredientStock] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerType, setLedgerType] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsRes, ingsRes, alertsRes, ledgerRes] = await Promise.all([
        api.getProductStock({ startDate, endDate }),
        api.getIngredientStock({ startDate, endDate }),
        api.getStockAlerts(),
        api.getInventoryLedger({
          transactionType: ledgerType,
          startDate,
          endDate,
          limit: 150
        })
      ]);
      setProductStock(prodsRes || []);
      setIngredientStock(ingsRes || []);
      setAlerts(alertsRes || {});
      setLedger(ledgerRes.transactions || []);
      setLedgerTotal(ledgerRes.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, ledgerType]);

  // Client search filter for current tab
  const filteredProducts = productStock.filter(p =>
    p.productName.toLowerCase().includes(search.toLowerCase()) ||
    p.productCode.toLowerCase().includes(search.toLowerCase())
  );

  const filteredIngredients = ingredientStock.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.ingredientCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Inventory Ledger & Stock Balances</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Real-time transaction-backed inventory tracking for cakes and raw ingredients.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getReportExportUrl(activeTab === 'products' ? 'finished_product_inventory' : 'ingredient_inventory')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Download Clean Excel Inventory Report"
          >
            <Download size={15} /> Export Inventory
          </a>
        </div>
      </div>

      {/* Low & Negative Stock Alert Banner */}
      {alerts.totalAlerts > 0 && (
        <div style={{
          backgroundColor: 'var(--warning-bg)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          color: 'var(--warning-text)'
        }}>
          <AlertTriangle size={24} color="var(--warning)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.85rem' }}>
            <strong>Active Inventory Alerts ({alerts.totalAlerts}):</strong>
            {alerts.negativeStockIngredients?.length > 0 && (
              <span style={{ marginLeft: '6px' }}>
                {alerts.negativeStockIngredients.map(i => `${i.name} (${i.balance} ${i.unit})`).join(', ')} have <strong>negative stock balances</strong>!
              </span>
            )}
            {alerts.lowStockIngredients?.length > 0 && (
              <span style={{ marginLeft: '6px' }}>
                {alerts.lowStockIngredients.map(i => `${i.name} (${i.balance} ${i.unit})`).join(', ')} are <strong>below minimum threshold</strong>.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('products')}
        >
          <Boxes size={14} /> Product Stock Ledger ({productStock.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'ingredients' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ingredients')}
        >
          <Wheat size={14} /> Ingredient Stock Ledger ({ingredientStock.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ledger')}
        >
          <History size={14} /> Full Transaction Audit Ledger ({ledgerTotal})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search items..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: '140px', padding: '8px 10px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '140px', padding: '8px 10px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            {activeTab === 'ledger' && (
              <div style={{ width: '220px' }}>
                <SearchableSelect
                  value={ledgerType}
                  onChange={setLedgerType}
                  options={[
                    { id: '', label: 'All Movement Types' },
                    { id: 'PRODUCTION', label: 'Production Added' },
                    { id: 'SALE', label: 'Sale Deducted' },
                    { id: 'PURCHASE', label: 'Purchase In' },
                    { id: 'USAGE', label: 'Ingredient Usage' },
                    { id: 'SALE_RETURN', label: 'Sale Return' },
                    { id: 'DAMAGE', label: 'Damages' },
                    { id: 'OPENING', label: 'Opening Stock' }
                  ]}
                  placeholder="Filter movement type..."
                  emptyMessage="No matching movement type found."
                  allowClear={true}
                />
              </div>
            )}

            {(search || startDate || endDate || ledgerType) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setLedgerType(''); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab 1: Finished Product Stock Table (Requirement 16) */}
      {activeTab === 'products' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th className="text-right">Opening</th>
                <th className="text-right">Produced (+)</th>
                <th className="text-right">Sold (-)</th>
                <th className="text-right">Returned (+)</th>
                <th className="text-right">Damaged (-)</th>
                <th className="text-right">Closing Stock</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading product stock...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No products found.</td></tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.productId}>
                    <td>
                      <strong style={{ fontSize: '0.95rem' }}>{p.productName}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{p.productCode} • {p.unit}</span>
                    </td>
                    <td className="text-right tabular-nums">{p.opening}</td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>+{p.produced}</td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--danger-text)' }}>-{p.sold}</td>
                    <td className="text-right tabular-nums">+{p.returned}</td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--danger-text)' }}>-{p.damaged}</td>
                    <td className="text-right tabular-nums" style={{
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: p.closing > 50 ? 'var(--success)' : (p.closing > 0 ? 'var(--warning-text)' : 'var(--danger)')
                    }}>
                      {p.closing} {p.unit}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${p.closing > 50 ? 'badge-success' : (p.closing > 0 ? 'badge-warning' : 'badge-danger')}`}>
                        {p.closing > 50 ? 'IN STOCK' : (p.closing > 0 ? 'LOW STOCK' : 'OUT OF STOCK')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Ingredient Stock Table (Requirement 16) */}
      {activeTab === 'ingredients' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingredient Name</th>
                <th>Unit</th>
                <th className="text-right">Purchased (+)</th>
                <th className="text-right">Used (-)</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Average Cost</th>
                <th className="text-right">Stock Valuation</th>
                <th className="text-center">Alert Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading ingredient stock...</td></tr>
              ) : filteredIngredients.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No ingredients found.</td></tr>
              ) : (
                filteredIngredients.map(i => (
                  <tr key={i.ingredientId}>
                    <td>
                      <strong style={{ fontSize: '0.95rem' }}>{i.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{i.ingredientCode}</span>
                    </td>
                    <td><span className="badge badge-neutral">{i.unit}</span></td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>+{i.purchased}</td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--danger-text)' }}>-{i.used}</td>
                    <td className="text-right tabular-nums" style={{
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: i.isNegativeStock ? 'var(--danger)' : (i.isLowStock ? 'var(--warning-text)' : 'inherit')
                    }}>
                      {i.balance} {i.unit}
                    </td>
                    <td className="text-right tabular-nums">
                      KES {Number(i.averageCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                      KES {Number(i.stockValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-center">
                      {i.isNegativeStock ? (
                        <span className="badge badge-danger">NEGATIVE STOCK</span>
                      ) : i.isLowStock ? (
                        <span className="badge badge-warning">LOW STOCK</span>
                      ) : (
                        <span className="badge badge-success">HEALTHY</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Detailed Movement Audit Ledger (Requirement 15) */}
      {activeTab === 'ledger' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tx #</th>
                <th>Date</th>
                <th>Item Type</th>
                <th>Item Name</th>
                <th>Movement Type</th>
                <th className="text-right">Qty Change</th>
                <th className="text-right">Unit Value</th>
                <th className="text-right">Total Value</th>
                <th>Ref & Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading movement ledger...</td></tr>
              ) : ledger.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No ledger movements found.</td></tr>
              ) : (
                ledger.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tx.transaction_number}</td>
                    <td style={{ fontWeight: 600 }}>{tx.date}</td>
                    <td>
                      <span className={`badge ${tx.item_type === 'PRODUCT' ? 'badge-info' : 'badge-neutral'}`}>
                        {tx.item_type}
                      </span>
                    </td>
                    <td><strong>{tx.item_name}</strong></td>
                    <td>
                      <span className={`badge ${tx.quantity_change > 0 ? 'badge-success' : 'badge-danger'}`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="text-right tabular-nums" style={{
                      fontWeight: 800,
                      color: tx.quantity_change > 0 ? 'var(--success)' : 'var(--danger-text)'
                    }}>
                      {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change} {tx.unit}
                    </td>
                    <td className="text-right tabular-nums">
                      {tx.unit_cost > 0 ? `KES ${Number(tx.unit_cost).toLocaleString()}` : '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {tx.total_value > 0 ? `KES ${Number(tx.total_value).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <strong>{tx.batch_reference || '—'}</strong> • {tx.notes || ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
