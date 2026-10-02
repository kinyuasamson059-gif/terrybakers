import React, { useState } from 'react';
import { Bell, Plus, ShoppingCart, Factory, PackagePlus, AlertTriangle } from 'lucide-react';

export default function Topbar({ title, subtitle, onQuickAction, alerts, onAlertClick }) {
  const [showAlertMenu, setShowAlertMenu] = useState(false);
  const totalAlerts = alerts?.totalAlerts || 0;

  return (
    <header className="topbar no-print">
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        {/* Quick Action Buttons */}
        {onQuickAction && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onQuickAction('sales')}
              title="Record New Sale"
            >
              <ShoppingCart size={15} />
              <span>New Sale</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onQuickAction('production')}
              title="Record Production Batch"
            >
              <Factory size={15} />
              <span>New Batch</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onQuickAction('purchases')}
              title="Record Ingredient Purchase"
            >
              <PackagePlus size={15} />
              <span>Purchase In</span>
            </button>
          </div>
        )}

        {/* Stock Alerts Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAlertMenu(!showAlertMenu)}
            style={{
              background: totalAlerts > 0 ? 'var(--warning-bg)' : 'var(--surface-subtle)',
              border: `1px solid ${totalAlerts > 0 ? 'var(--warning)' : 'var(--border-color)'}`,
              color: totalAlerts > 0 ? 'var(--warning-text)' : 'var(--text-muted)',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
            title="Stock Warnings & Alerts"
          >
            <Bell size={18} />
            {totalAlerts > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#EF4444',
                color: '#fff',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '1px 5px',
                lineHeight: 1
              }}>
                {totalAlerts}
              </span>
            )}
          </button>

          {showAlertMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '44px',
              width: '320px',
              backgroundColor: 'var(--surface-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Stock Warnings</h4>
                <span className="badge badge-warning">{totalAlerts} alerts</span>
              </div>

              {totalAlerts === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  All finished products & ingredients are at healthy inventory levels!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {alerts?.negativeStockIngredients?.map(i => (
                    <div key={'neg-' + i.ingredientId} style={{
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger-text)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={14} color="#EF4444" />
                      <div>
                        <strong>{i.name}</strong> has negative stock (<strong>{i.balance} {i.unit}</strong>)!
                      </div>
                    </div>
                  ))}

                  {alerts?.lowStockIngredients?.map(i => (
                    <div key={'low-' + i.ingredientId} style={{
                      backgroundColor: 'var(--warning-bg)',
                      color: 'var(--warning-text)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={14} color="#F59E0B" />
                      <div>
                        <strong>{i.name}</strong> is low ({i.balance} {i.unit} remaining). Min: {i.minStockLevel}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setShowAlertMenu(false);
                    if (onAlertClick) onAlertClick();
                  }}
                >
                  View Full Stock Ledger
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
