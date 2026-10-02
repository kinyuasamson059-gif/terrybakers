// API Client for Terry Bakers Local Bakery System
const API_BASE = '/api';

function getAuthHeaders() {
    const token = localStorage.getItem('tb_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

async function request(url, options = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        // If unauthorized, clear stored session and trigger event
        localStorage.removeItem('tb_token');
        localStorage.removeItem('tb_user');
        window.dispatchEvent(new Event('auth_required'));
        throw new Error('Session expired or unauthorized. Please log in.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
}

export const api = {
    // Auth
    login: (username, password) => request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }),
    getProfile: () => request('/auth/me'),
    getUsers: () => request('/auth/users'),
    createUser: (data) => request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Dashboard
    getDashboard: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/dashboard?${q}`);
    },

    // Products
    getProducts: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/products?${q}`);
    },
    createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleProduct: (id) => request(`/products/${id}/toggle`, { method: 'PATCH' }),

    // Ingredients
    getIngredients: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/ingredients?${q}`);
    },
    createIngredient: (data) => request('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
    updateIngredient: (id, data) => request(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleIngredient: (id) => request(`/ingredients/${id}/toggle`, { method: 'PATCH' }),

    // Purchases
    getPurchases: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/purchases?${q}`);
    },
    createPurchase: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),

    // Production & Usage
    getBatches: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/production?${q}`);
    },
    createProduction: (data) => request('/production', { method: 'POST', body: JSON.stringify(data) }),
    getIngredientUsage: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/production/usage?${q}`);
    },
    createIngredientUsage: (data) => request('/production/usage', { method: 'POST', body: JSON.stringify(data) }),

    // Recipes
    getRecipes: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/recipes?${q}`);
    },
    getRecipeByProduct: (productId) => request(`/recipes/product/${productId}`),
    createRecipe: (data) => request('/recipes', { method: 'POST', body: JSON.stringify(data) }),

    // Sales
    getSales: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/sales?${q}`);
    },
    createSale: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),

    // Customers
    getCustomers: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/customers?${q}`);
    },
    getCustomerById: (id) => request(`/customers/${id}`),
    createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getCustomerStatement: (id, params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/customers/${id}/statement?${q}`);
    },

    // Payments
    getPayments: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/payments?${q}`);
    },
    createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),

    // Returns
    getReturns: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/returns?${q}`);
    },
    createReturn: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),

    // Damages
    getDamages: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/damages?${q}`);
    },
    createDamage: (data) => request('/damages', { method: 'POST', body: JSON.stringify(data) }),

    // Workers
    getWorkers: () => request('/workers'),
    createWorker: (data) => request('/workers', { method: 'POST', body: JSON.stringify(data) }),
    getWorkerPerformance: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/workers/performance?${q}`);
    },
    recordWorkerProduction: (data) => request('/workers/production', { method: 'POST', body: JSON.stringify(data) }),

    // Inventory
    getProductStock: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/inventory/products?${q}`);
    },
    getIngredientStock: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/inventory/ingredients?${q}`);
    },
    getStockAlerts: () => request('/inventory/alerts'),
    getInventoryLedger: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/inventory/ledger?${q}`);
    },

    // Profit
    getDailyProfit: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/profit/daily?${q}`);
    },

    // Expenses
    getExpenses: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/expenses?${q}`);
    },
    createExpense: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    getExpenseCategories: () => request('/expenses/categories'),

    // Reports
    getReport: (type, params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/reports/${type}?${q}`);
    },
    getReportExportUrl: (type, params = {}) => {
        const token = localStorage.getItem('tb_token');
        const q = new URLSearchParams({ ...params, token }).toString();
        return `${API_BASE}/reports/${type}/export?${q}`;
    },

    // Migration Validation
    getMigrationValidation: () => request('/validation/migration'),

    // Excel Import
    importExcel: async (formData, params = {}) => {
        const q = new URLSearchParams(params).toString();
        const token = localStorage.getItem('tb_token');
        const res = await fetch(`${API_BASE}/excel/import?${q}`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Import failed');
        return data;
    },
    getModuleExportUrl: (module) => {
        const token = localStorage.getItem('tb_token');
        return `${API_BASE}/excel/export/${module}?token=${token}`;
    },

    // Backup & Restore
    listBackups: () => request('/backup/list'),
    createBackup: () => request('/backup/create', { method: 'POST' }),
    restoreBackup: (fileName) => request('/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ fileName })
    }),
    getBackupDownloadUrl: (fileName) => {
        const token = localStorage.getItem('tb_token');
        return `${API_BASE}/backup/download/${fileName}?token=${token}`;
    },

    // Settings
    getSettings: () => request('/settings'),
    updateSettings: (settings) => request('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings })
    }),

    // Audit Logs
    getAuditLogs: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/audit/logs?${q}`);
    }
};
