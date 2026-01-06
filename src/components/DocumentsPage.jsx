/**
 * DocumentsPage.jsx - Document Generation with Google Docs Integration
 * Updated to call Cloud Functions for real document generation
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients } from '../services/patientService';
import { formatDate } from '../services/certificationCalculations';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Document templates configuration
const TEMPLATES = [
  {
    id: '60DAY',
    name: '60-Day Certification',
    description: 'Subsequent 60-day benefit period certification form',
    periods: ['Period 3+'],
    icon: '📋',
  },
  {
    id: '90DAY_INITIAL',
    name: '90-Day Certification (Initial)',
    description: 'Initial 90-day benefit period certification form',
    periods: ['Period 1'],
    icon: '📋',
  },
  {
    id: '90DAY_SECOND',
    name: '90-Day Certification (Second)',
    description: 'Second 90-day benefit period certification form',
    periods: ['Period 2'],
    icon: '📋',
  },
  {
    id: 'ATTEND_CERT',
    name: 'Attending Physician Certification',
    description: 'Certification statement from attending physician',
    periods: ['Period 1'],
    icon: '👨‍⚕️',
  },
  {
    id: 'PROGRESS_NOTE',
    name: 'Progress Note',
    description: 'Clinical progress documentation',
    periods: ['Period 2', 'Period 3+'],
    icon: '📝',
  },
  {
    id: 'PATIENT_HISTORY',
    name: 'Patient History',
    description: 'Patient history documentation',
    periods: ['Period 1'],
    icon: '📝',
  },
  
  {
    id: 'F2F_ENCOUNTER',
    name: 'Face-to-Face Encounter',
    description: 'F2F encounter documentation for recertification',
    periods: ['Period 3+', 'Readmissions'],
    icon: '🤝',
  },
];

const DocumentsPage = () => {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.organizationId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick generate state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);

  // Load patients and recent documents
  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patients
      const patientsData = await getPatients(orgId, { status: 'active' });
      setPatients(patientsData);
      
      // Load recent documents
      const docsRef = collection(db, 'organizations', orgId, 'generatedDocuments');
      const docsQuery = query(docsRef, orderBy('generatedAt', 'desc'), limit(10));
      const docsSnapshot = await getDocs(docsQuery);
      
      const docs = docsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        generatedAt: doc.data().generatedAt?.toDate()
      }));
      
      setRecentDocs(docs);
      
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get selected patient
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Get required documents for selected patient
  const getRequiredDocs = () => {
    if (!selectedPatient) return [];
    const cti = selectedPatient.compliance?.cti;
    if (!cti) return [];
    return cti.requiredDocuments || [];
  };

// Generate all documents for a patient
const handleGenerateAll = async () => {
  if (!selectedPatient) {
    alert('Please select a patient first.');
    return;
  }

  setGenerating(true);
  setGenerationStatus({ type: 'info', message: 'Generating documents...' });
  
  try {
    const requiredDocs = getRequiredDocs();
    
    if (requiredDocs.length === 0) {
      throw new Error('No required documents found for this patient');
    }

    // Generate each document sequentially
    const results = [];
    for (const docType of requiredDocs) {
      try {
        const generateDocument = httpsCallable(functions, 'generateCertificationDocs');
        const result = await generateDocument({
          patientId: selectedPatient.id,
          documentType: docType,  // ✅ FIXED: Added documentType
          customData: {}
        });
        
        results.push({ 
          docType, 
          success: true, 
          data: result.data,
          documentLink: result.data.downloadUrl
        });
      } catch (error) {
        console.error(`Error generating ${docType}:`, error);
        results.push({ 
          docType, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    setGenerationStatus({
      type: successCount > 0 ? 'success' : 'error',
      message: `✓ Generated ${successCount} of ${requiredDocs.length} documents for ${selectedPatient.name}`,
      results
    });
    
    // Reload recent documents
    await loadData();
    
  } catch (error) {
    console.error('Document generation error:', error);
    setGenerationStatus({
      type: 'error',
      message: `✗ Failed to generate documents: ${error.message}`
    });
  } finally {
    setGenerating(false);
  }
};

// Generate a single template
const handleGenerateSingle = async (template) => {
  if (!selectedPatient) {
    alert('Please select a patient first using the Quick Generate section above.');
    return;
  }

  setGenerating(true);
  setGenerationStatus({ type: 'info', message: `Generating ${template.name}...` });
  
  try {
    const generateDocument = httpsCallable(functions, 'generateCertificationDocs');
    const result = await generateDocument({
      patientId: selectedPatient.id,
      documentType: template.id,  // ✅ FIXED: Changed from "templateType" to "documentType"
      customData: {}
    });
    
    if (result.data.success) {
      setGenerationStatus({
        type: 'success',
        message: `✓ ${template.name} generated successfully!`,
        documentLink: result.data.downloadUrl,  // Updated to match Cloud Function response
        pdfLink: result.data.downloadUrl
      });
      
      await loadData();
    }
    
  } catch (error) {
    console.error('Document generation error:', error);
    setGenerationStatus({
      type: 'error',
      message: `✗ Failed to generate ${template.name}: ${error.message}`
    });
  } finally {
    setGenerating(false);
  }
};
  // Open document in new tab
  const openDocument = (link) => {
    window.open(link, '_blank');
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="documents-page">
      {/* Quick Generate Section */}
      <div className="quick-generate-card">
        <div className="card-header">
          <h3>⚡ Quick Generate Documents</h3>
        </div>
        <div className="card-body">
          <p className="section-description">
            Select a patient to automatically generate all required documents for their current certification period.
          </p>

          <div className="generate-form">
            <div className="form-group">
              <label htmlFor="patientSelect">Select Patient</label>
              <select
                id="patientSelect"
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setGenerationStatus(null);
                }}
                disabled={loading || generating}
              >
                <option value="">Choose a patient...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrNumber || 'No MR#'}) - {p.compliance?.cti?.periodShortName || 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleGenerateAll}
              disabled={!selectedPatientId || generating}
            >
              {generating ? '⏳ Generating...' : '📄 Generate All Documents'}
            </button>
          </div>

          {/* Generation Status */}
          {generationStatus && (
            <div className={`status-message status-${generationStatus.type}`}>
              <p>{generationStatus.message}</p>
              
              {generationStatus.documentLink && (
                <div className="status-links">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => openDocument(generationStatus.documentLink)}
                  >
                    📝 Open Document
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => openDocument(generationStatus.pdfLink)}
                  >
                    📄 View PDF
                  </button>
                </div>
              )}
              
              {generationStatus.results && (
                <div className="generation-results">
                  <h4>Generation Results:</h4>
                  <ul>
                    {generationStatus.results.map((result, idx) => (
                      <li key={idx} className={result.success ? 'success' : 'error'}>
                        {result.success ? '✓' : '✗'} {result.docType}
                        {result.documentLink && (
                          <button 
                            className="link-btn"
                            onClick={() => openDocument(result.documentLink)}
                          >
                            View
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Selected Patient Info */}
          {selectedPatient && (
            <div className="selected-patient-info">
              <div className="patient-summary">
                <div className="summary-item">
                  <span className="summary-label">Patient</span>
                  <span className="summary-value">{selectedPatient.name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Current Period</span>
                  <span className="summary-value">
                    {selectedPatient.compliance?.cti?.periodShortName || 'N/A'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Cert End Date</span>
                  <span className="summary-value">
                    {formatDate(selectedPatient.compliance?.cti?.certificationEndDate)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Days Remaining</span>
                  <span className={`summary-value ${selectedPatient.compliance?.cti?.daysUntilCertEnd <= 7 ? 'urgent' : ''}`}>
                    {selectedPatient.compliance?.cti?.daysUntilCertEnd ?? 'N/A'}
                  </span>
                </div>
              </div>

              <div className="required-docs">
                <h4>Required Documents:</h4>
                <ul>
                  {getRequiredDocs().map(doc => (
                    <li key={doc}>
                      <span className="doc-icon">📄</span>
                      {doc.replace(/_/g, ' ')}
                    </li>
                  ))}
                  {selectedPatient.compliance?.cti?.requiresF2F && !selectedPatient.f2fCompleted && (
                    <li className="f2f-required">
                      <span className="doc-icon">🤝</span>
                      F2F Encounter Documentation (Required)
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Library */}
      <div className="templates-card">
        <div className="card-header">
          <h3>📚 Document Templates</h3>
          <span className="info-badge">Google Docs Integration</span>
        </div>
        <div className="card-body">
          <p className="section-description">
            Generate individual documents from templates. Select a patient above first.
          </p>
          <div className="templates-grid">
            {TEMPLATES.map(template => (
              <div key={template.id} className="template-item">
                <div className="template-icon">{template.icon}</div>
                <div className="template-content">
                  <h4>{template.name}</h4>
                  <p>{template.description}</p>
                  <div className="template-periods">
                    {template.periods.map(period => (
                      <span key={period} className="period-tag">{period}</span>
                    ))}
                  </div>
                </div>
                <div className="template-actions">
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => handleGenerateSingle(template)}
                    disabled={!selectedPatient || generating}
                  >
                    Generate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Generated */}
      <div className="recent-card">
        <div className="card-header">
          <h3>🕐 Recently Generated Documents</h3>
        </div>
        <div className="card-body">
          {recentDocs.length === 0 ? (
            <div className="empty-state">
              <p>No documents generated yet.</p>
              <small>Generate your first document using the form above</small>
            </div>
          ) : (
            <div className="recent-list">
              {recentDocs.map(doc => (
                <div key={doc.id} className="recent-item">
                  <div className="recent-icon">📄</div>
                  <div className="recent-content">
                    <span className="recent-name">
                      {doc.templateType} - {doc.patientName}
                    </span>
                    <span className="recent-meta">
                      Generated {formatDate(doc.generatedAt)}
                    </span>
                  </div>
                  <div className="recent-actions">
                    <button 
                      className="icon-btn" 
                      title="Open Document"
                      onClick={() => openDocument(doc.documentLink)}
                    >
                      📝
                    </button>
                    <button 
                      className="icon-btn" 
                      title="View PDF"
                      onClick={() => openDocument(doc.pdfLink)}
                    >
                      📄
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .documents-page {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .page-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* Cards */
        .quick-generate-card,
        .templates-card,
        .recent-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .card-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .info-badge {
          padding: 0.25rem 0.625rem;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .card-body {
          padding: 1.25rem;
        }

        .section-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0 0 1rem 0;
        }

        /* Generate Form */
        .generate-form {
          display: flex;
          align-items: flex-end;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .form-group {
          flex: 1;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .form-group select {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.875rem;
          background: white;
        }

        .form-group select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #64748b;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #475569;
        }

        .btn-sm {
          padding: 0.5rem 0.875rem;
          font-size: 0.8125rem;
        }

        .btn-outline {
          background: white;
          border: 1px solid #e5e7eb;
          color: #374151;
        }

        .btn-outline:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #2563eb;
          color: #2563eb;
        }

        /* Status Message */
        .status-message {
          padding: 1rem;
          border-radius: 8px;
          margin-top: 1rem;
        }

        .status-message p {
          margin: 0 0 0.5rem 0;
          font-weight: 500;
        }

        .status-info {
          background: #dbeafe;
          border: 1px solid #93c5fd;
          color: #1e40af;
        }

        .status-success {
          background: #d1fae5;
          border: 1px solid #86efac;
          color: #065f46;
        }

        .status-error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }

        .status-links {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .generation-results {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .generation-results h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
        }

        .generation-results ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .generation-results li {
          padding: 0.375rem 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .link-btn {
          background: none;
          border: none;
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
          font-size: 0.8125rem;
          padding: 0 0.5rem;
        }

        /* Selected Patient Info */
        .selected-patient-info {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .patient-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .summary-label {
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
        }

        .summary-value {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #1f2937;
        }

        .summary-value.urgent {
          color: #ef4444;
        }

        .required-docs h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: #374151;
        }

        .required-docs ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .required-docs li {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.8125rem;
        }

        .required-docs li.f2f-required {
          background: #fef3c7;
          border-color: #fde68a;
          color: #92400e;
        }

        .doc-icon {
          font-size: 0.875rem;
        }

        /* Templates Grid */
        .templates-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .template-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          transition: border-color 0.15s;
        }

        .template-item:hover {
          border-color: #d1d5db;
        }

        .template-icon {
          font-size: 1.5rem;
          width: 40px;
          text-align: center;
        }

        .template-content {
          flex: 1;
        }

        .template-content h4 {
          margin: 0 0 0.25rem 0;
          font-size: 0.9375rem;
          color: #1f2937;
        }

        .template-content p {
          margin: 0 0 0.5rem 0;
          font-size: 0.8125rem;
          color: #6b7280;
        }

        .template-periods {
          display: flex;
          gap: 0.375rem;
        }

        .period-tag {
          padding: 0.125rem 0.5rem;
          background: #f3f4f6;
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #4b5563;
        }

        /* Recent Documents */
        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #6b7280;
        }

        .empty-state small {
          display: block;
          margin-top: 0.5rem;
          font-size: 0.8125rem;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          transition: background 0.15s;
        }

        .recent-item:hover {
          background: #f9fafb;
        }

        .recent-icon {
          font-size: 1.25rem;
        }

        .recent-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .recent-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f2937;
        }

        .recent-meta {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .recent-actions {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          background: none;
          border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.15s;
        }

        .icon-btn:hover {
          background: #f9fafb;
          border-color: #2563eb;
        }

        @media (max-width: 768px) {
          .documents-page {
            padding: 1rem;
          }

          .generate-form {
            flex-direction: column;
            align-items: stretch;
          }

          .patient-summary {
            grid-template-columns: repeat(2, 1fr);
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentsPage;