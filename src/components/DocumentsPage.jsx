/**
 * DocumentsPage.jsx - Document Generation UI
 * Updated for Stateless PDF Generation (No Google Drive dependency)
 * * Changes from previous version:
 * - Calls 'generateDocument' instead of 'generateCertificationDocs'
 * - Fetches templates from Firestore instead of hardcoded array
 * - Shows URL expiration status
 * - Better error handling and loading states
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients } from '../services/patientService';
import { formatDate } from '../services/certificationCalculations';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  where 
} from 'firebase/firestore';

// ============ Document Generation Page ============
const DocumentsPage = () => {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.organizationId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);

  // View state
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' | 'history'
  const [patientFilter, setPatientFilter] = useState('');

  // ============ Data Loading ============
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load patients
      const patientsData = await getPatients(orgId, { status: 'active' });
      setPatients(patientsData);

      // Load templates from Firestore
      const templatesRef = collection(db, 'organizations', orgId, 'documentTemplates');
      const templatesSnapshot = await getDocs(templatesRef);
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTemplates(templatesData);

      // Load recent documents
      const docsRef = collection(db, 'organizations', orgId, 'generatedDocuments');
      const docsQuery = query(docsRef, orderBy('generatedAt', 'desc'), limit(20));
      const docsSnapshot = await getDocs(docsQuery);
      const docs = docsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        generatedAt: doc.data().generatedAt?.toDate(),
        urlExpiresAt: doc.data().urlExpiresAt?.toDate()
      }));
      setRecentDocs(docs);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============ Computed Values ============
  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  
  const getRequiredDocs = () => {
    if (!selectedPatient?.compliance?.cti) return [];
    return selectedPatient.compliance.cti.requiredDocuments || [];
  };

  const getApplicableTemplates = () => {
    if (!selectedPatient) return templates;
    const period = selectedPatient.compliance?.cti?.periodShortName || '';
    return templates.filter(t => {
      if (!t.applicablePeriods || t.applicablePeriods.length === 0) return true;
      return t.applicablePeriods.some(p => period.includes(p) || p.includes(period));
    });
  };

  const isUrlExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date();
  };

  // ============ Document Generation ============
  const handleGenerateSingle = async (templateId) => {
    if (!selectedPatient) {
      setGenerationStatus({
        type: 'error',
        message: 'Please select a patient first.'
      });
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setGenerating(true);
    setGenerationStatus({
      type: 'info',
      message: `Generating ${template.name}...`
    });

    try {
      // Call NEW stateless function
      const generateDocFn = httpsCallable(functions, 'generateDocument');
      const result = await generateDocFn({
        patientId: selectedPatient.id,
        documentType: templateId,
        customData: {}
      });

      if (result.data.success) {
        setGenerationStatus({
          type: 'success',
          message: `${template.name} generated successfully!`,
          downloadUrl: result.data.downloadUrl,
          fileName: result.data.fileName,
          expiresAt: result.data.expiresAt
        });
        
        // Reload recent documents
        await loadData();
      }
    } catch (err) {
      console.error('Document generation error:', err);
      setGenerationStatus({
        type: 'error',
        message: `Failed to generate ${template.name}: ${err.message}`
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!selectedPatient) {
      setGenerationStatus({
        type: 'error',
        message: 'Please select a patient first.'
      });
      return;
    }

    const requiredDocs = getRequiredDocs();
    if (requiredDocs.length === 0) {
      setGenerationStatus({
        type: 'error',
        message: 'No required documents found for this patient\'s current period.'
      });
      return;
    }

    setGenerating(true);
    setGenerationStatus({
      type: 'info',
      message: `Generating ${requiredDocs.length} documents...`
    });

    const results = [];
    const generateDocFn = httpsCallable(functions, 'generateDocument');

    for (const docType of requiredDocs) {
      try {
        const result = await generateDocFn({
          patientId: selectedPatient.id,
          documentType: docType,
          customData: {}
        });
        results.push({
          docType,
          success: true,
          data: result.data
        });
      } catch (err) {
        console.error(`Error generating ${docType}:`, err);
        results.push({
          docType,
          success: false,
          error: err.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    setGenerationStatus({
      type: successCount === requiredDocs.length ? 'success' : 'warning',
      message: `Generated ${successCount} of ${requiredDocs.length} documents`,
      results
    });

    await loadData();
    setGenerating(false);
  };

  // ============ Render Helpers ============
  const renderPatientSummary = () => {
    if (!selectedPatient) return null;
    
    const cti = selectedPatient.compliance?.cti || {};
    const requiredDocs = getRequiredDocs();

    return (
      <div className="patient-summary-card">
        <div className="patient-header">
          <h4>{selectedPatient.name}</h4>
          <span className={`status-badge ${cti.status?.toLowerCase()}`}>
            {cti.status || 'Unknown'}
          </span>
        </div>
        
        <div className="patient-details">
          <div className="detail-row">
            <span className="label">MRN:</span>
            <span className="value">{selectedPatient.mrNumber || 'N/A'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Current Period:</span>
            <span className="value">{cti.periodShortName || 'N/A'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Days Until Cert:</span>
            <span className={`value ${cti.daysUntilCertEnd <= 5 ? 'urgent' : ''}`}>
              {cti.daysUntilCertEnd ?? 'N/A'}
            </span>
          </div>
          {cti.requiresF2F && (
            <div className="detail-row f2f-alert">
              <span className="label">⚠️ F2F Required:</span>
              <span className="value">{selectedPatient.f2fCompleted ? 'Completed' : 'Pending'}</span>
            </div>
          )}
        </div>

        {requiredDocs.length > 0 && (
          <div className="required-docs">
            <h5>Required Documents ({requiredDocs.length}):</h5>
            <ul>
              {requiredDocs.map(doc => (
                <li key={doc}>{doc.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderGenerationStatus = () => {
    if (!generationStatus) return null;

    const iconMap = {
      info: '⏳',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    return (
      <div className={`status-banner ${generationStatus.type}`}>
        <span className="status-icon">{iconMap[generationStatus.type]}</span>
        <div className="status-content">
          <p className="status-message">{generationStatus.message}</p>
          
          {generationStatus.downloadUrl && (
            <div className="status-actions">
              <a 
                href={generationStatus.downloadUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-sm btn-primary"
              >
                📥 Download PDF
              </a>
              {generationStatus.expiresAt && (
                <span className="expires-note">
                  Link expires: {new Date(generationStatus.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {generationStatus.results && (
            <div className="results-list">
              {generationStatus.results.map((r, idx) => (
                <div key={idx} className={`result-item ${r.success ? 'success' : 'error'}`}>
                  {r.success ? '✓' : '✗'} {r.docType.replace(/_/g, ' ')}
                  {r.success && r.data?.downloadUrl && (
                    <a href={r.data.downloadUrl} target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  )}
                  {!r.success && <span className="error-msg">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button 
          className="status-close"
          onClick={() => setGenerationStatus(null)}
        >
          ×
        </button>
      </div>
    );
  };

  // ============ Main Render ============
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <button onClick={loadData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="documents-page">
      {/* Page Header */}
      <div className="page-header">
        <h2>📄 Document Generation</h2>
        <p className="subtitle">Generate certification documents using stateless PDF generation</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          ⚡ Generate
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          🕐 History ({recentDocs.length})
        </button>
      </div>

      {/* Generation Status Banner */}
      {renderGenerationStatus()}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="generate-section">
          {/* Patient Selection */}
          <div className="card">
            <div className="card-header">
              <h3>1. Select Patient</h3>
            </div>
            <div className="card-body">
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setGenerationStatus(null);
                }}
                className="patient-select"
                disabled={generating}
              >
                <option value="">Choose a patient...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} • {p.mrNumber || 'No MRN'} • {p.compliance?.cti?.periodShortName || 'N/A'}
                  </option>
                ))}
              </select>

              {renderPatientSummary()}
            </div>
          </div>

          {/* Quick Generate */}
          {selectedPatient && (
            <div className="card">
              <div className="card-header">
                <h3>2. Quick Generate</h3>
                <button 
                  className="btn btn-primary"
                  onClick={handleGenerateAll}
                  disabled={generating || getRequiredDocs().length === 0}
                >
                  {generating ? '⏳ Generating...' : `📄 Generate All (${getRequiredDocs().length})`}
                </button>
              </div>
              <div className="card-body">
                <p className="help-text">
                  Click "Generate All" to create all required documents for {selectedPatient.name}'s 
                  current certification period, or select individual templates below.
                </p>
              </div>
            </div>
          )}

          {/* Template Library */}
          <div className="card">
            <div className="card-header">
              <h3>📚 Document Templates</h3>
              <span className="badge">{templates.length} available</span>
            </div>
            <div className="card-body">
              {templates.length === 0 ? (
                <div className="empty-state">
                  <p>No templates configured.</p>
                  <small>Run <code>node scripts/initDocumentTemplates.js</code> to set up templates.</small>
                </div>
              ) : (
                <div className="templates-grid">
                  {templates.map(template => {
                    const isApplicable = !selectedPatient || getApplicableTemplates().some(t => t.id === template.id);
                    return (
                      <div 
                        key={template.id} 
                        className={`template-card ${!isApplicable ? 'not-applicable' : ''}`}
                      >
                        <div className="template-icon">
                          {template.documentType?.includes('F2F') ? '🤝' : '📋'}
                        </div>
                        <div className="template-info">
                          <h4>{template.name}</h4>
                          <p>{template.description}</p>
                          <div className="template-periods">
                            {template.applicablePeriods?.map(period => (
                              <span key={period} className="period-tag">{period}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleGenerateSingle(template.id)}
                          disabled={!selectedPatient || generating}
                        >
                          Generate
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="history-section">
          <div className="card">
            <div className="card-header">
              <h3>Recent Documents</h3>
              <input
                type="text"
                placeholder="Filter by patient name..."
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="card-body">
              {recentDocs.length === 0 ? (
                <div className="empty-state">
                  <p>No documents generated yet.</p>
                  <small>Generated documents will appear here.</small>
                </div>
              ) : (
                <div className="docs-table-wrapper">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Patient</th>
                        <th>Generated</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentDocs
                        .filter(doc => 
                          !patientFilter || 
                          doc.patientName?.toLowerCase().includes(patientFilter.toLowerCase())
                        )
                        .map(doc => {
                          const expired = isUrlExpired(doc.urlExpiresAt);
                          return (
                            <tr key={doc.id}>
                              <td>
                                <div className="doc-name">
                                  <span className="doc-icon">📄</span>
                                  {doc.templateName || doc.documentType}
                                </div>
                              </td>
                              <td>{doc.patientName}</td>
                              <td>
                                <span className="date">
                                  {doc.generatedAt?.toLocaleDateString()}
                                </span>
                                <span className="time">
                                  {doc.generatedAt?.toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </td>
                              <td>
                                <span className={`url-status ${expired ? 'expired' : 'active'}`}>
                                  {expired ? '⚠️ Expired' : '✓ Active'}
                                </span>
                              </td>
                              <td>
                                {!expired ? (
                                  <a 
                                    href={doc.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline"
                                  >
                                    📥 Download
                                  </a>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => {
                                      setSelectedPatientId(doc.patientId);
                                      setActiveTab('generate');
                                      setGenerationStatus({
                                        type: 'info',
                                        message: `Regenerate ${doc.templateName || doc.documentType} for ${doc.patientName}`
                                      });
                                    }}
                                  >
                                    🔄 Regenerate
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .documents-page {
          padding: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 1.5rem;
        }

        .page-header h2 {
          margin: 0 0 0.25rem 0;
          font-size: 1.5rem;
          color: var(--color-gray-800);
        }

        .subtitle {
          margin: 0;
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
        }

        /* Tabs */
        .tab-nav {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        .tab-btn {
          padding: 0.5rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
          border-radius: var(--radius-md);
          transition: all var(--transition-normal);
        }

        .tab-btn:hover {
          background: var(--color-gray-100);
        }

        .tab-btn.active {
          background: var(--color-primary);
          color: white;
        }

        /* Cards */
        .card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          margin-bottom: 1rem;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--color-gray-50);
        }

        .card-header h3 {
          margin: 0;
          font-size: var(--font-size-base);
          color: var(--color-gray-800);
        }

        .card-body {
          padding: 1.25rem;
        }

        .badge {
          font-size: var(--font-size-xs);
          padding: 0.25rem 0.5rem;
          background: var(--color-gray-200);
          border-radius: var(--radius-sm);
          color: var(--color-gray-600);
        }

        /* Patient Select */
        .patient-select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          margin-bottom: 1rem;
        }

        .patient-select:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        /* Patient Summary */
        .patient-summary-card {
          background: var(--color-primary-50); /* #f0f9ff is close to primary-50 */
          border: 1px solid var(--color-primary-light); /* #bae6fd is close to primary-light */
          border-radius: var(--radius-lg);
          padding: 1rem;
        }

        .patient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .patient-header h4 {
          margin: 0;
          color: #0369a1; /* Keep original unless there's a primary-darker variant in map? Guide says primary-dark is 1e40af. This is slightly different, leaving as is for exact safety or switching to var(--color-primary-dark) if desired. I will keep exact non-mapped values. */
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-weight: 500;
        }

        .status-badge.compliant { background: var(--color-success-light); color: var(--color-success-dark); }
        .status-badge.due { background: var(--color-warning-light); color: var(--color-warning-dark); }
        .status-badge.overdue { background: var(--color-error-light); color: var(--color-error-dark); }

        .patient-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .detail-row {
          display: flex;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
        }

        .detail-row .label {
          color: var(--color-gray-500);
        }

        .detail-row .value {
          color: var(--color-gray-800);
          font-weight: 500;
        }

        .detail-row .value.urgent {
          color: #dc2626; /* Not in migration guide */
        }

        .f2f-alert {
          grid-column: span 2;
          background: var(--color-warning-light);
          padding: 0.5rem;
          border-radius: var(--radius-sm);
        }

        .required-docs h5 {
          margin: 0 0 0.5rem 0;
          font-size: 0.8125rem;
          color: var(--color-gray-600);
        }

        .required-docs ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.8125rem;
          color: var(--color-gray-800);
        }

        .required-docs li {
          margin-bottom: 0.25rem;
        }

        /* Status Banner */
        .status-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: var(--radius-lg);
          margin-bottom: 1rem;
        }

        .status-banner.info { background: var(--color-primary-50); border: 1px solid var(--color-primary-light); }
        .status-banner.success { background: var(--color-success-light); border: 1px solid #bbf7d0; } /* border not in map */
        .status-banner.warning { background: #fffbeb; border: 1px solid #fde68a; }
        .status-banner.error { background: var(--color-error-light); border: 1px solid #fecaca; }

        .status-icon {
          font-size: var(--font-size-xl);
        }

        .status-content {
          flex: 1;
        }

        .status-message {
          margin: 0 0 0.5rem 0;
          font-weight: 500;
        }

        .status-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .expires-note {
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .status-close {
          background: none;
          border: none;
          font-size: var(--font-size-xl);
          cursor: pointer;
          color: var(--color-gray-400);
          padding: 0;
          line-height: 1;
        }

        .results-list {
          margin-top: 0.75rem;
          font-size: var(--font-size-sm);
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
        }

        .result-item.success { color: var(--color-success-dark); }
        .result-item.error { color: var(--color-error-dark); }

        .result-item a {
          margin-left: auto;
          color: var(--color-primary);
          font-size: var(--font-size-xs);
        }

        .error-msg {
          margin-left: auto;
          font-size: var(--font-size-xs);
          color: #dc2626;
        }

        /* Templates Grid */
        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .template-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          transition: all var(--transition-normal);
        }

        .template-card:hover {
          border-color: var(--color-primary);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
        }

        .template-card.not-applicable {
          opacity: 0.5;
        }

        .template-icon {
          font-size: 1.5rem;
        }

        .template-info {
          flex: 1;
        }

        .template-info h4 {
          margin: 0 0 0.25rem 0;
          font-size: var(--font-size-sm);
          color: var(--color-gray-800);
        }

        .template-info p {
          margin: 0 0 0.5rem 0;
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .template-periods {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .period-tag {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: var(--color-gray-100);
          border-radius: 3px;
          color: var(--color-gray-600);
        }

        /* History Table */
        .filter-input {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          width: 200px;
        }

        .docs-table-wrapper {
          overflow-x: auto;
        }

        .docs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .docs-table th {
          text-align: left;
          padding: 0.75rem;
          background: var(--color-gray-50);
          border-bottom: 1px solid var(--border-color);
          font-weight: 500;
          color: var(--color-gray-500);
        }

        .docs-table td {
          padding: 0.75rem;
          border-bottom: 1px solid var(--border-color);
        }

        .doc-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .doc-icon {
          font-size: var(--font-size-base);
        }

        .docs-table .date {
          display: block;
          color: var(--color-gray-800);
        }

        .docs-table .time {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .url-status {
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
        }

        .url-status.active {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }

        .url-status.expired {
          background: var(--color-warning-light);
          color: var(--color-warning-dark);
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-normal);
          text-decoration: none;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--color-primary);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .btn-outline {
          background: white;
          border: 1px solid var(--color-gray-300);
          color: var(--color-gray-700);
        }

        .btn-outline:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
        }

        /* Help text */
        .help-text {
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
          margin: 0;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--color-gray-500);
        }

        .empty-state small {
          display: block;
          margin-top: 0.5rem;
        }

        .empty-state code {
          background: var(--color-gray-100);
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-size: var(--font-size-xs);
        }

        /* Loading */
        .page-loading, .page-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          color: var(--color-gray-500);
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .documents-page {
            padding: 1rem;
          }

          .patient-details {
            grid-template-columns: 1fr;
          }

          .templates-grid {
            grid-template-columns: 1fr;
          }

          .card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .filter-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentsPage;