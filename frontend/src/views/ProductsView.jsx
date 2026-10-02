import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Search, Boxes, CheckCircle2, Download } from 'lucide-react';

export default function ProductsView() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Cakes',
    unit: 'pcs',
    selling_price: 0,
    cost_price: 0,
    opening_stock: 0,
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts({ search });
      setProducts(res || []);
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
    setEditingProd(null);
    setFormData({ name: '', category: 'Cakes', unit: 'pcs', selling_price: 0, cost_price: 0, opening_stock: 0, notes: '' });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProd(p);
    setFormData({
      name: p.name,
      category: p.category || 'Cakes',
      unit: p.unit || 'pcs',
      selling_price: p.selling_price || 0,
      cost_price: p.cost_price || 0,
      opening_stock: 0,
      notes: p.notes || ''
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleToggle = async (p) => {
    if (!window.confirm(`Are you sure you want to ${p.active ? 'deactivate' : 'activate'} "${p.name}"?`)) return;
    try {
      await api.toggleProduct(p.id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProd) {
        await api.updateProduct(editingProd.id, formData);
      } else {
        await api.createProduct(formData);
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Bakery Products & Finished Goods</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Manage finished cake catalog, default selling prices, production unit costs, and live stock.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getModuleExportUrl('products')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Export Products to Excel"
          >
            <Download size={15} /> Export Excel
          </a>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search product by name or code..."
            className="form-input"
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Products Table (Matches Cake Balance & Products requirements) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th className="text-right">Selling Price</th>
              <th className="text-right">Estimated Cost Price</th>
              <th className="text-right">Finished Stock Balance</th>
              <th className="text-center">Status</th>
              <th className="text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading products...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No products found.</td></tr>
            ) : (
              products.map(p => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{p.product_code}</td>
                  <td>
                    <strong style={{ fontSize: '0.95rem' }}>{p.name}</strong>
                    {p.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.notes}</div>}
                  </td>
                  <td><span className="badge badge-neutral">{p.category}</span></td>
                  <td>{p.unit}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                    KES {Number(p.selling_price).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    KES {Number(p.cost_price).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: p.current_stock > 50 ? 'var(--success)' : (p.current_stock > 0 ? 'var(--warning-text)' : 'var(--danger)')
                  }}>
                    {p.current_stock} {p.unit}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${p.active ? 'badge-success' : 'badge-neutral'}`}>
                      {p.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="text-right no-print">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(p)}>Edit</button>
                      <button
                        className={`btn btn-sm ${p.active ? 'btn-secondary' : 'btn-outline'}`}
                        onClick={() => handleToggle(p)}
                      >
                        {p.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes size={18} color="var(--primary)" />
                {editingProd ? 'Edit Product' : 'Add New Cake / Product'}
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
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Queen cake, Heart cake, Round cake"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Cakes, Pastries, Bread"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit of Measure</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Default Selling Price (KES) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price / Unit Cost (KES)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {!editingProd && (
                  <div className="form-group" style={{ backgroundColor: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px' }}>
                    <label className="form-label">Initial Opening Stock (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={formData.opening_stock}
                      onChange={(e) => setFormData({ ...formData, opening_stock: Number(e.target.value) })}
                    />
                  </div>
                )}

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
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
