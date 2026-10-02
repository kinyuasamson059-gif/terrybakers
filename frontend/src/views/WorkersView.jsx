import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { UserCheck, Plus, Search, Calendar, Award, Clock } from 'lucide-react';

export default function WorkersView() {
  const [records, setRecords] = useState([]);
  const [aggregated, setAggregated] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [groupBy, setGroupBy] = useState('worker'); // 'worker', 'day', 'week', 'month', 'product'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  const [shiftData, setShiftData] = useState({
    date: new Date().toISOString().split('T')[0],
    worker_id: '',
    product_id: '',
    quantity_produced: '',
    production_hours: '',
    batch_reference: '',
    notes: ''
  });

  const [workerData, setWorkerData] = useState({
    name: '',
    phone: '',
    role: 'Baker',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [perfRes, workersRes, prodsRes] = await Promise.all([
        api.getWorkerPerformance({ groupBy, startDate, endDate }),
        api.getWorkers(),
        api.getProducts({ activeOnly: true })
      ]);
      setRecords(perfRes.records || []);
      setAggregated(perfRes.aggregated || []);
      setWorkers(workersRes || []);
      setProducts(prodsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupBy, startDate, endDate]);

  const handleSaveShift = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const qty = Number(shiftData.quantity_produced);
    const hrs = Number(shiftData.production_hours);

    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Quantity produced must be greater than zero.');
      return;
    }
    if (isNaN(hrs) || hrs <= 0) {
      setErrorMsg('Production hours must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.recordWorkerProduction(shiftData);
      setShowShiftModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveWorker = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!workerData.name.trim()) {
      setErrorMsg('Worker name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createWorker(workerData);
      setShowWorkerModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Worker Productivity & Performance</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Track baker shifts, output volumes, speed metrics (KG/Hour), and standard 8KG unit calculations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowWorkerModal(true)}>
            <UserCheck size={16} /> Add Baker
          </button>
          <button className="btn btn-primary" onClick={() => setShowShiftModal(true)}>
            <Plus size={16} /> Record Shift Performance
          </button>
        </div>
      </div>

      {/* Aggregate Grouping & Date Filter Card */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Group Performance By:</span>
            {[
              { id: 'worker', label: 'Baker / Worker' },
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'product', label: 'Product' }
            ].map(g => (
              <button
                key={g.id}
                className={`btn btn-sm ${groupBy === g.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGroupBy(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: '140px', padding: '6px 10px', fontSize: '0.8rem' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '140px', padding: '6px 10px', fontSize: '0.8rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Aggregated Performance Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {aggregated.map((agg, idx) => (
          <div key={idx} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{agg.group_key || 'Unknown'}</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agg.shift_count} shifts recorded</div>
              </div>
              <span className="badge badge-info">{Number(agg.avg_kg_per_hour || 0).toFixed(1)} KG/HR</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OUTPUT</div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }} className="tabular-nums">
                  {agg.total_produced} <span style={{ fontSize: '0.7rem' }}>cakes</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HOURS</div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }} className="tabular-nums">
                  {agg.total_hours} <span style={{ fontSize: '0.7rem' }}>hrs</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>8KG UNITS</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }} className="tabular-nums">
                  {agg.total_8kg_units}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Records Table (Matches Worker Production Sheet) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Worker Name</th>
              <th>Product Baked</th>
              <th className="text-right">Quantity Produced</th>
              <th className="text-right">Production Hours</th>
              <th className="text-right">KG / Hour (Speed)</th>
              <th className="text-right">8KG Units</th>
              <th>Batch Ref</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading worker performance...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No worker records found.</td></tr>
            ) : (
              records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.date}</td>
                  <td>
                    <strong style={{ fontSize: '0.95rem' }}>{r.worker_name}</strong>
                  </td>
                  <td>{r.product_name}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>
                    {r.quantity_produced}
                  </td>
                  <td className="text-right tabular-nums">{r.production_hours} hrs</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {Number(r.kg_per_hour).toFixed(1)}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                    {Number(r.eight_kg_units).toFixed(1)}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}><span className="badge badge-neutral">{r.batch_reference || '—'}</span></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Shift Modal */}
      {showShiftModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" />
                Record Worker Shift Production
              </h3>
              <button onClick={() => setShowShiftModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveShift}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Shift Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={shiftData.date}
                      onChange={(e) => setShiftData({ ...shiftData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Worker / Baker *</label>
                    <SearchableSelect
                      value={shiftData.worker_id}
                      onChange={(value) => {
                        const worker = workers.find(item => String(item.id) === String(value));
                        setShiftData({ ...shiftData, worker_id: value, worker_name: worker?.name });
                      }}
                      options={workers.map(worker => ({
                        id: worker.id,
                        label: worker.name,
                        meta: worker.role || 'Baker',
                        searchText: `${worker.name} ${worker.worker_code || ''}`
                      }))}
                      placeholder="Search worker..."
                      emptyMessage="No matching worker found."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Baked *</label>
                  <SearchableSelect
                    value={shiftData.product_id}
                    onChange={(value) => {
                      const product = products.find(item => String(item.id) === String(value));
                      setShiftData({ ...shiftData, product_id: value, product_name: product?.name });
                    }}
                    options={products.map(product => ({
                      id: product.id,
                      label: product.name,
                      meta: product.unit || 'pcs',
                      searchText: `${product.name} ${product.category || ''}`
                    }))}
                    placeholder="Search or select cake..."
                    emptyMessage="No matching cake found."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity Produced *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={shiftData.quantity_produced}
                      onChange={(e) => setShiftData({ ...shiftData, quantity_produced: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Production Hours *</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.1"
                      className="form-input"
                      value={shiftData.production_hours}
                      onChange={(e) => setShiftData({ ...shiftData, production_hours: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch / Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. B0001"
                    value={shiftData.batch_reference}
                    onChange={(e) => setShiftData({ ...shiftData, batch_reference: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={shiftData.notes}
                    onChange={(e) => setShiftData({ ...shiftData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowShiftModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Record Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      {showWorkerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Add Bakery Staff / Baker</h3>
              <button onClick={() => setShowWorkerModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveWorker}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workerData.name}
                    onChange={(e) => setWorkerData({ ...workerData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workerData.role}
                    onChange={(e) => setWorkerData({ ...workerData, role: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workerData.phone}
                    onChange={(e) => setWorkerData({ ...workerData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowWorkerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Save Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
