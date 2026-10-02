import React, { useState } from 'react';
import { api } from '../api';
import { Lock, User, KeyRound, AlertCircle, Shield } from 'lucide-react';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const quickUsers = [
    { label: 'Admin (Full)', u: 'admin', p: 'admin123', role: 'ADMIN' },
    { label: 'Manager', u: 'manager', p: 'manager123', role: 'MANAGER' },
    { label: 'Sales Cashier', u: 'sales', p: 'sales123', role: 'SALES' },
    { label: 'Head Baker', u: 'production', p: 'production123', role: 'PRODUCTION' },
    { label: 'Store Keeper', u: 'inventory', p: 'inventory123', role: 'INVENTORY' }
  ];

  const handleQuickSelect = (u, p) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.login(username, password);
      localStorage.setItem('tb_token', res.token);
      localStorage.setItem('tb_user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Check username and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: 'var(--surface-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xl)',
        padding: '32px 28px',
        animation: 'slideUp 0.25s ease-out'
      }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            boxShadow: '0 6px 16px rgba(217, 119, 6, 0.35)',
            marginBottom: '12px'
          }}>
            🎂
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Terry Bakers
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Local Bakery Production & Management System
          </p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-text)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px', padding: '11px' }}
            disabled={loading}
          >
            <Lock size={16} />
            <span>{loading ? 'Authenticating...' : 'Sign In to System'}</span>
          </button>
        </form>

        {/* Quick Demo Sign In Roles */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
            Quick Offline Role Switcher
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
            {quickUsers.map(qu => (
              <button
                key={qu.u}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => handleQuickSelect(qu.u, qu.p)}
              >
                {qu.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
