import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Search, PackagePlus, AlertCircle, Download } from 'lucide-react';

export default function PurchasesView() {
  const [purchases, setPurchases] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeTab, setActiveTab] = useState('history');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ingredient_id: '',
    unit: 'kg',
    quantity: 1,
    cost_per_unit: 0,
    supplier_name: '',
    batch_reference: '',
    payment_status: 'PAID',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [ingredientDraft, setIngredientDraft] = useState({
    name: '',
    unit: 'kg',
    min_stock_level: 10,
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, ingsRes] = await Promise.all([
        api.getPurchases({ search, startDate, endDate }),
        api.getIngredients({ activeOnly: true })
      ]);
      setPurchases(purchasesRes.purchases || []);
      setIngredients(ingsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, startDate, endDate]);

  const handleIngredientChange = (ingId) => {
    const ing = ingredients.find(i => String(i.id) === String(ingId));
    setFormData({
      ...formData,
      ingredient_id: ingId,
      unit: ing ? ing.unit : 'kg',
      cost_per_unit: ing?.average_cost > 0 ? ing.average_cost : formData.cost_per_unit
    });
  };

  // Total cost is strictly calculated: Quantity * Cost per unit (cannot be manually edited!)
  const calculatedTotalCost = (Number(formData.quantity) || 0) * (Number(formData.cost_per_unit) || 0);

  const handleQuickAddIngredient = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!ingredientDraft.name.trim()) {
      setErrorMsg('Ingredient name is required.');
      return;
    }

    try {
      const created = await api.createIngredient({
        ...ingredientDraft,
        name: ingredientDraft.name.trim(),
        opening_stock: 0,
        cost_per_unit: 0,
        active: true
      });

      await loadData();
      setFormData({
        ...formData,
        ingredient_id: String(created.id),
        unit: created.unit || ingredientDraft.unit,
        cost_per_unit: Number(created.average_cost || formData.cost_per_unit || 0)
      });
      setShowIngredientModal(false);
      setIngredientDraft({ name: '', unit: 'kg', min_stock_level: 10, notes: '' });
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.ingredient_id) {
      setErrorMsg('Please select an ingredient.');
      return;
    }
    if (Number(formData.quantity) <= 0) {
      setErrorMsg('Quantity must be greater than zero.');
      return;
    }
    if (Number(formData.cost_per_unit) < 0) {
      setErrorMsg('Cost per unit cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPurchase({
        date: formData.date,
        ingredient_id: Number(formData.ingredient_id),
        unit: formData.unit,
        quantity: Number(formData.quantity),
        cost_per_unit: Number(formData.cost_per_unit),
        supplier_name: formData.supplier_name.trim(),
        batch_reference: formData.batch_reference.trim(),
        payment_status: formData.payment_status,
        notes: formData.notes
      });
      setActiveTab('history');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        ingredient_id: '',
        unit: 'kg',
        quantity: 1,
        cost_per_unit: 0,
        supplier_name: '',
        batch_reference: '',
        payment_status: 'PAID',
        notes: ''
      });
      await loadData();
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Ingredient Purchases (Ingredients In)</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Record raw material intakes, update weighted average costs, and credit inventory ledger balances.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getReportExportUrl('ingredient_purchases')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Download Clean Excel Report"
          >
            <Download size={15} /> Export Excel
          </a>
          <button className="btn btn-primary" onClick={() => setActiveTab('entry')}>
            <Plus size={16} />
            <span>New Purchase Entry</span>
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Purchase views" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('history')}
        >
          Purchase History
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'entry'}
          className={`btn btn-sm ${activeTab === 'entry' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('entry')}
        >
          <PackagePlus size={14} /> Purchase Entry
        </button>
      </div>

      {activeTab === 'history' && (
        <>
      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search purchase number, ingredient, supplier, or batch ref..."
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
            {(search || startDate || endDate) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Purchases Table (Matching Ingredients In sheet format) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Purchase #</th>
              <th>Ingredient</th>
              <th>Unit</th>
              <th className="text-right">Quantity In</th>
              <th className="text-right">Cost / Unit</th>
              <th className="text-right">Total Cost</th>
              <th>Supplier</th>
              <th>Batch / Reference</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading purchases...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No purchases recorded.</td></tr>
            ) : (
              purchases.map(p => {
                const item = p.items?.[0] || {};
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.date}</td>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{p.purchase_number}</strong>
                    </td>
                    <td>
                      <strong>{item.ingredient_name || '—'}</strong>
                    </td>
                    <td>{item.unit || '—'}</td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 700, color: 'var(--success)' }}>
                      +{item.quantity}
                    </td>
                    <td className="text-right tabular-nums">
                      KES {Number(item.cost_per_unit || 0).toLocaleString()}
                    </td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      KES {Number(p.total_amount).toLocaleString()}
                    </td>
                    <td>{p.supplier_name || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <span className="badge badge-neutral">{p.batch_reference || '—'}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {activeTab === 'entry' && (
        <form onSubmit={handleSubmit} style={{ maxWidth: '900px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Record Ingredient Purchase</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Add received stock and update the ingredient inventory ledger.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('history')}>Cancel</button>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Date *</label>
              <input type="date" className="form-input" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
            </div>

            <div className="form-group">
              <label className="form-label">Ingredient *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect
                    value={formData.ingredient_id}
                    onChange={handleIngredientChange}
                    options={ingredients.map(ingredient => ({
                      id: ingredient.id,
                      label: ingredient.name,
                      meta: `${ingredient.unit} • Avg Cost: KES ${Number(ingredient.average_cost || 0).toLocaleString()}`,
                      searchText: `${ingredient.name} ${ingredient.unit} ${ingredient.ingredient_code || ''}`
                    }))}
                    placeholder="Search or select ingredient..."
                    emptyMessage="No matching ingredient found."
                  />
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowIngredientModal(true)} title="Add new ingredient">
                  + Add
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity In *</label>
              <input type="number" step="0.01" min="0.01" className="form-input" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Cost per Unit (KES) *</label>
              <input type="number" step="0.01" min="0" className="form-input" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <input type="text" className="form-input" value={formData.unit} readOnly disabled />
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>CALCULATED TOTAL COST (QTY × COST/UNIT)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculated automatically from quantity and unit cost.</div>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">KES {calculatedTotalCost.toLocaleString()}</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier Name</label>
              <input type="text" className="form-input" placeholder="e.g. Unga Millers or Local Market" value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch / Reference</label>
              <input type="text" className="form-input" placeholder="e.g. B0001" value={formData.batch_reference} onChange={(e) => setFormData({ ...formData, batch_reference: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-select" value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('history')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <PackagePlus size={16} /> {submitting ? 'Saving...' : 'Record Purchase'}
            </button>
          </div>
        </form>
      )}

      {/* Quick Add Ingredient Modal */}
      {showIngredientModal && (
        <div className="modal-overlay" onClick={() => setShowIngredientModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Add New Ingredient</h3>
              <button onClick={() => setShowIngredientModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleQuickAddIngredient}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Ingredient Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ingredientDraft.name}
                    onChange={(e) => setIngredientDraft({ ...ingredientDraft, name: e.target.value })}
                    placeholder="e.g. Flour, Sugar, Butter"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ingredientDraft.unit}
                    onChange={(e) => setIngredientDraft({ ...ingredientDraft, unit: e.target.value })}
                    placeholder="kg, pack, box, litre"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Stock Level</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={ingredientDraft.min_stock_level}
                    onChange={(e) => setIngredientDraft({ ...ingredientDraft, min_stock_level: Number(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={ingredientDraft.notes}
                    onChange={(e) => setIngredientDraft({ ...ingredientDraft, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowIngredientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Ingredient</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
