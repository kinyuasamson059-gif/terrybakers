import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Search, ShoppingCart, AlertCircle, Printer, CheckCircle2 } from 'lucide-react';

export default function SalesView() {
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([
    { product_id: '', quantity: 1, selling_price: 0, subtotal: 0, stock: 0 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [invoiceToPrint, setInvoiceToPrint] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productDraft, setProductDraft] = useState({
    name: '',
    category: 'Cakes',
    unit: 'pcs',
    selling_price: 0,
    cost_price: 0,
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, prodsRes, custsRes] = await Promise.all([
        api.getSales({ search, startDate, endDate }),
        api.getProducts({ activeOnly: true }),
        api.getCustomers()
      ]);
      setSales(salesRes.sales || []);
      setTotal(salesRes.total || 0);
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

  const handleProductChange = (index, prodId) => {
    const prod = products.find(p => String(p.id) === String(prodId));
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product_id: prodId,
      selling_price: prod ? prod.selling_price : 0,
      stock: prod ? prod.current_stock : 0,
      subtotal: prod ? (newItems[index].quantity * prod.selling_price) : 0
    };
    setItems(newItems);
  };

  const handleQtyChange = (index, qty) => {
    const num = Number(qty) || 0;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      quantity: num,
      subtotal: num * newItems[index].selling_price
    };
    setItems(newItems);
  };

  const handlePriceChange = (index, price) => {
    const num = Number(price) || 0;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      selling_price: num,
      subtotal: newItems[index].quantity * num
    };
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { product_id: '', quantity: 1, selling_price: 0, subtotal: 0, stock: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);

  const handleQuickAddProduct = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!productDraft.name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    try {
      const created = await api.createProduct({
        ...productDraft,
        name: productDraft.name.trim(),
        opening_stock: 0,
        active: true
      });

      await loadData();
      setShowProductModal(false);
      setProductDraft({ name: '', category: 'Cakes', unit: 'pcs', selling_price: 0, cost_price: 0, notes: '' });

      const targetIndex = items.findIndex(item => !item.product_id || !item.quantity);
      if (targetIndex >= 0) {
        handleProductChange(targetIndex, String(created.id));
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    const validItems = items.filter(it => it.product_id && it.quantity > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please select at least one product with quantity > 0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date: saleDate,
        customer_id: selectedCustomer ? Number(selectedCustomer) : null,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        reference: reference.trim(),
        items: validItems
      };

      const result = await api.createSale(payload);
      setShowModal(false);
      loadData();

      // Show receipt for printing
      setInvoiceToPrint(result);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sales Orders & POS</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Manage invoices, walk-in counter sales, customer credit and product stock deductions.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setItems([{ product_id: '', quantity: 1, selling_price: 0, subtotal: 0, stock: 0 }]);
            setSelectedCustomer('');
            setReference('');
            setErrorMsg('');
            setShowModal(true);
          }}
        >
          <Plus size={16} />
          <span>New Sale Invoice</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search invoice number, customer or reference..."
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

      {/* Sales Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Items & Qty</th>
              <th>Payment Status</th>
              <th>Reference</th>
              <th className="text-right">Sales Amount</th>
              <th className="text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading sales transactions...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No sales records found.</td></tr>
            ) : (
              sales.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.date}</td>
                  <td>
                    <strong style={{ color: 'var(--primary)' }}>{s.invoice_number}</strong>
                  </td>
                  <td>{s.customer_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Walk-in</span>}</td>
                  <td>
                    {s.items?.map(it => (
                      <div key={it.id} style={{ fontSize: '0.8rem' }}>
                        {it.product_name} × <strong>{it.quantity}</strong> @ KES {it.selling_price}
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`badge ${s.payment_status === 'PAID' ? 'badge-success' : (s.payment_status === 'CREDIT' ? 'badge-warning' : 'badge-info')}`}>
                      {s.payment_status}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      {s.payment_method}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.reference || '—'}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    KES {Number(s.total_amount).toLocaleString()}
                  </td>
                  <td className="text-right no-print">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setInvoiceToPrint(s)}
                      title="Print Invoice Receipt"
                    >
                      <Printer size={14} />
                      <span>Print</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Sale Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={20} color="var(--primary)" />
                Record New Sale
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{
                    backgroundColor: 'var(--danger-bg)',
                    color: 'var(--danger-text)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sale Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Customer (Leave blank for Walk-in)</label>
                    <SearchableSelect
                      value={selectedCustomer}
                      onChange={setSelectedCustomer}
                      options={customers.map(customer => ({
                        id: customer.id,
                        label: customer.name,
                        meta: customer.phone ? `${customer.phone} • Outstanding: KES ${Number(customer.outstanding_balance || 0).toLocaleString()}` : `Outstanding: KES ${Number(customer.outstanding_balance || 0).toLocaleString()}`,
                        searchText: `${customer.name} ${customer.phone} ${customer.customer_code}`
                      }))}
                      placeholder="Search customer..."
                      emptyMessage="No matching customer found."
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Status</label>
                    <select
                      className="form-select"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                    >
                      <option value="PAID">PAID (Full payment now)</option>
                      <option value="CREDIT">CREDIT (Add to customer balance)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money (M-Pesa)</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Batch / Reference</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. B0001 or PO#123"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </div>

                {/* Products Line Items */}
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Items Ordered</h4>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                      <Plus size={14} /> Add Product
                    </button>
                  </div>

                  {items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                      gap: '10px',
                      alignItems: 'center',
                      marginBottom: '10px',
                      backgroundColor: 'var(--surface-subtle)',
                      padding: '10px',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <SearchableSelect
                              value={item.product_id}
                              onChange={(value) => handleProductChange(idx, value)}
                              options={products.map(product => ({
                                id: product.id,
                                label: product.name,
                                meta: `Stock: ${product.current_stock ?? 0} ${product.unit || 'pcs'}`,
                                searchText: `${product.name} ${product.code || ''} ${product.category || ''}`
                              }))}
                              placeholder="Search or select cake..."
                              emptyMessage="No matching cake found."
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowProductModal(true)}
                            title="Add new product"
                          >
                            + Add
                          </button>
                        </div>
                        {item.product_id && item.quantity > item.stock && (
                          <div style={{ fontSize: '0.72rem', color: '#EF4444', marginTop: '2px', fontWeight: 700 }}>
                            ⚠️ Warning: Available stock is {item.stock}!
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          placeholder="Price/Cake"
                          value={item.selling_price}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ textAlign: 'right', fontWeight: 700 }} className="tabular-nums">
                        KES {item.subtotal.toLocaleString()}
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          disabled={items.length <= 1}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Grand Total */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px 0',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: '12px'
                  }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>Total Sales Amount:</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">
                      KES {grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Completing Sale...' : 'Save & Print Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Add New Product</h3>
              <button onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleQuickAddProduct}>
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
                    value={productDraft.name}
                    onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })}
                    placeholder="e.g. Fruit Cake"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="form-input"
                    value={productDraft.category}
                    onChange={(e) => setProductDraft({ ...productDraft, category: e.target.value })}
                    placeholder="Cakes"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input
                      type="text"
                      className="form-input"
                      value={productDraft.unit}
                      onChange={(e) => setProductDraft({ ...productDraft, unit: e.target.value })}
                      placeholder="pcs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={productDraft.selling_price}
                      onChange={(e) => setProductDraft({ ...productDraft, selling_price: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={productDraft.cost_price}
                    onChange={(e) => setProductDraft({ ...productDraft, cost_price: Number(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={productDraft.notes}
                    onChange={(e) => setProductDraft({ ...productDraft, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt / Invoice Modal */}
      {invoiceToPrint && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '0' }}>
            <div style={{ padding: '24px' }} id="printable-receipt">
              <div style={{ textAlign: 'center', borderBottom: '2px dashed var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>TERRY BAKERS</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fresh Bakery & Confectionery</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Offline Local Management System</p>
                <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                  INVOICE: {invoiceToPrint.invoice_number}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Date: {invoiceToPrint.date}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', marginBottom: '14px' }}>
                <div><strong>Customer:</strong> {invoiceToPrint.customer_name || 'Walk-in'}</div>
                <div><strong>Payment:</strong> {invoiceToPrint.payment_status} ({invoiceToPrint.payment_method})</div>
                {invoiceToPrint.reference && <div><strong>Ref:</strong> {invoiceToPrint.reference}</div>}
              </div>

              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Item</th>
                    <th style={{ padding: '6px 0', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceToPrint.items?.map(it => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 0' }}>{it.product_name}</td>
                      <td style={{ padding: '6px 0', textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{it.selling_price}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>{it.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '10px', textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  TOTAL: KES {Number(invoiceToPrint.total_amount).toLocaleString()}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Thank you for your business! Baked fresh daily.
              </div>
            </div>

            <div className="modal-footer no-print">
              <button className="btn btn-secondary" onClick={() => setInvoiceToPrint(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
