import React, { useState, useEffect } from 'react';
import { api } from './api';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import LoginModal from './components/LoginModal';

import DashboardView from './views/DashboardView';
import SalesView from './views/SalesView';
import CustomersView from './views/CustomersView';
import ProductionView from './views/ProductionView';
import RecipesView from './views/RecipesView';
import PurchasesView from './views/PurchasesView';
import IngredientsView from './views/IngredientsView';
import ProductsView from './views/ProductsView';
import InventoryView from './views/InventoryView';
import WorkersView from './views/WorkersView';
import ReturnsView from './views/ReturnsView';
import DamagesView from './views/DamagesView';
import ExpensesView from './views/ExpensesView';
import DailyProfitView from './views/DailyProfitView';
import ReportsView from './views/ReportsView';
import MigrationView from './views/MigrationView';
import SettingsView from './views/SettingsView';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentTab, setTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [alerts, setAlerts] = useState({});

  // Initialize Auth
  useEffect(() => {
    const savedUser = localStorage.getItem('tb_user');
    const savedToken = localStorage.getItem('tb_token');
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        setUser(null);
      }
    }

    const handleAuthReq = () => {
      setUser(null);
    };
    window.addEventListener('auth_required', handleAuthReq);
    return () => window.removeEventListener('auth_required', handleAuthReq);
  }, []);

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load Inventory Alerts
  const loadAlerts = async () => {
    if (!user) return;
    try {
      const res = await api.getStockAlerts();
      setAlerts(res || {});
    } catch (e) {
      // Ignore background alert load errors
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [user, currentTab]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_user');
    setUser(null);
  };

  const handleQuickAction = (targetTab) => {
    setTab(targetTab);
  };

  // Get current view title & subtitle
  const getTabInfo = () => {
    switch (currentTab) {
      case 'dashboard': return { title: 'Executive Operations Dashboard', subtitle: 'Real-time production, sales, stock, and profit telemetry' };
      case 'sales': return { title: 'Sales Order & Counter POS', subtitle: 'Fast cake sales entry, invoices, and customer receipts' };
      case 'customers': return { title: 'Customer Accounts & Receivables', subtitle: 'Manage debtor ledgers, credit limits, and payments' };
      case 'production': return { title: 'Baking Production & Recipe Intake', subtitle: 'Batch execution, worker hours, and ingredient consumption' };
      case 'recipes': return { title: 'Recipe Management & BOM', subtitle: 'Versioned production recipes and ingredient requirements' };
      case 'purchases': return { title: 'Raw Material Purchases (In)', subtitle: 'Stock intake entry, supplier tracking, and average unit costs' };
      case 'ingredients': return { title: 'Raw Ingredients Inventory', subtitle: 'Ingredient stocks, minimum reorder levels, and valuation' };
      case 'products': return { title: 'Finished Products Catalog', subtitle: 'Cake items, selling prices, production unit costs, and inventory' };
      case 'inventory': return { title: 'Live Inventory Ledger', subtitle: 'Dual-ledger tracking for finished cakes and raw ingredients' };
      case 'workers': return { title: 'Baker Performance & Productivity', subtitle: 'Output tracking, shift speed (KG/Hr), and 8KG units' };
      case 'returns': return { title: 'Sales Returns & Customer Credits', subtitle: 'Invoice link, restock ledger, and return reason logging' };
      case 'damages': return { title: 'Product Spoilage & Damages', subtitle: 'Bakery wastage tracking and supervisory approval logs' };
      case 'expenses': return { title: 'Operating Expenses & Overheads', subtitle: 'Utilities, rent, fuel, transport, and maintenance tracking' };
      case 'profit': return { title: 'Daily Profit & Loss Analysis', subtitle: 'Live transactional P&L: Net Sales, COGS, Gross and Net Profit' };
      case 'reports': return { title: '14 Comprehensive Audit Reports', subtitle: 'Detailed reporting, printable views, and clean Excel export' };
      case 'migration': return { title: 'Excel Migration & Validation Engine', subtitle: 'Compare Excel workbook totals directly with SQLite database' };
      case 'settings': return { title: 'Local System Administration', subtitle: 'Database backups, role permissions, and audit logs' };
      default: return { title: 'Terry Bakers System', subtitle: 'Bakery Management' };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <div className="app-container">
      {/* If not logged in, render Login Modal */}
      {!user && (
        <LoginModal onLoginSuccess={(u) => { setUser(u); loadAlerts(); }} />
      )}

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        user={user}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        alertsCount={alerts.totalAlerts}
      />

      {/* Main Body */}
      <div className="main-content">
        <Topbar
          title={tabInfo.title}
          subtitle={tabInfo.subtitle}
          onQuickAction={handleQuickAction}
          alerts={alerts}
          onAlertClick={() => setTab('inventory')}
        />

        <main style={{ flex: 1, paddingBottom: '40px' }}>
          {currentTab === 'dashboard' && <DashboardView onNavigate={(t) => setTab(t)} />}
          {currentTab === 'sales' && <SalesView />}
          {currentTab === 'customers' && <CustomersView />}
          {currentTab === 'production' && <ProductionView />}
          {currentTab === 'recipes' && <RecipesView />}
          {currentTab === 'purchases' && <PurchasesView />}
          {currentTab === 'ingredients' && <IngredientsView />}
          {currentTab === 'products' && <ProductsView />}
          {currentTab === 'inventory' && <InventoryView />}
          {currentTab === 'workers' && <WorkersView />}
          {currentTab === 'returns' && <ReturnsView />}
          {currentTab === 'damages' && <DamagesView currentUser={user} />}
          {currentTab === 'expenses' && <ExpensesView />}
          {currentTab === 'profit' && <DailyProfitView />}
          {currentTab === 'reports' && <ReportsView />}
          {currentTab === 'migration' && <MigrationView />}
          {currentTab === 'settings' && <SettingsView currentUser={user} />}
        </main>
      </div>
    </div>
  );
}
