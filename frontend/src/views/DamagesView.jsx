import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Search, AlertTriangle, Download } from 'lucide-react';

export default function DamagesView({ currentUser }) {
  const [damages, setDamages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    product_id: '',
    quantity: 1,
    unit_cost: 0,
    reason: '',
    department_worker: '',
    approved_by: currentUser?.full_name || 'Admin',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [dmgRes, prodsRes] = await Promise.all([
        api.getDamages({ search, startDate, endDate }),
        api.getProducts({ activeOnly: true })
      ]);
      setDamages(dmgRes.damages || []);
      setProducts(prodsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, startDate, endDate]);

  const handleProductChange = (prodId) => {
    const prod = products.find(p => String(p.id) === String(prodId));
    setFormData({
      ...formData,
      product_id: prodId,
      unit_cost: prod ? (prod.cost_price || prod.selling_price) : 0
    });
  };

  const calculatedDamageValue = (Number(formData.quantity) || 0) * (Number(formData.unit_cost) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.product_id) {
      setErrorMsg('Please select a product.');
      return;
    }
    if (Number(formData.quantity) <= 0) {
      setErrorMsg('Quantity damaged must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createDamage({
        date: formData.date,
        product_id: Number(formData.product_id),
        quantity: Number(formData.quantity),
        unit_cost: Number(formData.unit_cost),
        reason: formData.reason,
        department_worker: formData.department_worker,
        approved_by: formData.approved_by,
        notes: formData.notes
      });
      setShowModal(false);
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Product Damages & Spoilage</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Record baking defects, transit damages, and expired cakes with supervisor approvals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getReportExportUrl('damages')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Download Clean Excel Report"
          >
            <Download size={15} /> Export Excel
          </a>
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormData({
                date: new Date().toISOString().split('T')[0],
                product_id: '',
                quantity: 1,
                unit_cost: 0,
                reason: '',
                department_worker: '',
                approved_by: currentUser?.full_name || 'Admin',
                notes: ''
              });
              setErrorMsg('');
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Record Damage
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search damage number, cake, reason, or supervisor..."
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
          </div>
        </div>
      </div>

      {/* Damages Table (Matches Sales Damages Sheet format) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Damage #</th>
              <th>Product</th>
              <th className="text-right">Quantity Damaged</th>
              <th className="text-right">Unit Cost</th>
              <th className="text-right">Damage Value</th>
              <th>Reason</th>
              <th>Department / Worker</th>
              <th>Approved By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading damages...</td></tr>
            ) : damages.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No damage records found.</td></tr>
            ) : (
              damages.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.date}</td>
                  <td>
                    <strong style={{ color: 'var(--danger)' }}>{d.damage_number}</strong>
                  </td>
                  <td><strong>{d.product_name}</strong></td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--danger)', fontWeight: 800 }}>
                    -{d.quantity}
                  </td>
                  <td className="text-right tabular-nums">KES {Number(d.unit_cost).toLocaleString()}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>
                    KES {Number(d.damage_value).toLocaleString()}
                  </td>
                  <td>{d.reason || '—'}</td>
                  <td>{d.department_worker || '—'}</td>
                  <td>
                    <span className="badge badge-success">{d.approved_by || 'Approved'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Damage Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                Record & Approve Product Damage
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Damage Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Product Damaged *</label>
                    <SearchableSelect
                      value={formData.product_id}
                      onChange={handleProductChange}
                      options={products.map(product => ({
                        id: product.id,
                        label: product.name,
                        meta: `Stock: ${product.current_stock ?? 0} ${product.unit || 'pcs'}`,
                        searchText: `${product.name} ${product.category || ''}`
                      }))}
                      placeholder="Search or select cake..."
                      emptyMessage="No matching cake found."
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity Damaged *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Cost (KES)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--surface-subtle)', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>DAMAGE LOSS VALUE:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }} className="tabular-nums">
                    KES {calculatedDamageValue.toLocaleString()}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Damage *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Burnt in oven, dropped in packaging, crushed in delivery"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Department / Baker Responsible</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Bakery Section / Oven Line"
                      value={formData.department_worker}
                      onChange={(e) => setFormData({ ...formData, department_worker: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Approved By *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.approved_by}
                      onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? 'Approving...' : 'Approve & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
