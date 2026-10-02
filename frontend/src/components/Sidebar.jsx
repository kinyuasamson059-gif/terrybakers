import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Factory,
  PackagePlus,
  Boxes,
  Wheat,
  NotebookText,
  FolderTree,
  UserCheck,
  RotateCcw,
  AlertTriangle,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Settings,
  LogOut,
  Moon,
  Sun,
  Shield
} from 'lucide-react';

export default function Sidebar({ currentTab, setTab, user, onLogout, theme, toggleTheme, alertsCount = 0 }) {
  const permissions = user?.permissions || [];
  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard' },
    { id: 'sales', label: 'Sales / POS', icon: ShoppingCart, perm: 'sales' },
    { id: 'customers', label: 'Customers', icon: Users, perm: 'customers' },
    { id: 'production', label: 'Production', icon: Factory, perm: 'production' },
    { id: 'recipes', label: 'Recipes', icon: NotebookText, perm: 'recipes' },
    { id: 'purchases', label: 'Purchases (In)', icon: PackagePlus, perm: 'purchases' },
    { id: 'ingredients', label: 'Ingredients', icon: Wheat, perm: 'ingredients' },
    { id: 'products', label: 'Products', icon: Boxes, perm: 'products' },
    { id: 'inventory', label: 'Inventory Stock', icon: FolderTree, perm: 'inventory', badge: alertsCount > 0 ? alertsCount : null },
    { id: 'workers', label: 'Worker Performance', icon: UserCheck, perm: 'workers' },
    { id: 'returns', label: 'Sales Returns', icon: RotateCcw, perm: 'returns' },
    { id: 'damages', label: 'Damages / Spoilage', icon: AlertTriangle, perm: 'damages' },
    { id: 'expenses', label: 'Expenses', icon: Receipt, perm: 'expenses' },
    { id: 'profit', label: 'Daily Profit', icon: TrendingUp, perm: 'reports' },
    { id: 'reports', label: 'Business Reports', icon: FileSpreadsheet, perm: 'reports' },
    { id: 'migration', label: 'Excel & Migration', icon: CheckCircle2, perm: 'migration' },
    { id: 'settings', label: 'System & Backups', icon: Settings, perm: 'settings' }
  ];

  // Filter based on user permissions
  const visibleNavItems = navItems.filter(item => isAdmin || permissions.includes(item.perm));

  return (
    <aside className="app-sidebar no-print" style={{
      width: '260px',
      backgroundColor: 'var(--bg-sidebar)',
      color: 'var(--sidebar-text)',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      zIndex: 30,
      flexShrink: 0
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(217, 119, 6, 0.4)',
          fontSize: '20px'
        }}>
          🎂
        </div>
        <div>
          <h2 style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: 1.1
          }}>Terry Bakers</h2>
          <span style={{
            fontSize: '0.7rem',
            color: '#94A3B8',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}>PRODUCTION & MGMT</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}>
        {visibleNavItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94A3B8';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span style={{
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '999px',
                  lineHeight: 1
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer User Info & Controls */}
      <div style={{
        padding: '16px 14px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(0,0,0,0.15)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F8FAFC',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}>
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F8FAFC', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 800 }}>
                {user?.role}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={onLogout}
              title="Log Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.68rem',
          color: '#64748B'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }}></span>
          <span>Offline SQLite Mode Active</span>
        </div>
      </div>
    </aside>
  );
}
