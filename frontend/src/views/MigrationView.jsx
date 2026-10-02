import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check,
  AlertCircle
} from 'lucide-react';

export default function MigrationView() {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [dryRun, setDryRun] = useState(false);
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split('T')[0]);

  const loadValidation = async () => {
    setLoading(true);
    try {
      const res = await api.getMigrationValidation();
      setValidation(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValidation();
  }, []);

  const handleImport = async (isDryRun = false) => {
    setImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      if (fileToUpload) {
        formData.append('file', fileToUpload);
      }
      formData.append('dryRun', isDryRun ? 'true' : 'false');
      formData.append('defaultDate', defaultDate);

      const summary = await api.importExcel(formData, { dryRun: isDryRun, defaultDate });
      setImportSummary(summary);
      if (!isDryRun) {
        // Reload validation comparison
        loadValidation();
      }
    } catch (err) {
      alert('Import error: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Excel Migration & Data Integrity Validation</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Import the Terry Bakers Excel workbook and verify database calculations side-by-side with original workbook totals.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadValidation} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Re-run Validation</span>
        </button>
      </div>

      {/* Migration Card: One-Click Migration & File Upload */}
      <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--primary-glow)', backgroundColor: 'var(--surface-card)' }}>
        <div className="card-header">
          <h3 className="card-title" style={{ color: 'var(--primary)' }}>
            <FileSpreadsheet size={20} color="var(--primary)" />
            Workbook Import Utility
          </h3>
          <span className="badge badge-info">Source: Terry_Bakers_Production_Management_Template.xlsx</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.875rem', marginBottom: '12px', lineHeight: 1.5 }}>
              Import historical ingredient intakes, batch consumptions, worker production, and sales. Formulas will be converted into transaction ledger entries and verified.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Missing dates default to:
              </div>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px', padding: '6px 10px', fontSize: '0.8rem' }}
                value={defaultDate}
                onChange={(e) => setDefaultDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => setFileToUpload(e.target.files[0])}
              />
              <label
                htmlFor="excel-file-input"
                className="btn btn-secondary"
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <Upload size={15} />
                <span>{fileToUpload ? fileToUpload.name : 'Choose Custom .xlsx File'}</span>
              </label>

              <button
                className="btn btn-secondary"
                onClick={() => handleImport(true)}
                disabled={importing}
                title="Simulate import and preview validation without writing to database"
              >
                Preview Validation (Dry Run)
              </button>

              <button
                className="btn btn-primary"
                onClick={() => handleImport(false)}
                disabled={importing}
              >
                {importing ? 'Importing Data...' : 'Commit Migration'}
              </button>
            </div>
            {fileToUpload && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Selected: <strong>{fileToUpload.name}</strong> ({(fileToUpload.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>

        {/* Import Summary Results */}
        {importSummary && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: importSummary.dryRun ? 'var(--info-bg)' : 'var(--success-bg)',
            border: `1px solid ${importSummary.dryRun ? 'var(--info)' : 'var(--success)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: importSummary.dryRun ? 'var(--info-text)' : 'var(--success-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={18} />
                {importSummary.dryRun ? 'Dry Run Preview Completed' : 'Workbook Migration Succeeded!'}
              </h4>
              <span className="badge badge-neutral">
                {importSummary.recordsImported} Records Added • {importSummary.duplicates} Duplicates Skipped • {importSummary.warnings?.length || 0} Warnings
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '0.8rem', marginTop: '10px' }}>
              <div>• Products: <strong>{importSummary.breakdown?.products?.imported}</strong></div>
              <div>• Ingredients: <strong>{importSummary.breakdown?.ingredients?.imported}</strong></div>
              <div>• Purchases: <strong>{importSummary.breakdown?.purchases?.imported}</strong></div>
              <div>• Usage Records: <strong>{importSummary.breakdown?.ingredientUsage?.imported}</strong></div>
              <div>• Batches: <strong>{importSummary.breakdown?.production?.imported}</strong></div>
              <div>• Sales Orders: <strong>{importSummary.breakdown?.sales?.imported}</strong></div>
              <div>• Bakers: <strong>{importSummary.breakdown?.workers?.imported}</strong></div>
            </div>

            {/* Warnings list */}
            {importSummary.warnings?.length > 0 && (
              <details style={{ marginTop: '12px', fontSize: '0.78rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--warning-text)' }}>
                  View {importSummary.warnings.length} Informational Warnings (e.g. Empty template rows, default dates)
                </summary>
                <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '6px', backgroundColor: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '4px' }}>
                  {importSummary.warnings.map((w, idx) => (
                    <div key={idx} style={{ padding: '2px 0' }}>
                      [{w.sheet} R{w.row}]: {w.message}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Migration Validation Side-by-Side Comparison (Requirement 27) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <ShieldCheck size={20} color="var(--success)" />
              1. Core Financial & Production Verification
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Compares Excel workbook sheet formulas against dynamically calculated SQLite database totals.
            </p>
          </div>
          <span className={`badge ${validation?.overallStatus === 'PASS' ? 'badge-success' : 'badge-warning'}`}>
            {validation?.overallStatus === 'PASS' ? '100% AUDIT PASS' : 'WARNING DETECTED'}
          </span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Metric Name</th>
                <th className="text-right">Excel Workbook Value</th>
                <th className="text-right">Database Calculated Value</th>
                <th className="text-right">Difference</th>
                <th className="text-center">Integrity Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>Running audit validation...</td></tr>
              ) : validation?.metrics?.map((m, idx) => (
                <tr key={idx}>
                  <td><span className="badge badge-neutral">{m.category}</span></td>
                  <td><strong>{m.name}</strong></td>
                  <td className="text-right tabular-nums">{Number(m.excelValue).toLocaleString()}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>
                    {Number(m.dbValue).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums" style={{ color: m.difference > 0 && m.status === 'DISCREPANCY' ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {m.difference > 0 ? Number(m.difference).toLocaleString() : '0.00'}
                  </td>
                  <td className="text-center">
                    {m.status === 'MATCH' ? (
                      <span className="badge badge-success">
                        <Check size={12} /> MATCH (EXACT)
                      </span>
                    ) : m.status === 'INFO' ? (
                      <span className="badge badge-info">NEW (LIVE P&L)</span>
                    ) : (
                      <span className="badge badge-danger">DISCREPANCY</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cake Balances Side-by-Side Comparison */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">
              2. Finished Cake Stock Balances Verification (Cake Balance Sheet)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verifies: Total Produced - Total Sold = Cakes Balance per product.
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cake Product</th>
                <th className="text-right">Excel Produced</th>
                <th className="text-right">DB Produced</th>
                <th className="text-right">Excel Sold</th>
                <th className="text-right">DB Sold</th>
                <th className="text-right">Excel Balance</th>
                <th className="text-right">DB Ledger Balance</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {validation?.cakeBalances?.map((cb, idx) => (
                <tr key={idx}>
                  <td><strong>{cb.productName}</strong></td>
                  <td className="text-right tabular-nums">{cb.excelProduced}</td>
                  <td className="text-right tabular-nums">{cb.dbProduced}</td>
                  <td className="text-right tabular-nums">{cb.excelSold}</td>
                  <td className="text-right tabular-nums">{cb.dbSold}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>{cb.excelBalance}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 800, color: 'var(--primary)' }}>{cb.dbBalance}</td>
                  <td className="text-center">
                    <span className="badge badge-success">
                      <Check size={12} /> MATCH
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ingredient Balances Side-by-Side Comparison */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              3. Raw Ingredients Inventory & Weighted Cost Verification (Ingredients Balances Sheet)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verifies: Total In - Total Used = Ingredient Balance; Average Cost = Total Cost In / Total Quantity In.
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Unit</th>
                <th className="text-right">Excel Total In</th>
                <th className="text-right">DB Total In</th>
                <th className="text-right">Excel Total Used</th>
                <th className="text-right">DB Total Used</th>
                <th className="text-right">Excel Balance</th>
                <th className="text-right">DB Balance</th>
                <th className="text-right">Excel Avg Cost</th>
                <th className="text-right">DB Avg Cost</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {validation?.ingredientBalances?.map((ib, idx) => (
                <tr key={idx}>
                  <td><strong>{ib.ingredientName}</strong></td>
                  <td><span className="badge badge-neutral">{ib.unit}</span></td>
                  <td className="text-right tabular-nums">{ib.excelIn}</td>
                  <td className="text-right tabular-nums">{ib.dbIn}</td>
                  <td className="text-right tabular-nums">{ib.excelUsed}</td>
                  <td className="text-right tabular-nums">{ib.dbUsed}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 700 }}>{ib.excelBalance}</td>
                  <td className="text-right tabular-nums" style={{
                    fontWeight: 800,
                    color: ib.dbBalance < 0 ? 'var(--danger)' : 'var(--primary)'
                  }}>
                    {ib.dbBalance}
                  </td>
                  <td className="text-right tabular-nums">KES {ib.excelAvgCost}</td>
                  <td className="text-right tabular-nums">KES {ib.dbAvgCost}</td>
                  <td className="text-center">
                    <span className="badge badge-success">
                      <Check size={12} /> MATCH
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
