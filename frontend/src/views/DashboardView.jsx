import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  TrendingUp,
  Boxes,
  ShoppingCart,
  Wheat,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  Award,
  Users
} from 'lucide-react';

export default function DashboardView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard({ period, startDate, endDate });
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const handleCustomFilter = (e) => {
    e.preventDefault();
    loadData();
  };

  const k = data?.kpis || {};
  const charts = data?.charts || {};
  const alerts = data?.alerts || {};

  return (
    <div className="page-wrapper">
      {/* Date Range Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Calendar size={18} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Period:</span>

            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' }
            ].map(p => (
              <button
                key={p.id}
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setPeriod(p.id); setStartDate(''); setEndDate(''); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          <form onSubmit={handleCustomFilter} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: '140px', padding: '6px 10px', fontSize: '0.8rem' }}
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPeriod('custom'); }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '140px', padding: '6px 10px', fontSize: '0.8rem' }}
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPeriod('custom'); }}
            />
            <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
          </form>
        </div>
      </div>

      {/* Primary KPI Grid (Matches Excel Dashboard Rows 5 & 9) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="kpi-card">
          <div className="kpi-label">TOTAL GROSS SALES</div>
          <div className="kpi-value text-primary tabular-nums" style={{ color: 'var(--primary)' }}>
            KES {(k.totalSales || 0).toLocaleString()}
          </div>
          <div className="kpi-sub">Today: KES {(k.todaySales || 0).toLocaleString()}</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="kpi-label">NET PROFIT</div>
          <div className="kpi-value tabular-nums" style={{ color: k.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            KES {(k.netProfit || 0).toLocaleString()}
          </div>
          <div className="kpi-sub">Margin: <strong>{k.profitMargin || 0}%</strong></div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div className="kpi-label">CAKES SOLD</div>
          <div className="kpi-value tabular-nums" style={{ color: '#3B82F6' }}>
            {(k.cakesSold || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>pcs</span>
          </div>
          <div className="kpi-sub">Gross Sales / Orders</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="kpi-label">CAKES IN STOCK</div>
          <div className="kpi-value tabular-nums" style={{ color: '#8B5CF6' }}>
            {(k.cakesInStock || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>pcs</span>
          </div>
          <div className="kpi-sub">Finished Goods Inventory</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="kpi-label">CAKES PRODUCED</div>
          <div className="kpi-value tabular-nums" style={{ color: '#F59E0B' }}>
            {(k.cakesProduced || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>pcs</span>
          </div>
          <div className="kpi-sub">Today: {(k.todayProduction || 0).toLocaleString()} pcs</div>
        </div>
      </div>

      {/* Secondary Operational Grid (Excel Dashboard Rows 9 & 15) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '28px'
      }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            <Wheat size={16} color="var(--primary)" />
            INGREDIENTS RECEIVED
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px' }} className="tabular-nums">
            {(k.totalIngredientsReceived || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>units</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            <Layers size={16} color="var(--primary)" />
            INGREDIENTS USED
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px' }} className="tabular-nums">
            {(k.totalIngredientsUsed || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>units</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            <DollarSign size={16} color="#10B981" />
            INGREDIENT STOCK VALUE
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px' }} className="tabular-nums">
            KES {(k.ingredientStockValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            <Users size={16} color="#3B82F6" />
            CUSTOMER OUTSTANDING
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px', color: k.customerOutstanding > 0 ? 'var(--warning-text)' : 'inherit' }} className="tabular-nums">
            KES {(k.customerOutstanding || 0).toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            <RotateCcw size={16} color="#EF4444" />
            SALES RETURNS
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px' }} className="tabular-nums">
            KES {(k.salesReturns || 0).toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            <AlertTriangle size={16} color="#EF4444" />
            DAMAGE / SPOILAGE
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px' }} className="tabular-nums">
            KES {(k.damages || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main Analysis Sections & Visual Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Product Sales Distribution Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <ShoppingCart size={18} color="var(--primary)" />
              Product Sales & Demand Breakdown
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('sales')}>View All Sales</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            {charts.productSalesDistribution?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No sales data for this period.</p>
            ) : (
              charts.productSalesDistribution?.map(p => {
                const maxSales = Math.max(...charts.productSalesDistribution.map(x => x.total_sales || 1));
                const pct = Math.min(100, Math.round((p.total_sales / maxSales) * 100));
                return (
                  <div key={p.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                      <span className="tabular-nums">
                        <strong>{p.quantity_sold} pcs</strong> sold • KES {Number(p.total_sales).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, #F59E0B 100%)', borderRadius: '99px' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Current Cake Stock Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Boxes size={18} color="#8B5CF6" />
              Finished Cakes In Stock
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('inventory')}>Inventory Ledger</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {charts.productStockBreakdown?.map(item => (
              <div key={item.name} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Finished product ready for sale</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }} className="tabular-nums">
                    {item.closing} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>pcs</span>
                  </div>
                  <span className={`badge ${item.closing > 50 ? 'badge-success' : (item.closing > 0 ? 'badge-warning' : 'badge-danger')}`}>
                    {item.closing > 50 ? 'IN STOCK' : (item.closing > 0 ? 'LOW STOCK' : 'OUT OF STOCK')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Snapshot & Management Focus (Matching Excel Dashboard Row 14) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>
            <Award size={18} color="var(--primary)" />
            Management Focus & Action Items
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
              <span><strong>Monitor cake inventory against daily demand</strong> to minimize stock-outs and eliminate wastage.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
              <span><strong>Review sales returns and damage values weekly</strong> to maintain baking consistency and quality.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
              <span><strong>Track ingredient usage against production volume</strong> to safeguard production margins.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
              <span><strong>Follow up customer outstanding balances promptly</strong> to maintain healthy cash flow.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
              <span><strong>Compare sales and net profit each month</strong> using the Daily Profit module.</span>
            </li>
          </ul>
        </div>

        {/* Worker Productivity Snapshot */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Users size={18} color="#10B981" />
              Baker Team Productivity
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('workers')}>View Performance</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {charts.workerProductionStats?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No worker production shifts recorded for this period.</p>
            ) : (
              charts.workerProductionStats?.map(w => {
                const kgHr = w.total_hours > 0 ? (w.total_produced / w.total_hours).toFixed(1) : 0;
                return (
                  <div key={w.worker_name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface-subtle)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{w.worker_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{w.total_hours} shift hours</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }} className="tabular-nums">
                        {w.total_produced} cakes
                      </div>
                      <span className="badge badge-info">{kgHr} kg/hr</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
