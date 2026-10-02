import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Search, Factory, Wheat, AlertCircle, CheckCircle2, Clock, UserCheck } from 'lucide-react';

export default function ProductionView() {
  const [batches, setBatches] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('batches'); // 'batches' or 'usage'
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New Production Batch Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [batchData, setBatchData] = useState({
    date: new Date().toISOString().split('T')[0],
    batch_number: '',
    worker_id: '',
    production_hours: 0,
    notes: '',
    override_negative_stock: false,
    products: [{ product_id: '', quantity_produced: 0 }],
    ingredients_used: [{ ingredient_id: '', quantity_used: 0 }]
  });

  const [usageData, setUsageData] = useState({
    date: new Date().toISOString().split('T')[0],
    product_id: '',
    ingredient_id: '',
    quantity_used: 0,
    no_of_cakes: 0,
    batch_reference: '',
    notes: '',
    override_negative_stock: false
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [recipePreview, setRecipePreview] = useState(null);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productDraft, setProductDraft] = useState({
    name: '',
    category: 'Cakes',
    unit: 'pcs',
    selling_price: 0,
    cost_price: 0,
    notes: ''
  });
  const [ingredientDraft, setIngredientDraft] = useState({
    name: '',
    unit: 'kg',
    min_stock_level: 10,
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesRes, usageRes, prodsRes, ingsRes, workersRes] = await Promise.all([
        api.getBatches({ search, startDate, endDate }),
        api.getIngredientUsage({ search, startDate, endDate }),
        api.getProducts({ activeOnly: true }),
        api.getIngredients({ activeOnly: true }),
        api.getWorkers()
      ]);
      setBatches(batchesRes.batches || []);
      setUsageRecords(usageRes.records || []);
      setProducts(prodsRes || []);
      setIngredients(ingsRes || []);
      setWorkers(workersRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, startDate, endDate]);

  useEffect(() => {
    const productId = batchData.products?.[0]?.product_id;
    const quantity = Number(batchData.products?.[0]?.quantity_produced || 0);
    if (!productId || !quantity) {
      setRecipePreview(null);
      return;
    }

    let isMounted = true;
    api.getRecipeByProduct(productId)
      .then(recipe => {
        if (!isMounted || !recipe) {
          setRecipePreview(null);
          return;
        }
        const multiplier = Number(recipe.yield_quantity || 1) > 0 ? quantity / Number(recipe.yield_quantity) : 0;
        const items = (recipe.items || []).map(item => {
          const base = Number(item.quantity_required || 0) * multiplier;
          const wastage = base * ((Number(item.wastage_percentage || 0)) / 100);
          return {
            ingredient_id: item.ingredient_id,
            ingredient_name: item.ingredient_name,
            unit: item.unit || item.ingredient_unit || 'kg',
            required_quantity: Number(base.toFixed(4)),
            wastage_quantity: Number(wastage.toFixed(4)),
            total_quantity: Number((base + wastage).toFixed(4))
          };
        });
        setRecipePreview({ recipe, items });
      })
      .catch(() => setRecipePreview(null));

    return () => { isMounted = false; };
  }, [batchData.products]);

  // Batch Form Helpers
  const addBatchProduct = () => {
    setBatchData({
      ...batchData,
      products: [...batchData.products, { product_id: '', quantity_produced: 0 }]
    });
  };

  const removeBatchProduct = (index) => {
    if (batchData.products.length <= 1) return;
    setBatchData({
      ...batchData,
      products: batchData.products.filter((_, i) => i !== index)
    });
  };

  const addBatchIngredient = () => {
    setBatchData({
      ...batchData,
      ingredients_used: [...batchData.ingredients_used, { ingredient_id: '', quantity_used: 0 }]
    });
  };

  const removeBatchIngredient = (index) => {
    if (batchData.ingredients_used.length <= 1) return;
    setBatchData({
      ...batchData,
      ingredients_used: batchData.ingredients_used.filter((_, i) => i !== index)
    });
  };

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

      const targetIndex = batchData.products.findIndex(item => !item.product_id || !item.quantity_produced);
      if (targetIndex >= 0) {
        const arr = [...batchData.products];
        arr[targetIndex].product_id = String(created.id);
        setBatchData({ ...batchData, products: arr });
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

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
      setShowIngredientModal(false);
      setIngredientDraft({ name: '', unit: 'kg', min_stock_level: 10, notes: '' });

      if (showBatchModal) {
        const arr = [...batchData.ingredients_used];
        const targetIndex = arr.findIndex(item => !item.ingredient_id || !item.quantity_used);
        if (targetIndex >= 0) {
          arr[targetIndex].ingredient_id = String(created.id);
          setBatchData({ ...batchData, ingredients_used: arr });
        }
      }

      if (showUsageModal) {
        setUsageData({ ...usageData, ingredient_id: String(created.id), unit: created.unit || ingredientDraft.unit });
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setWarningMsg('');

    const validProds = batchData.products.filter(p => p.product_id && Number(p.quantity_produced) > 0);
    if (validProds.length === 0) {
      setErrorMsg('Please specify at least one product produced with quantity > 0.');
      return;
    }

    setSubmitting(true);
    try {
      const firstProductId = validProds[0].product_id;
      const hasManualIngredients = batchData.ingredients_used.some(i => i.ingredient_id && Number(i.quantity_used) > 0);
      const recipeIngredients = recipePreview ? recipePreview.items.map(item => ({
        ingredient_id: item.ingredient_id,
        quantity_used: item.total_quantity,
        unit: item.unit,
        no_of_cakes: Number(validProds[0].quantity_produced || 0),
        notes: item.ingredient_name
      })) : [];

      const payload = {
        ...batchData,
        products: validProds,
        ingredients_used: hasManualIngredients ? batchData.ingredients_used.filter(i => i.ingredient_id && Number(i.quantity_used) > 0) : recipeIngredients,
        recipe_id: recipePreview ? recipePreview.recipe.id : null,
        product_id: firstProductId
      };

      const res = await api.createProduction(payload);

      if (res.warnings && res.warnings.length > 0) {
        alert('Batch created with warnings:\n' + res.warnings.join('\n'));
      }
      setShowBatchModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveUsage = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!usageData.ingredient_id || Number(usageData.quantity_used) <= 0) {
      setErrorMsg('Please select an ingredient and enter quantity used.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createIngredientUsage(usageData);
      if (res.warning) {
        alert('Recorded with warning: ' + res.warning);
      }
      setShowUsageModal(false);
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Production & Ingredient Consumption</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Record baking batches, consume recipe ingredients from inventory, and credit finished cakes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setUsageData({
                date: new Date().toISOString().split('T')[0],
                product_id: '',
                ingredient_id: '',
                quantity_used: 0,
                no_of_cakes: 0,
                batch_reference: '',
                notes: '',
                override_negative_stock: false
              });
              setErrorMsg('');
              setShowUsageModal(true);
            }}
          >
            <Wheat size={16} />
            <span>Record Ingredient Usage</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setBatchData({
                date: new Date().toISOString().split('T')[0],
                batch_number: '',
                worker_id: '',
                production_hours: 0,
                notes: '',
                override_negative_stock: false,
                products: [{ product_id: '', quantity_produced: 0 }],
                ingredients_used: [{ ingredient_id: '', quantity_used: 0 }]
              });
              setErrorMsg('');
              setShowBatchModal(true);
            }}
          >
            <Plus size={16} />
            <span>New Production Batch</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs: Batches vs Ingredients Used */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn btn-sm ${subTab === 'batches' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('batches')}
        >
          <Factory size={14} /> Production Batches ({batches.length})
        </button>
        <button
          className={`btn btn-sm ${subTab === 'usage' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('usage')}
        >
          <Wheat size={14} /> Ingredients Used Log ({usageRecords.length})
        </button>
      </div>

      {recipePreview && (
        <div className="card" style={{ marginBottom: '20px', padding: '16px 20px', background: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(15,118,110,0.04))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Active Recipe</div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{recipePreview.recipe.name} · v{recipePreview.recipe.version}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Yield</div>
              <div style={{ fontWeight: 700 }}>{recipePreview.recipe.yield_quantity} {recipePreview.recipe.yield_unit}</div>
            </div>
          </div>

          <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
            {recipePreview.items.map(item => (
              <div key={item.ingredient_id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1fr', gap: '10px', fontSize: '0.82rem', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                <strong>{item.ingredient_name}</strong>
                <span>{item.required_quantity} {item.unit}</span>
                <span>Waste: {item.wastage_quantity}</span>
                <span>Total: {item.total_quantity} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search batch reference, product or baker..."
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

      {/* Batches Table */}
      {subTab === 'batches' ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch #</th>
                <th>Cakes Produced</th>
                <th>Baker / Worker</th>
                <th className="text-right">Shift Hours</th>
                <th className="text-right">Ingredient Cost</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>Loading production batches...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No production batches found.</td></tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.date}</td>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{b.batch_number}</strong>
                    </td>
                    <td>
                      {b.products?.map(p => (
                        <div key={p.id} style={{ fontSize: '0.85rem' }}>
                          <strong>{p.quantity_produced}</strong> {p.product_unit || 'pcs'} of <strong>{p.product_name}</strong>
                        </div>
                      ))}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserCheck size={14} color="var(--primary)" />
                        <span>{b.worker_name || '—'}</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{b.production_hours ? `${b.production_hours} hrs` : '—'}</td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                      KES {Number(b.total_cost || 0).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Ingredients Used Log Table */
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch Ref</th>
                <th>Cake Type</th>
                <th>Ingredient</th>
                <th>Unit</th>
                <th className="text-right">Quantity Used</th>
                <th className="text-right">No. of Cakes</th>
                <th className="text-right">Total Cost</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Loading usage records...</td></tr>
              ) : usageRecords.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No ingredient usage records found.</td></tr>
              ) : (
                usageRecords.map(u => (
                  <tr key={u.id}>
                    <td>{u.date}</td>
                    <td><strong>{u.batch_reference || '—'}</strong></td>
                    <td>{u.product_name || '—'}</td>
                    <td><strong>{u.ingredient_name}</strong></td>
                    <td>{u.unit}</td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 800, color: 'var(--danger-text)' }}>
                      {u.quantity_used}
                    </td>
                    <td className="text-right tabular-nums">{u.no_of_cakes || '—'}</td>
                    <td className="text-right tabular-nums">KES {Number(u.total_cost || 0).toLocaleString()}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Production Batch Modal */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Factory size={20} color="var(--primary)" />
                Record Complete Production Batch
              </h3>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleSaveBatch}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Production Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={batchData.date}
                      onChange={(e) => setBatchData({ ...batchData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Batch Reference (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. B0001 (auto generated if empty)"
                      value={batchData.batch_number}
                      onChange={(e) => setBatchData({ ...batchData, batch_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Lead Baker / Worker</label>
                    <SearchableSelect
                      value={batchData.worker_id}
                      onChange={(value) => {
                        const worker = workers.find(item => String(item.id) === String(value));
                        setBatchData({ ...batchData, worker_id: value, worker_name: worker?.name });
                      }}
                      options={workers.map(worker => ({
                        id: worker.id,
                        label: worker.name,
                        meta: worker.role || 'Baker',
                        searchText: `${worker.name} ${worker.worker_code || ''}`
                      }))}
                      placeholder="Search baker..."
                      emptyMessage="No matching worker found."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Production Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input"
                      placeholder="e.g. 2.5"
                      value={batchData.production_hours}
                      onChange={(e) => setBatchData({ ...batchData, production_hours: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Section 1: Products Produced */}
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>1. Cakes Produced (Stock In)</h4>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addBatchProduct}>
                      <Plus size={13} /> Add Product
                    </button>
                  </div>

                  {batchData.products.map((p, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', marginBottom: '8px', backgroundColor: 'var(--surface-subtle)', padding: '8px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <SearchableSelect
                            value={p.product_id}
                            onChange={(value) => {
                              const arr = [...batchData.products];
                              arr[idx].product_id = value;
                              setBatchData({ ...batchData, products: arr });
                            }}
                            options={products.map(product => ({
                              id: product.id,
                              label: product.name,
                              meta: `${product.unit || 'pcs'} • Stock: ${product.current_stock ?? 0}`,
                              searchText: `${product.name} ${product.category || ''} ${product.code || ''}`
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

                      <input
                        type="number"
                        min="1"
                        placeholder="Quantity Produced"
                        className="form-input"
                        value={p.quantity_produced || ''}
                        onChange={(e) => {
                          const arr = [...batchData.products];
                          arr[idx].quantity_produced = Number(e.target.value);
                          setBatchData({ ...batchData, products: arr });
                        }}
                        required
                      />

                      <button
                        type="button"
                        onClick={() => removeBatchProduct(idx)}
                        disabled={batchData.products.length <= 1}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Section 2: Ingredients Consumed */}
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>2. Recipe Ingredients Consumed (Stock Out)</h4>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addBatchIngredient}>
                      <Plus size={13} /> Add Ingredient
                    </button>
                  </div>

                  {batchData.ingredients_used.map((i, idx) => {
                    const ingObj = ingredients.find(x => String(x.id) === String(i.ingredient_id));
                    const isShort = ingObj && i.quantity_used > ingObj.current_stock;
                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', marginBottom: '8px', backgroundColor: 'var(--surface-subtle)', padding: '8px', borderRadius: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <SearchableSelect
                                value={i.ingredient_id}
                                onChange={(value) => {
                                  const arr = [...batchData.ingredients_used];
                                  arr[idx].ingredient_id = value;
                                  setBatchData({ ...batchData, ingredients_used: arr });
                                }}
                                options={ingredients.map(ingredient => ({
                                  id: ingredient.id,
                                  label: ingredient.name,
                                  meta: `${ingredient.unit} • Available: ${ingredient.current_stock ?? 0}`,
                                  searchText: `${ingredient.name} ${ingredient.unit} ${ingredient.ingredient_code || ''}`
                                }))}
                                placeholder="Search ingredient..."
                                emptyMessage="No matching ingredient found."
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setShowIngredientModal(true);
                              }}
                              title="Add new ingredient"
                            >
                              + Add
                            </button>
                          </div>
                          {isShort && (
                            <div style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700 }}>
                              ⚠️ Will result in negative stock balance!
                            </div>
                          )}
                        </div>

                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Quantity Used"
                          className="form-input"
                          value={i.quantity_used || ''}
                          onChange={(e) => {
                            const arr = [...batchData.ingredients_used];
                            arr[idx].quantity_used = Number(e.target.value);
                            setBatchData({ ...batchData, ingredients_used: arr });
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => removeBatchIngredient(idx)}
                          disabled={batchData.ingredients_used.length <= 1}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Batch Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Baking conditions, yield comments, quality..."
                    value={batchData.notes}
                    onChange={(e) => setBatchData({ ...batchData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving Batch...' : 'Complete & Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

      {/* Standalone Ingredient Usage Modal (Matches 'Ingredients Used' sheet) */}
      {showUsageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wheat size={18} color="var(--primary)" />
                Record Ingredient Usage
              </h3>
              <button onClick={() => setShowUsageModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveUsage}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={usageData.date}
                      onChange={(e) => setUsageData({ ...usageData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cake / Product Type</label>
                    <SearchableSelect
                      value={usageData.product_id}
                      onChange={(value) => setUsageData({ ...usageData, product_id: value })}
                      options={[{ id: '', label: 'General / No Product', meta: 'No specific cake selected' }, ...products.map(product => ({
                        id: product.id,
                        label: product.name,
                        meta: `${product.unit || 'pcs'} • Stock: ${product.current_stock ?? 0}`,
                        searchText: `${product.name} ${product.category || ''}`
                      }))]}
                      placeholder="Search cake or leave general..."
                      emptyMessage="No matching cake found."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ingredient Consumed *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <SearchableSelect
                        value={usageData.ingredient_id}
                        onChange={(value) => setUsageData({ ...usageData, ingredient_id: value })}
                        options={ingredients.map(ingredient => ({
                          id: ingredient.id,
                          label: ingredient.name,
                          meta: `${ingredient.unit} • Current Stock: ${ingredient.current_stock ?? 0}`,
                          searchText: `${ingredient.name} ${ingredient.unit} ${ingredient.ingredient_code || ''}`
                        }))}
                        placeholder="Search ingredient..."
                        emptyMessage="No matching ingredient found."
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowIngredientModal(true)}
                      title="Add new ingredient"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity Used *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={usageData.quantity_used || ''}
                      onChange={(e) => setUsageData({ ...usageData, quantity_used: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. of Cakes Produced</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={usageData.no_of_cakes || ''}
                      onChange={(e) => setUsageData({ ...usageData, no_of_cakes: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch / Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. B0001"
                    value={usageData.batch_reference}
                    onChange={(e) => setUsageData({ ...usageData, batch_reference: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={usageData.notes}
                    onChange={(e) => setUsageData({ ...usageData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUsageModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Usage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
