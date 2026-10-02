import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Search, Users, DollarSign, FileText, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function CustomersView() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedForPayment, setSelectedForPayment] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementData, setStatementData] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    opening_balance: 0,
    credit_limit: 0,
    notes: ''
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'Cash',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers({ search, status: statusFilter });
      setCustomers(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, statusFilter]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', location: '', opening_balance: 0, credit_limit: 0, notes: '' });
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      location: c.location || '',
      opening_balance: c.opening_balance || 0,
      credit_limit: c.credit_limit || 0,
      notes: c.notes || ''
    });
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.name.trim()) {
      setErrorMsg('Customer name is required.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      setShowAddModal(false);
      loadCustomers();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPayment = (c) => {
    setSelectedForPayment(c);
    setPaymentData({
      amount: c.outstanding_balance > 0 ? c.outstanding_balance : '',
      payment_method: 'Cash',
      reference: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setErrorMsg('');
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const amt = Number(paymentData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Payment amount must be greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createPayment({
        customer_id: selectedForPayment.id,
        amount: amt,
        payment_method: paymentData.payment_method,
        reference: paymentData.reference,
        date: paymentData.date,
        notes: paymentData.notes
      });
      setShowPaymentModal(false);
      loadCustomers();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenStatement = async (c) => {
    try {
      const stmt = await api.getCustomerStatement(c.id);
      setStatementData(stmt);
      setShowStatementModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Customer Accounts & Credit Management</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Track client accounts, credit limits, invoices, payments, returns, and outstanding balances.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search customer name, phone, location or ID..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: '', label: 'All Statuses' },
              { id: 'OVER LIMIT', label: 'Over Limit' },
              { id: 'ACTIVE CREDIT', label: 'Active Credit' },
              { id: 'CLEAR', label: 'Clear' }
            ].map(st => (
              <button
                key={st.id}
                className={`btn btn-sm ${statusFilter === st.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Customer Name</th>
              <th>Contact & Location</th>
              <th className="text-right">Opening Bal</th>
              <th className="text-right">Credit Limit</th>
              <th className="text-right">Total Sales</th>
              <th className="text-right">Payments</th>
              <th className="text-right">Outstanding Bal</th>
              <th className="text-center">Status</th>
              <th className="text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px' }}>Loading customers...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No customers found. Click "Add New Customer" above.</td></tr>
            ) : (
              customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{c.customer_code}</td>
                  <td>
                    <strong style={{ fontSize: '0.95rem' }}>{c.name}</strong>
                    {c.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.notes}</div>}
                  </td>
                  <td>
                    <div>{c.phone || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.location || '—'}</div>
                  </td>
                  <td className="text-right tabular-nums">{Number(c.opening_balance).toLocaleString()}</td>
                  <td className="text-right tabular-nums">
                    {c.credit_limit > 0 ? Number(c.credit_limit).toLocaleString() : 'No Limit'}
                  </td>
                  <td className="text-right tabular-nums">{Number(c.total_sales).toLocaleString()}</td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>
                    {Number(c.total_payments).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 800, fontSize: '0.95rem', color: c.outstanding_balance > 0 ? 'var(--warning-text)' : 'inherit' }}>
                    KES {Number(c.outstanding_balance).toLocaleString()}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${c.account_status === 'OVER LIMIT' ? 'badge-danger' : (c.account_status === 'ACTIVE CREDIT' ? 'badge-warning' : 'badge-success')}`}>
                      {c.account_status}
                    </span>
                  </td>
                  <td className="text-right no-print">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenPayment(c)}
                        title="Record Payment Receipt"
                      >
                        <DollarSign size={13} color="var(--success)" /> Pay
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenStatement(c)}
                        title="View Full Customer Statement"
                      >
                        <FileText size={13} /> Statement
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(c)}
                        title="Edit Customer"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="var(--primary)" />
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveCustomer}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location / Address</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Opening Balance (KES)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Limit (0 = No limit)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedForPayment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={18} color="var(--success)" />
                Record Payment - {selectedForPayment.name}
              </h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSavePayment}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <div>Current Outstanding Balance: <strong style={{ color: 'var(--warning-text)' }}>KES {Number(selectedForPayment.outstanding_balance).toLocaleString()}</strong></div>
                </div>

                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Payment Amount (KES) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={paymentData.date}
                      onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={paymentData.payment_method}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money (M-Pesa)</option>
                      <option value="Bank">Bank Deposit/Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference / Receipt Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MPESA-XYZ or Cheque #"
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Ledger Modal */}
      {showStatementModal && statementData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  Customer Statement: {statementData.customer?.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Code: {statementData.customer?.customer_code} • Phone: {statementData.customer?.phone || '—'}
                </p>
              </div>
              <button onClick={() => setShowStatementModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', backgroundColor: 'var(--surface-subtle)', borderRadius: '8px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CREDIT LIMIT</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    {statementData.customer?.credit_limit > 0 ? `KES ${Number(statementData.customer.credit_limit).toLocaleString()}` : 'No Limit'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT OUTSTANDING</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: statementData.currentBalance > 0 ? 'var(--warning-text)' : 'var(--success)' }}>
                    KES {Number(statementData.currentBalance).toLocaleString()}
                  </div>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref / Doc</th>
                    <th>Type</th>
                    <th className="text-right">Debit (Sales)</th>
                    <th className="text-right">Credit (Paid)</th>
                    <th className="text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.statement?.map((entry, idx) => (
                    <tr key={idx}>
                      <td>{entry.date}</td>
                      <td><strong>{entry.ref}</strong></td>
                      <td><span className="badge badge-neutral">{entry.type}</span></td>
                      <td className="text-right tabular-nums">{entry.debit > 0 ? `KES ${Number(entry.debit).toLocaleString()}` : '—'}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>
                        {entry.credit > 0 ? `KES ${Number(entry.credit).toLocaleString()}` : '—'}
                      </td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 800 }}>
                        KES {Number(entry.balance).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer no-print">
              <button className="btn btn-secondary" onClick={() => setShowStatementModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                Print Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
