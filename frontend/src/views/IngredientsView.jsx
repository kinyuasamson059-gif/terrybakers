import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Search, Wheat, AlertTriangle, CheckCircle2, Download } from 'lucide-react';

export default function IngredientsView() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingIng, setEditingIng] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    min_stock_level: 10,
    opening_stock: 0,
    cost_per_unit: 0,
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getIngredients({ search });
      setIngredients(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleOpenAdd = () => {
    setEditingIng(null);
    setFormData({ name: '', unit: 'kg', min_stock_level: 10, opening_stock: 0, cost_per_unit: 0, notes: '' });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (ing) => {
    setEditingIng(ing);
    setFormData({
      name: ing.name,
      unit: ing.unit,
      min_stock_level: ing.min_stock_level,
      opening_stock: 0,
      cost_per_unit: ing.average_cost,
      notes: ing.notes || ''
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleToggle = async (ing) => {
    if (!window.confirm(`Are you sure you want to ${ing.active ? 'deactivate' : 'activate'} "${ing.name}"?`)) return;
    try {
      await api.toggleIngredient(ing.id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.name.trim()) {
      setErrorMsg('Ingredient name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingIng) {
        await api.updateIngredient(editingIng.id, formData);
      } else {
        await api.createIngredient(formData);
      }
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Raw Ingredients & Packaging Stock</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Track ingredient balances, minimum stock thresholds, and live weighted average purchase costs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getModuleExportUrl('ingredients')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Export Ingredients to Excel"
          >
            <Download size={15} /> Export Excel
          </a>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add New Ingredient</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search ingredient by name or code..."
            className="form-input"
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Ingredients Table (Matches Ingredients Balances sheet) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Ingredient Name</th>
              <th>Unit</th>
              <th className="text-right">Min Stock Level</th>
              <th className="text-right">Current Stock</th>
              <th className="text-right">Average Cost / Unit</th>
              <th className="text-right">Total Stock Value</th>
              <th className="text-center">Stock Status</th>
              <th className="text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading ingredients...</td></tr>
            ) : ingredients.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No ingredients found.</td></tr>
            ) : (
              ingredients.map(ing => {
                const stockVal = Math.max(0, ing.current_stock) * (ing.average_cost || 0);
                return (
                  <tr key={ing.id} style={{ opacity: ing.active ? 1 : 0.6 }}>
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{ing.ingredient_code}</td>
                    <td>
                      <strong style={{ fontSize: '0.95rem' }}>{ing.name}</strong>
                    </td>
                    <td><span className="badge badge-neutral">{ing.unit}</span></td>
                    <td className="text-right tabular-nums">{ing.min_stock_level} {ing.unit}</td>
                    <td className="text-right tabular-nums" style={{
                      fontWeight: 800,
                      fontSize: '1rem',
                      color: ing.is_negative_stock ? 'var(--danger)' : (ing.is_low_stock ? 'var(--warning-text)' : 'inherit')
                    }}>
                      {ing.current_stock} {ing.unit}
                    </td>
                    <td className="text-right tabular-nums">
                      KES {Number(ing.average_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                      KES {stockVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-center">
                      {ing.is_negative_stock ? (
                        <span className="badge badge-danger">NEGATIVE STOCK</span>
                      ) : ing.is_low_stock ? (
                        <span className="badge badge-warning">LOW STOCK</span>
                      ) : (
                        <span className="badge badge-success">HEALTHY</span>
                      )}
                    </td>
                    <td className="text-right no-print">
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(ing)}>Edit</button>
                        <button
                          className={`btn btn-sm ${ing.active ? 'btn-secondary' : 'btn-outline'}`}
                          onClick={() => handleToggle(ing)}
                        >
                          {ing.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Ingredient Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wheat size={18} color="var(--primary)" />
                {editingIng ? 'Edit Ingredient' : 'Add New Ingredient'}
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
                <div className="form-group">
                  <label className="form-label">Ingredient Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Flour, Sugar, Sobate, Eggs"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit of Measure *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. kg, Litre, pcs"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minimum Stock Alert Threshold</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {!editingIng && (
                  <div className="form-row" style={{ backgroundColor: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px', marginTop: '6px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Initial Opening Stock (Optional)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={formData.opening_stock}
                        onChange={(e) => setFormData({ ...formData, opening_stock: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Cost per Unit (KES)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={formData.cost_per_unit}
                        onChange={(e) => setFormData({ ...formData, cost_per_unit: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '12px' }}>
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
                  {submitting ? 'Saving...' : 'Save Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
