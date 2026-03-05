/**
 * DocumentsPage.jsx - Assessment-Based Document Generation
 *
 * Flow: Patient → Assessment → Smart Doc Selection → Generate
 * Uses Google Docs API for document generation.
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
import {
  FileText,
  Zap,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
  ClipboardList,
  Handshake,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Activity,
} from 'lucide-react';

// ── Document type definitions ──────────────────────────────────────
const DOCUMENT_TYPES = [
  { key: '60DAY', label: '60-Day Certification', description: 'Standard recertification (Period 3+)', icon: 'cert' },
  { key: '90DAY_INITIAL', label: '90-Day Initial Certification', description: 'First benefit period', icon: 'cert' },
  { key: '90DAY_SECOND', label: '90-Day Second Certification', description: 'Second benefit period', icon: 'cert' },
  { key: 'ATTEND_CERT', label: 'Attending Certification', description: 'Attending physician certification', icon: 'cert' },
  { key: 'PROGRESS_NOTE', label: 'Progress Note', description: 'Clinical progress documentation', icon: 'note' },
  { key: 'F2F_ENCOUNTER', label: 'Face-to-Face Encounter', description: 'F2F encounter documentation', icon: 'f2f' },
  { key: 'HOME_VISIT_ASSESSMENT', label: 'Home Visit Assessment', description: 'Home visit clinical assessment', icon: 'visit' },
];

// Smart selection: map visit types to recommended document types
const VISIT_TYPE_DOC_MAP = {
  'Routine': ['PROGRESS_NOTE'],
  'Recertification': ['60DAY', 'ATTEND_CERT', 'PROGRESS_NOTE'],
  'Initial Assessment': ['90DAY_INITIAL', 'ATTEND_CERT', 'PROGRESS_NOTE', 'HOME_VISIT_ASSESSMENT'],
  'F2F Visit': ['F2F_ENCOUNTER', 'PROGRESS_NOTE'],
  'Discharge': ['PROGRESS_NOTE'],
  'PRN': ['PROGRESS_NOTE'],
  'Supervisory': ['PROGRESS_NOTE'],
};

const DocumentsPage = () => {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.organizationId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Document selection
  const [selectedDocTypes, setSelectedDocTypes] = useState(new Set());

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);

  // View state
  const [activeTab, setActiveTab] = useState('generate');
  const [patientFilter, setPatientFilter] = useState('');
  const [showManualSection, setShowManualSection] = useState(false);

  // ============ Data Loading ============
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const patientsData = await getPatients(orgId, { status: 'active' });
      setPatients(patientsData);

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

  // Load assessments when patient changes
  useEffect(() => {
    if (!selectedPatientId) {
      setAssessments([]);
      setSelectedAssessmentId('');
      setSelectedDocTypes(new Set());
      return;
    }

    const loadAssessments = async () => {
      setLoadingAssessments(true);
      try {
        const visitsRef = collection(db, 'organizations', orgId, 'patients', selectedPatientId, 'visits');
        const visitsQuery = query(visitsRef, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(visitsQuery);
        const visits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        }));
        setAssessments(visits);
      } catch (err) {
        console.error('Error loading assessments:', err);
      } finally {
        setLoadingAssessments(false);
      }
    };

    loadAssessments();
  }, [selectedPatientId, orgId]);

  // Smart-select documents when assessment changes
  useEffect(() => {
    if (!selectedAssessmentId) {
      setSelectedDocTypes(new Set());
      return;
    }

    const assessment = assessments.find(a => a.id === selectedAssessmentId);
    if (!assessment) return;

    const visitType = assessment.visitType || 'Routine';
    const recommended = VISIT_TYPE_DOC_MAP[visitType] || ['PROGRESS_NOTE'];
    setSelectedDocTypes(new Set(recommended));
  }, [selectedAssessmentId, assessments]);

  // ============ Computed Values ============
  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const selectedAssessment = assessments.find(a => a.id === selectedAssessmentId);

  const isUrlExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date();
  };

  const toggleDocType = (key) => {
    setSelectedDocTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ============ Document Generation ============
  const handleGenerate = async () => {
    if (!selectedPatient) {
      setGenerationStatus({ type: 'error', message: 'Please select a patient first.' });
      return;
    }

    if (selectedDocTypes.size === 0) {
      setGenerationStatus({ type: 'error', message: 'Please select at least one document type.' });
      return;
    }

    setGenerating(true);
    setGenerationStatus({
      type: 'info',
      message: `Generating ${selectedDocTypes.size} document${selectedDocTypes.size > 1 ? 's' : ''}...`
    });

    const results = [];
    const generateDocFn = httpsCallable(functions, 'generateDocument');

    for (const docType of selectedDocTypes) {
      try {
        const result = await generateDocFn({
          patientId: selectedPatient.id,
          documentType: docType,
          assessmentId: selectedAssessmentId || undefined,
          customData: {}
        });
        results.push({ docType, success: true, data: result.data });
      } catch (err) {
        console.error(`Error generating ${docType}:`, err);
        results.push({ docType, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    setGenerationStatus({
      type: successCount === selectedDocTypes.size ? 'success' : successCount > 0 ? 'warning' : 'error',
      message: successCount === 1 && results.length === 1
        ? `${results[0].data?.message || 'Document generated successfully!'}`
        : `Generated ${successCount} of ${selectedDocTypes.size} documents`,
      results: results.length > 1 ? results : undefined,
      downloadUrl: results.length === 1 && results[0].success ? results[0].data?.downloadUrl : undefined,
      fileName: results.length === 1 && results[0].success ? results[0].data?.fileName : undefined,
      expiresAt: results.length === 1 && results[0].success ? results[0].data?.expiresAt : undefined,
    });

    await loadData();
    setGenerating(false);
  };

  // ============ Render Helpers ============
  const renderGenerationStatus = () => {
    if (!generationStatus) return null;

    const iconMap = {
      info: <Loader2 size={20} className="spin" />,
      success: <CheckCircle size={20} style={{ color: '#10b981' }} />,
      warning: <AlertCircle size={20} style={{ color: '#f59e0b' }} />,
      error: <XCircle size={20} style={{ color: '#ef4444' }} />
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
                <Download size={14} /> Download PDF
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
                  {r.success ? <CheckCircle size={14} style={{ color: '#10b981' }} /> : <XCircle size={14} style={{ color: '#ef4444' }} />}
                  {' '}{DOCUMENT_TYPES.find(d => d.key === r.docType)?.label || r.docType.replace(/_/g, ' ')}
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
        <button className="status-close" onClick={() => setGenerationStatus(null)}>×</button>
      </div>
    );
  };

  // ============ Main Render ============
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <button onClick={loadData} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="documents-page">
      {/* Page Header */}
      <div className="page-header">
        <h2><FileText size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Document Generation</h2>
        <p className="subtitle">Select a patient and assessment, then generate documents</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          <Zap size={16} /> Generate
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={16} /> History ({recentDocs.length})
        </button>
      </div>

      {/* Generation Status Banner */}
      {renderGenerationStatus()}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="generate-section">
          {/* Step 1: Patient Selection */}
          <div className="card">
            <div className="card-header">
              <h3>1. Select Patient</h3>
            </div>
            <div className="card-body">
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setSelectedAssessmentId('');
                  setGenerationStatus(null);
                }}
                className="form-select"
                disabled={generating}
              >
                <option value="">Choose a patient...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.mrNumber || 'No MRN'} — {p.compliance?.cti?.periodShortName || 'N/A'}
                  </option>
                ))}
              </select>

              {selectedPatient && (
                <div className="patient-summary-card">
                  <div className="patient-header">
                    <h4>{selectedPatient.name}</h4>
                    <span className={`status-badge ${(selectedPatient.compliance?.cti?.status || '').toLowerCase()}`}>
                      {selectedPatient.compliance?.cti?.status || 'Unknown'}
                    </span>
                  </div>
                  <div className="patient-details">
                    <div className="detail-row">
                      <span className="label">MRN:</span>
                      <span className="value">{selectedPatient.mrNumber || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Period:</span>
                      <span className="value">{selectedPatient.compliance?.cti?.periodShortName || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Days Until Cert:</span>
                      <span className={`value ${(selectedPatient.compliance?.cti?.daysUntilCertEnd ?? 999) <= 5 ? 'urgent' : ''}`}>
                        {selectedPatient.compliance?.cti?.daysUntilCertEnd ?? 'N/A'}
                      </span>
                    </div>
                    {selectedPatient.compliance?.cti?.requiresF2F && (
                      <div className="detail-row f2f-alert">
                        <span className="label"><AlertCircle size={14} style={{ color: '#f59e0b', verticalAlign: 'middle' }} /> F2F:</span>
                        <span className="value">{selectedPatient.f2fCompleted ? 'Completed' : 'Required'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Assessment Selection */}
          {selectedPatient && (
            <div className="card">
              <div className="card-header">
                <h3>2. Select Assessment <span className="optional-label">(optional)</span></h3>
              </div>
              <div className="card-body">
                {loadingAssessments ? (
                  <div className="inline-loading"><Loader2 size={16} className="spin" /> Loading assessments...</div>
                ) : assessments.length === 0 ? (
                  <p className="help-text">No assessments found for this patient. You can still generate documents without one.</p>
                ) : (
                  <>
                    <select
                      value={selectedAssessmentId}
                      onChange={(e) => setSelectedAssessmentId(e.target.value)}
                      className="form-select"
                      disabled={generating}
                    >
                      <option value="">No assessment (manual generation)</option>
                      {assessments.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.visitDate || a.createdAt?.toLocaleDateString() || 'Unknown date'} — {a.visitType || 'Visit'} — {a.clinicianName || 'Unknown clinician'}
                        </option>
                      ))}
                    </select>

                    {selectedAssessment && (
                      <div className="assessment-summary">
                        <Activity size={16} style={{ color: 'var(--color-primary)' }} />
                        <div>
                          <strong>{selectedAssessment.visitType || 'Visit'}</strong> on {selectedAssessment.visitDate || 'N/A'}
                          {selectedAssessment.clinicianName && <> by {selectedAssessment.clinicianName}</>}
                          {selectedAssessment.bpSystolic && selectedAssessment.bpDiastolic && (
                            <span className="vitals-preview"> — BP {selectedAssessment.bpSystolic}/{selectedAssessment.bpDiastolic}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Document Selection */}
          {selectedPatient && (
            <div className="card">
              <div className="card-header">
                <h3>3. Select Documents</h3>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={generating || selectedDocTypes.size === 0}
                >
                  {generating
                    ? <><Loader2 size={16} className="spin" /> Generating...</>
                    : <><FileText size={16} /> Generate ({selectedDocTypes.size})</>
                  }
                </button>
              </div>
              <div className="card-body">
                {selectedAssessment && (
                  <p className="help-text" style={{ marginBottom: '0.75rem' }}>
                    Documents auto-selected based on <strong>{selectedAssessment.visitType}</strong> visit type. Adjust as needed.
                  </p>
                )}

                <div className="doc-checklist">
                  {DOCUMENT_TYPES.map(docType => {
                    const isSelected = selectedDocTypes.has(docType.key);
                    const IconComponent = docType.icon === 'f2f' ? Handshake
                      : docType.icon === 'visit' ? Activity
                      : docType.icon === 'note' ? ClipboardList
                      : FileText;

                    return (
                      <button
                        key={docType.key}
                        className={`doc-check-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleDocType(docType.key)}
                        disabled={generating}
                      >
                        <span className="check-icon">
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                        <span className="doc-type-icon"><IconComponent size={18} /></span>
                        <div className="doc-type-info">
                          <span className="doc-type-label">{docType.label}</span>
                          <span className="doc-type-desc">{docType.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Manual Generation (collapsible) */}
          {selectedPatient && !selectedAssessmentId && (
            <div className="card">
              <button
                className="card-header collapsible-header"
                onClick={() => setShowManualSection(!showManualSection)}
              >
                <h3>Manual Generation (No Assessment)</h3>
                {showManualSection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showManualSection && (
                <div className="card-body">
                  <p className="help-text">
                    Generate documents without linking to a specific assessment.
                    Patient demographics and certification data will be populated, but clinical fields
                    (vitals, ADLs, narrative notes) will be empty.
                  </p>
                  <div className="manual-actions">
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        const requiredDocs = selectedPatient.compliance?.cti?.requiredDocuments || [];
                        if (requiredDocs.length > 0) {
                          setSelectedDocTypes(new Set(requiredDocs));
                        }
                      }}
                    >
                      <Zap size={14} /> Auto-select Required Docs
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
                        <th>Source</th>
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
                                  <span className="doc-icon"><FileText size={16} /></span>
                                  {doc.templateName || doc.documentType}
                                </div>
                              </td>
                              <td>{doc.patientName}</td>
                              <td>
                                <span className="date">{doc.generatedAt?.toLocaleDateString()}</span>
                                <span className="time">
                                  {doc.generatedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td>
                                <span className={`source-badge ${doc.usedGoogleDocs ? 'gdocs' : 'pdfkit'}`}>
                                  {doc.usedGoogleDocs ? 'Google Docs' : 'PDFKit'}
                                </span>
                              </td>
                              <td>
                                <span className={`url-status ${expired ? 'expired' : 'active'}`}>
                                  {expired
                                    ? <><AlertCircle size={14} /> Expired</>
                                    : <><CheckCircle size={14} /> Active</>
                                  }
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
                                    <Download size={14} /> Download
                                  </a>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => {
                                      setSelectedPatientId(doc.patientId);
                                      setActiveTab('generate');
                                    }}
                                  >
                                    <RefreshCw size={14} /> Regenerate
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
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
          border-radius: var(--radius-md);
          transition: all var(--transition-normal);
        }

        .tab-btn:hover { background: var(--color-gray-100); }
        .tab-btn.active { background: var(--color-primary); color: white; }

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

        .card-body { padding: 1.25rem; }

        .optional-label {
          font-weight: 400;
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
        }

        .collapsible-header {
          cursor: pointer;
          border: none;
          width: 100%;
          text-align: left;
        }

        /* Form Select */
        .form-select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          margin-bottom: 1rem;
          background: white;
        }

        .form-select:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        /* Patient Summary */
        .patient-summary-card {
          background: var(--color-primary-50, #eff6ff);
          border: 1px solid var(--color-primary-light, #bfdbfe);
          border-radius: var(--radius-lg);
          padding: 1rem;
        }

        .patient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .patient-header h4 { margin: 0; color: var(--color-primary-dark, #1e40af); }

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
        }

        .detail-row {
          display: flex;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
        }

        .detail-row .label { color: var(--color-gray-500); }
        .detail-row .value { color: var(--color-gray-800); font-weight: 500; }
        .detail-row .value.urgent { color: #dc2626; }

        .f2f-alert {
          grid-column: span 2;
          background: var(--color-warning-light);
          padding: 0.5rem;
          border-radius: var(--radius-sm);
        }

        /* Assessment Summary */
        .assessment-summary {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.75rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          color: var(--color-gray-700);
        }

        .vitals-preview {
          color: var(--color-gray-400);
          font-size: var(--font-size-xs);
        }

        .inline-loading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
          padding: 0.5rem 0;
        }

        /* Document Checklist */
        .doc-checklist {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .doc-check-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: white;
          cursor: pointer;
          transition: all var(--transition-fast, 0.15s ease);
          text-align: left;
          width: 100%;
        }

        .doc-check-item:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-50, #eff6ff);
        }

        .doc-check-item.selected {
          border-color: var(--color-primary);
          background: var(--color-primary-50, #eff6ff);
        }

        .doc-check-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .check-icon {
          color: var(--color-gray-400);
          display: flex;
          flex-shrink: 0;
        }

        .doc-check-item.selected .check-icon {
          color: var(--color-primary);
        }

        .doc-type-icon {
          color: var(--color-gray-400);
          display: flex;
          flex-shrink: 0;
        }

        .doc-type-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .doc-type-label {
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-gray-800);
        }

        .doc-type-desc {
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        /* Manual section */
        .manual-actions {
          margin-top: 0.75rem;
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

        .status-banner.info { background: var(--color-primary-50, #eff6ff); border: 1px solid var(--color-primary-light, #bfdbfe); }
        .status-banner.success { background: var(--color-success-light); border: 1px solid #bbf7d0; }
        .status-banner.warning { background: #fffbeb; border: 1px solid #fde68a; }
        .status-banner.error { background: var(--color-error-light); border: 1px solid #fecaca; }

        .status-icon { display: flex; }
        .status-content { flex: 1; }
        .status-message { margin: 0 0 0.5rem 0; font-weight: 500; }
        .status-actions { display: flex; align-items: center; gap: 1rem; }
        .expires-note { font-size: var(--font-size-xs); color: var(--color-gray-500); }

        .status-close {
          background: none;
          border: none;
          font-size: var(--font-size-xl);
          cursor: pointer;
          color: var(--color-gray-400);
          padding: 0;
          line-height: 1;
        }

        .results-list { margin-top: 0.75rem; font-size: var(--font-size-sm); }

        .result-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
        }

        .result-item.success { color: var(--color-success-dark); }
        .result-item.error { color: var(--color-error-dark); }
        .result-item a { margin-left: auto; color: var(--color-primary); font-size: var(--font-size-xs); }
        .error-msg { margin-left: auto; font-size: var(--font-size-xs); color: #dc2626; }

        /* Source badge */
        .source-badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-weight: 500;
        }

        .source-badge.gdocs { background: #dbeafe; color: #1d4ed8; }
        .source-badge.pdfkit { background: var(--color-gray-100); color: var(--color-gray-600); }

        /* History Table */
        .filter-input {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          width: 200px;
        }

        .docs-table-wrapper { overflow-x: auto; }

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

        .doc-name { display: flex; align-items: center; gap: 0.5rem; }

        .docs-table .date { display: block; color: var(--color-gray-800); }
        .docs-table .time { display: block; font-size: var(--font-size-xs); color: var(--color-gray-500); }

        .url-status {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
        }

        .url-status.active { background: var(--color-success-light); color: var(--color-success-dark); }
        .url-status.expired { background: var(--color-warning-light); color: var(--color-warning-dark); }

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

        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: var(--color-primary); color: white; }
        .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }

        .btn-outline {
          background: white;
          border: 1px solid var(--color-gray-300);
          color: var(--color-gray-700);
        }

        .btn-outline:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }

        .help-text {
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
          margin: 0;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--color-gray-500);
        }

        .empty-state small { display: block; margin-top: 0.5rem; }

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

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        /* Responsive */
        @media (max-width: 768px) {
          .documents-page { padding: 1rem; }
          .patient-details { grid-template-columns: 1fr; }

          .card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .filter-input { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default DocumentsPage;
