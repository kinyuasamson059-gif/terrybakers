import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { TrendingUp, Download, Calendar, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function DailyProfitView() {
  const [profitData, setProfitData] = useState({ daily: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDailyProfit({ startDate, endDate });
      setProfitData(res || { daily: [], summary: {} });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const s = profitData.summary || {};

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Daily Profit & Loss (P&L) Engine</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Dynamic P&L calculation: Net Sales - COGS = Gross Profit; Gross Profit - Damages - Expenses = Net Profit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getReportExportUrl('daily_profit', { startDate, endDate })}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Download Clean Excel Report"
          >
            <Download size={15} /> Export Profit Excel
          </a>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Calendar size={18} color="var(--primary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Filter Date Range:</span>
          <input
            type="date"
            className="form-input"
            style={{ width: '150px', padding: '6px 10px' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            className="form-input"
            style={{ width: '150px', padding: '6px 10px' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {(startDate || endDate) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setStartDate(''); setEndDate(''); }}
            >
              Reset to All Time
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>GROSS SALES</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }} className="tabular-nums">
            KES {(s.grossSales || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Returns: -KES {(s.salesReturns || 0).toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET SALES</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3B82F6', marginTop: '4px' }} className="tabular-nums">
            KES {(s.netSales || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Gross Sales - Returns
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>COGS / PRODUCTION COST</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }} className="tabular-nums">
            KES {(s.cogs || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Recipe ingredient costs
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>GROSS PROFIT</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8B5CF6', marginTop: '4px' }} className="tabular-nums">
            KES {(s.grossProfit || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Net Sales - COGS
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET PROFIT</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '4px' }} className="tabular-nums">
            KES {(s.netProfit || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Margin: <strong>{s.profitMargin || 0}%</strong>
          </div>
        </div>
      </div>

      {/* Daily Profit Table (Matches Daily Profit Sheet format exactly) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Gross Sales</th>
              <th className="text-right">Sales Returns (-)</th>
              <th className="text-right">Net Sales</th>
              <th className="text-right">COGS / Production Cost (-)</th>
              <th className="text-right">Sales Damages (-)</th>
              <th className="text-right">Other Expenses (-)</th>
              <th className="text-right">Gross Profit</th>
              <th className="text-right">Net Profit</th>
              <th className="text-right">Profit Margin %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px' }}>Calculating daily profit...</td></tr>
            ) : profitData.daily?.length === 0 ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No transactional activity for selected range.</td></tr>
            ) : (
              profitData.daily?.map(row => (
                <tr key={row.date}>
                  <td style={{ fontWeight: 700 }}>{row.date}</td>
                  <td className="text-right tabular-nums">KES {row.grossSales.toLocaleString()}</td>
                  <td className="text-right tabular-nums" style={{ color: row.salesReturns > 0 ? 'var(--danger-text)' : 'inherit' }}>
                    {row.salesReturns > 0 ? `-KES ${row.salesReturns.toLocaleString()}` : '—'}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                    KES {row.netSales.toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    KES {row.cogs.toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{ color: row.salesDamages > 0 ? 'var(--danger-text)' : 'inherit' }}>
                    {row.salesDamages > 0 ? `-KES ${row.salesDamages.toLocaleString()}` : '—'}
                  </td>
                  <td className="text-right tabular-nums" style={{ color: row.otherExpenses > 0 ? 'var(--danger-text)' : 'inherit' }}>
                    {row.otherExpenses > 0 ? `-KES ${row.otherExpenses.toLocaleString()}` : '—'}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700, color: row.grossProfit >= 0 ? 'inherit' : 'var(--danger)' }}>
                    KES {row.grossProfit.toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: row.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    KES {row.netProfit.toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                    <span className={`badge ${row.profitMargin >= 25 ? 'badge-success' : (row.profitMargin > 0 ? 'badge-warning' : 'badge-danger')}`}>
                      {row.profitMargin}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {profitData.daily?.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--surface-subtle)', fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                <td>TOTALS:</td>
                <td className="text-right tabular-nums">KES {s.grossSales.toLocaleString()}</td>
                <td className="text-right tabular-nums">-KES {s.salesReturns.toLocaleString()}</td>
                <td className="text-right tabular-nums">KES {s.netSales.toLocaleString()}</td>
                <td className="text-right tabular-nums">KES {s.cogs.toLocaleString()}</td>
                <td className="text-right tabular-nums">-KES {s.salesDamages.toLocaleString()}</td>
                <td className="text-right tabular-nums">-KES {s.otherExpenses.toLocaleString()}</td>
                <td className="text-right tabular-nums">KES {s.grossProfit.toLocaleString()}</td>
                <td className="text-right tabular-nums" style={{ color: s.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.05rem' }}>
                  KES {s.netProfit.toLocaleString()}
                </td>
                <td className="text-right tabular-nums">{s.profitMargin}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
