import React, { useState, useEffect } from 'react';
import { api } from '../api';import SearchableSelect from '../components/SearchableSelect';import { Plus, Search, RotateCcw, AlertCircle, Download } from 'lucide-react';

export default function ReturnsView() {
  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    invoice_number: '',
    product_id: '',
    quantity: 1,
    unit_cost: 0,
    reason: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [retRes, prodsRes, custsRes] = await Promise.all([
        api.getReturns({ search, startDate, endDate }),
        api.getProducts({ activeOnly: true }),
        api.getCustomers()
      ]);
      setReturns(retRes.returns || []);
      setProducts(prodsRes || []);
      setCustomers(custsRes || []);
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
      unit_cost: prod ? prod.selling_price : 0
    });
  };

  const calculatedReturnValue = (Number(formData.quantity) || 0) * (Number(formData.unit_cost) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.product_id) {
      setErrorMsg('Please select a product.');
      return;
    }
    if (Number(formData.quantity) <= 0) {
      setErrorMsg('Quantity returned must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createReturn({
        date: formData.date,
        customer_id: formData.customer_id ? Number(formData.customer_id) : null,
        customer_name: formData.customer_name,
        invoice_number: formData.invoice_number,
        product_id: Number(formData.product_id),
        quantity: Number(formData.quantity),
        unit_cost: Number(formData.unit_cost),
        reason: formData.reason,
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sales Returns Management</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Record returned cakes, restore stock balance, and adjust net sales figures.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getReportExportUrl('sales_returns')}
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
                customer_id: '',
                customer_name: '',
                invoice_number: '',
                product_id: '',
                quantity: 1,
                unit_cost: 0,
                reason: '',
                notes: ''
              });
              setErrorMsg('');
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Record Return
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
              placeholder="Search return number, invoice #, customer or reason..."
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

      {/* Returns Table (Matches Sales Returns Sheet format) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Return #</th>
              <th>Customer</th>
              <th>Invoice #</th>
              <th>Product Returned</th>
              <th className="text-right">Quantity Returned</th>
              <th className="text-right">Unit Value</th>
              <th className="text-right">Total Return Value</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading returns...</td></tr>
            ) : returns.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No returns recorded.</td></tr>
            ) : (
              returns.map(r => {
                const item = r.items?.[0] || {};
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.date}</td>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{r.return_number}</strong>
                    </td>
                    <td>{r.customer_name || 'Walk-in'}</td>
                    <td><span className="badge badge-neutral">{r.invoice_number || '—'}</span></td>
                    <td><strong>{item.product_name || '—'}</strong></td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--success)', fontWeight: 800 }}>
                      +{item.quantity}
                    </td>
                    <td className="text-right tabular-nums">KES {Number(item.unit_cost || 0).toLocaleString()}</td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>
                      KES {Number(r.total_return_value).toLocaleString()}
                    </td>
                    <td>{r.reason || item.reason || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Record Return Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} color="var(--primary)" />
                Record Customer Sale Return
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
                    <label className="form-label">Return Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer</label>
                    <SearchableSelect
                      value={formData.customer_id}
                      onChange={(value) => {
                        const customer = customers.find(item => String(item.id) === String(value));
                        setFormData({ ...formData, customer_id: value, customer_name: customer?.name || '' });
                      }}
                      options={customers.map(customer => ({
                        id: customer.id,
                        label: customer.name,
                        meta: customer.phone ? customer.phone : 'No phone number',
                        searchText: `${customer.name} ${customer.phone} ${customer.customer_code}`
                      }))}
                      placeholder="Search customer..."
                      emptyMessage="No matching customer found."
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Original Invoice # (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. INV-20261001-001"
                      value={formData.invoice_number}
                      onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cake / Product Returned *</label>
                    <SearchableSelect
                      value={formData.product_id}
                      onChange={handleProductChange}
                      options={products.map(product => ({
                        id: product.id,
                        label: product.name,
                        meta: `${product.unit || 'pcs'} • Stock: ${product.current_stock ?? 0}`,
                        searchText: `${product.name} ${product.category || ''} ${product.product_code || ''}`
                      }))}
                      placeholder="Search or select cake..."
                      emptyMessage="No matching cake found."
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity Returned *</label>
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
                    <label className="form-label">Unit Value / Selling Price (KES)</label>
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
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL RETURN VALUE:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">
                    KES {calculatedReturnValue.toLocaleString()}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Return *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Wrong flavor, damaged packaging, over-ordered"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Return & Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
