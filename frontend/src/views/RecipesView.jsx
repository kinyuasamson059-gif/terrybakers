import React, { useEffect, useState } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Search, Trash2, Save, NotebookText } from 'lucide-react';

export default function RecipesView() {
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    name: '',
    yield_quantity: 100,
    yield_unit: 'pcs',
    active: true,
    notes: '',
    items: [{ ingredient_id: '', quantity_required: 0, unit: 'kg', wastage_percentage: 0, notes: '' }]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [recipeRes, prodRes, ingRes] = await Promise.all([
        api.getRecipes({ search }),
        api.getProducts({ activeOnly: true }),
        api.getIngredients({ activeOnly: true })
      ]);
      setRecipes(recipeRes || []);
      setProducts(prodRes || []);
      setIngredients(ingRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const updateItem = (index, key, value) => {
    const next = [...form.items];
    next[index] = { ...next[index], [key]: value };
    setForm({ ...form, items: next });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { ingredient_id: '', quantity_required: 0, unit: 'kg', wastage_percentage: 0, notes: '' }]
    });
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      product_id: Number(form.product_id),
      yield_quantity: Number(form.yield_quantity),
      items: form.items.filter(item => item.ingredient_id && Number(item.quantity_required) > 0)
    };

    if (!payload.product_id || !payload.name || !payload.items.length) {
      alert('Please select a product, add a recipe name, and include ingredients.');
      return;
    }

    try {
      await api.createRecipe(payload);
      setForm({
        product_id: '',
        name: '',
        yield_quantity: 100,
        yield_unit: 'pcs',
        active: true,
        notes: '',
        items: [{ ingredient_id: '', quantity_required: 0, unit: 'kg', wastage_percentage: 0, notes: '' }]
      });
      loadData();
    } catch (err) {
      alert(err.message || 'Could not save recipe');
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Recipe Management</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Versioned BOMs and ingredient requirements for production batches.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <NotebookText size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Saved Recipes</h3>
          </div>

          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search recipes or products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div className="table-container" style={{ maxHeight: '470px', overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Recipe</th>
                  <th>Yield</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '22px' }}>Loading recipes...</td></tr>
                ) : recipes.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '22px', color: 'var(--text-muted)' }}>No recipes found.</td></tr>
                ) : (
                  recipes.map(recipe => (
                    <tr key={recipe.id}>
                      <td><strong>{recipe.product_name}</strong></td>
                      <td>{recipe.name}<div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>v{recipe.version}</div></td>
                      <td>{recipe.yield_quantity} {recipe.yield_unit}</td>
                      <td><span className={`badge ${recipe.active ? 'badge-success' : 'badge-secondary'}`}>{recipe.active ? 'ACTIVE' : 'HISTORICAL'}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Plus size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Create Recipe</h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label className="field-label">Product</label>
                <SearchableSelect
                  value={form.product_id}
                  onChange={(value) => setForm({ ...form, product_id: value })}
                  options={products.map(product => ({
                    id: product.id,
                    label: product.name,
                    meta: product.category ? `${product.category} • ${product.unit}` : product.unit,
                    searchText: `${product.name} ${product.category} ${product.unit}`
                  }))}
                  placeholder="Search or select cake..."
                  emptyMessage="No matching cake found."
                />
              </div>

              <div>
                <label className="field-label">Recipe Name</label>
                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard Queen Cake" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">Yield Quantity</label>
                  <input className="form-input" type="number" min="1" value={form.yield_quantity} onChange={(e) => setForm({ ...form, yield_quantity: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Yield Unit</label>
                  <input className="form-input" value={form.yield_unit} onChange={(e) => setForm({ ...form, yield_unit: e.target.value })} placeholder="pcs" />
                </div>
              </div>

              <div>
                <label className="field-label">Notes</label>
                <textarea className="form-input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional recipe notes" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="field-label" style={{ margin: 0 }}>Ingredients</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>Add Ingredient</button>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  {form.items.map((item, index) => (
                    <div key={index} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', background: 'var(--surface-subtle)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: '8px' }}>
                        <SearchableSelect
                          value={item.ingredient_id}
                          onChange={(value) => updateItem(index, 'ingredient_id', value)}
                          options={ingredients.map(ingredient => ({
                            id: ingredient.id,
                            label: ingredient.name,
                            meta: `${ingredient.unit} • Stock: ${ingredient.current_stock ?? 0}`,
                            searchText: `${ingredient.name} ${ingredient.unit}`
                          }))}
                          placeholder="Search or select ingredient..."
                          emptyMessage="No matching ingredient found."
                        />
                        <input className="form-input" type="number" min="0" step="0.01" value={item.quantity_required} onChange={(e) => updateItem(index, 'quantity_required', e.target.value)} placeholder="Qty" />
                        <input className="form-input" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} placeholder="Unit" />
                        <input className="form-input" type="number" min="0" max="100" step="0.1" value={item.wastage_percentage} onChange={(e) => updateItem(index, 'wastage_percentage', e.target.value)} placeholder="Wastage %" />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <input className="form-input" value={item.notes} onChange={(e) => updateItem(index, 'notes', e.target.value)} placeholder="Ingredient notes" style={{ flex: 1 }} />
                        {form.items.length > 1 && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(index)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={15} /> Save Recipe
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
