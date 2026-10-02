import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Settings,
  Users,
  Database,
  History,
  Download,
  RotateCcw,
  Plus,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function SettingsView({ currentUser }) {
  const [subTab, setSubTab] = useState('backups'); // 'backups', 'users', 'audit', 'system'
  const [backups, setBackups] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'SALES'
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupsRes, usersRes, logsRes, settingsRes] = await Promise.all([
        api.listBackups(),
        currentUser?.role === 'ADMIN' ? api.getUsers() : Promise.resolve([]),
        api.getAuditLogs({ limit: 100 }),
        api.getSettings()
      ]);
      setBackups(backupsRes || []);
      setUsers(usersRes || []);
      setAuditLogs(logsRes.logs || []);
      setSettings(settingsRes.settings || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  const handleCreateBackup = async () => {
    setBackupActionLoading(true);
    try {
      const info = await api.createBackup();
      alert(`Backup created successfully: ${info.fileName}`);
      loadData();
    } catch (err) {
      alert('Backup failed: ' + err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRestoreBackup = async (fileName) => {
    if (!window.confirm(`Are you SURE you want to restore database from "${fileName}"?\nA pre-restore safety copy will be saved automatically.`)) return;
    setBackupActionLoading(true);
    try {
      await api.restoreBackup(fileName);
      alert(`Database successfully restored from ${fileName}!`);
      window.location.reload();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateSettings(settings);
      alert('Settings saved successfully.');
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, userFormData);
      } else {
        await api.createUser(userFormData);
      }
      setShowUserModal(false);
      loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>System Settings, Backups & Administration</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Manage local SQLite database snapshots, role-based user permissions, business parameters and security audit logs.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn btn-sm ${subTab === 'backups' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('backups')}
        >
          <Database size={14} /> Local Backups & Restore ({backups.length})
        </button>

        {currentUser?.role === 'ADMIN' && (
          <button
            className={`btn btn-sm ${subTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('users')}
          >
            <Users size={14} /> Staff Accounts & Permissions ({users.length})
          </button>
        )}

        <button
          className={`btn btn-sm ${subTab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('system')}
        >
          <Settings size={14} /> Configuration Settings
        </button>

        <button
          className={`btn btn-sm ${subTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('audit')}
        >
          <History size={14} /> Audit Trail Log
        </button>
      </div>

      {/* SubTab 1: Backups (Requirement 23) */}
      {subTab === 'backups' && (
        <div>
          <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>SQLite Database Hot Backups</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Create instant point-in-time database backups locally. No cloud connectivity required.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCreateBackup}
              disabled={backupActionLoading}
            >
              <Database size={16} />
              <span>{backupActionLoading ? 'Creating Snapshot...' : 'Create New Backup Now'}</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Backup File Name</th>
                  <th>Created Date & Time</th>
                  <th>File Size</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No backups created yet. Click "Create New Backup Now" above.</td></tr>
                ) : (
                  backups.map(b => (
                    <tr key={b.fileName}>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>{b.fileName}</strong>
                      </td>
                      <td>{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="tabular-nums">{b.sizeFormatted}</td>
                      <td className="text-right">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <a
                            href={api.getBackupDownloadUrl(b.fileName)}
                            download={b.fileName}
                            className="btn btn-secondary btn-sm"
                            title="Download/Copy .db file"
                          >
                            <Download size={14} /> Download
                          </a>
                          {currentUser?.role === 'ADMIN' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRestoreBackup(b.fileName)}
                              disabled={backupActionLoading}
                              title="Restore Database to this snapshot"
                            >
                              <RotateCcw size={14} /> Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 2: Users & Roles (Requirement 21) */}
      {subTab === 'users' && (
        <div>
          <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Staff & Role-Based Permissions</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Roles: ADMIN (Full Access), MANAGER, SALES, PRODUCTION, INVENTORY.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingUser(null);
                setUserFormData({ username: '', password: '', full_name: '', role: 'SALES' });
                setShowUserModal(true);
              }}
            >
              <Plus size={16} /> Add New User
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Authorized Modules</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.full_name}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : (u.role === 'MANAGER' ? 'badge-warning' : 'badge-info')}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {u.permissions?.join(', ')}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${u.active ? 'badge-success' : 'badge-neutral'}`}>
                        {u.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingUser(u);
                          setUserFormData({
                            username: u.username,
                            password: '',
                            full_name: u.full_name,
                            role: u.role
                          });
                          setShowUserModal(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 3: System Settings (Requirement 7 & 18) */}
      {subTab === 'system' && (
        <div className="card" style={{ maxWidth: '650px' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>
            <Settings size={18} color="var(--primary)" />
            Application Configuration
          </h3>
          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">Bakery Business Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.company_name || ''}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Currency Symbol / Code</label>
              <input
                type="text"
                className="form-input"
                value={settings.currency_symbol || ''}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Allow Negative Inventory (Admin Override)</label>
              <select
                className="form-select"
                value={settings.allow_negative_inventory || 'true'}
                onChange={(e) => setSettings({ ...settings, allow_negative_inventory: e.target.value })}
              >
                <option value="true">YES - Allow negative stock (Warn baker/admin, matching spreadsheet template)</option>
                <option value="false">NO - Strict prevention (Block production if ingredient stock is insufficient)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Low Stock Alert Threshold</label>
              <input
                type="number"
                className="form-input"
                value={settings.low_stock_threshold || '10'}
                onChange={(e) => setSettings({ ...settings, low_stock_threshold: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingSettings} style={{ marginTop: '10px' }}>
              <Save size={16} />
              <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </form>
        </div>
      )}

      {/* SubTab 4: Audit Trail (Requirement 22) */}
      {subTab === 'audit' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Target Module</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.timestamp}</td>
                  <td><strong>{log.username}</strong></td>
                  <td>
                    <span className="badge badge-neutral">{log.action}</span>
                  </td>
                  <td>{log.table_name}</td>
                  <td style={{ fontSize: '0.82rem' }}>{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {editingUser ? `Edit Staff Account: ${editingUser.username}` : 'Add New Staff Account'}
              </h3>
              <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                {!editingUser && (
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={userFormData.username}
                      onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={userFormData.full_name}
                    onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{editingUser ? 'New Password (Leave blank to keep current)' : 'Password *'}</label>
                  <input
                    type="password"
                    className="form-input"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    required={!editingUser}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  >
                    <option value="ADMIN">ADMIN (Full Access)</option>
                    <option value="MANAGER">MANAGER (Operations & Reports)</option>
                    <option value="SALES">SALES (Counter POS & Customers)</option>
                    <option value="PRODUCTION">PRODUCTION (Bakers & Recipe Usage)</option>
                    <option value="INVENTORY">INVENTORY (Store Intake & Damages)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
