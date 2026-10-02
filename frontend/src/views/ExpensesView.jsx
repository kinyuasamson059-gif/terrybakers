import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Search, Receipt, Download } from 'lucide-react';

export default function ExpensesView() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Utilities & Electricity',
    description: '',
    amount: '',
    payment_method: 'Cash',
    reference: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [expRes, catsRes] = await Promise.all([
        api.getExpenses({ search, category: selectedCat, startDate, endDate }),
        api.getExpenseCategories()
      ]);
      setExpenses(expRes.expenses || []);
      setCategories(catsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCat, startDate, endDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const amt = Number(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Expense amount must be greater than zero.');
      return;
    }
    if (!formData.description.trim()) {
      setErrorMsg('Description is required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createExpense({
        ...formData,
        amount: amt
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Operating Expenses</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Track recurring bakery operating costs (utilities, fuel, rent, maintenance) feeding into Daily Profit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getReportExportUrl('expenses')}
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
                category: categories[0] || 'Utilities & Electricity',
                description: '',
                amount: '',
                payment_method: 'Cash',
                reference: '',
                notes: ''
              });
              setErrorMsg('');
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Record Expense
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
              placeholder="Search description, reference or expense #..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ width: '230px' }}>
            <SearchableSelect
              value={selectedCat}
              onChange={setSelectedCat}
              options={[{ id: '', label: 'All Categories' }, ...categories.map(category => ({ id: category, label: category, searchText: category }))]}
              placeholder="Search category filter..."
              emptyMessage="No matching category found."
              allowClear={true}
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

      {/* Expenses Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Expense #</th>
              <th>Category</th>
              <th>Description</th>
              <th className="text-right">Amount (KES)</th>
              <th>Payment Method</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading expenses...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No expense records found.</td></tr>
            ) : (
              expenses.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.date}</td>
                  <td>
                    <strong style={{ color: 'var(--primary)' }}>{e.expense_number}</strong>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{e.category}</span>
                  </td>
                  <td><strong>{e.description}</strong></td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    KES {Number(e.amount).toLocaleString()}
                  </td>
                  <td>{e.payment_method}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.reference || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--surface-subtle)', fontWeight: 800 }}>
                <td colSpan="4" style={{ textAlign: 'right', padding: '14px 16px' }}>TOTAL EXPENSES:</td>
                <td className="text-right tabular-nums" style={{ padding: '14px 16px', fontSize: '1.05rem', color: 'var(--danger)' }}>
                  KES {totalExpenseAmount.toLocaleString()}
                </td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Record Expense Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} color="var(--primary)" />
                Record Operating Expense
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
                    <label className="form-label">Expense Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <SearchableSelect
                      value={formData.category}
                      onChange={(value) => setFormData({ ...formData, category: value })}
                      options={categories.map(category => ({
                        id: category,
                        label: category,
                        searchText: category
                      }))}
                      placeholder="Search category..."
                      emptyMessage="No matching category found."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Purpose *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Electricity bill for oven line, Transport for flour delivery"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount (KES) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money (M-Pesa)</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Receipt / Voucher Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. VOUCH-001 or MPESA Code"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  />
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
