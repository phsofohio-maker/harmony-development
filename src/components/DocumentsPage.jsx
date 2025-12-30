/**
 * DocumentsPage.jsx - Document Template Library & Generation
 * 
 * PURPOSE:
 * Manage document templates and generate certification documents
 * for patients based on their current benefit period.
 * 
 * FEATURES:
 * - Quick document generation by patient
 * - Template library overview
 * - Recently generated documents (placeholder)
 * - Template management (future feature)
 * 
 * NOTE: Actual PDF generation would integrate with your
 * existing Google Apps Script or a new Firebase function.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients } from '../services/patientService';
import { formatDate, determineCertPeriodByBenefit } from '../services/certificationCalculations';

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
    id: '90DAY1',
    name: '90-Day Certification (Initial)',
    description: 'Initial 90-day benefit period certification form',
    periods: ['Period 1'],
    icon: '📋',
  },
  {
    id: '90DAY2',
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
    description: 'Comprehensive patient history documentation',
    periods: ['Period 1'],
    icon: '📚',
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
  const { user } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick generate state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [generating, setGenerating] = useState(false);

  // Recently generated (mock data for now)
  const [recentDocs] = useState([
    { id: 1, name: '60DAY - Johnson, Mary', date: new Date(Date.now() - 86400000), user: 'Reneesha T.' },
    { id: 2, name: 'PROGRESS_NOTE - Johnson, Mary', date: new Date(Date.now() - 86400000), user: 'Reneesha T.' },
    { id: 3, name: '90DAY1 - Brown, Patricia', date: new Date(Date.now() - 172800000), user: 'Tajuanna W.' },
    { id: 4, name: 'ATTEND_CERT - Brown, Patricia', date: new Date(Date.now() - 172800000), user: 'Tajuanna W.' },
  ]);

  // Load patients
  useEffect(() => {
    loadPatients();
  }, [orgId]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { status: 'active' });
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients:', err);
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

  // Handle document generation
  const handleGenerate = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first.');
      return;
    }

    setGenerating(true);

    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const requiredDocs = getRequiredDocs();
    
    // In a real implementation, this would:
    // 1. Call a Cloud Function to generate PDFs
    // 2. Use Google Docs API to fill templates
    // 3. Return download links
    
    alert(
      `Documents Generated for ${selectedPatient.name}:\n\n` +
      `Period: ${selectedPatient.compliance?.cti?.periodShortName}\n` +
      `Documents:\n${requiredDocs.map(d => `• ${d}`).join('\n')}\n\n` +
      `Note: In production, this would generate actual PDF documents.`
    );

    setGenerating(false);
  };

  // Handle single template generation
  const handleGenerateTemplate = (template) => {
    if (!selectedPatient) {
      alert('Please select a patient first using the Quick Generate section above.');
      return;
    }

    alert(
      `Generating: ${template.name}\n` +
      `For Patient: ${selectedPatient.name}\n\n` +
      `Note: In production, this would generate the actual document.`
    );
  };

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
                onChange={(e) => setSelectedPatientId(e.target.value)}
                disabled={loading}
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
              onClick={handleGenerate}
              disabled={!selectedPatientId || generating}
            >
              {generating ? '⏳ Generating...' : '📄 Generate Documents'}
            </button>
          </div>

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
                  {selectedPatient.compliance?.cti?.requiresF2F && !selectedPatient.compliance?.cti?.f2fCompleted && (
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
          <button className="btn btn-secondary btn-sm" disabled>
            + Upload Template
          </button>
        </div>
        <div className="card-body">
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
                    onClick={() => handleGenerateTemplate(template)}
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
          <h3>🕐 Recently Generated</h3>
        </div>
        <div className="card-body">
          {recentDocs.length === 0 ? (
            <div className="empty-state">
              <p>No documents generated yet.</p>
            </div>
          ) : (
            <div className="recent-list">
              {recentDocs.map(doc => (
                <div key={doc.id} className="recent-item">
                  <div className="recent-icon">📄</div>
                  <div className="recent-content">
                    <span className="recent-name">{doc.name}</span>
                    <span className="recent-meta">
                      Generated {formatDate(doc.date)} by {doc.user}
                    </span>
                  </div>
                  <div className="recent-actions">
                    <button className="icon-btn" title="View">👁️</button>
                    <button className="icon-btn" title="Download">⬇️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Integration Note */}
      <div className="info-card">
        <div className="info-icon">ℹ️</div>
        <div className="info-content">
          <strong>Document Generation Integration</strong>
          <p>
            Full document generation will connect to your existing Google Docs templates. 
            The system will auto-fill patient data and create downloadable PDFs. 
            Contact your administrator to complete the integration setup.
          </p>
        </div>
      </div>

      <style>{`
        .documents-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

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

        .card-body {
          padding: 1.25rem;
        }

        .section-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0 0 1rem 0;
        }

        /* Quick Generate Form */
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

        /* Selected Patient Info */
        .selected-patient-info {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
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
          font-size: 0.6875rem;
          padding: 0.125rem 0.5rem;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 4px;
        }

        .template-actions {
          display: flex;
          gap: 0.5rem;
        }

        /* Recent List */
        .recent-list {
          display: flex;
          flex-direction: column;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .recent-item:last-child {
          border-bottom: none;
        }

        .recent-icon {
          font-size: 1.25rem;
        }

        .recent-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
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
          gap: 0.25rem;
        }

        .icon-btn {
          background: none;
          border: none;
          padding: 0.375rem;
          cursor: pointer;
          border-radius: 4px;
          font-size: 1rem;
        }

        .icon-btn:hover {
          background: #f3f4f6;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }

        /* Info Card */
        .info-card {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
        }

        .info-icon {
          font-size: 1.25rem;
        }

        .info-content {
          flex: 1;
        }

        .info-content strong {
          display: block;
          font-size: 0.875rem;
          color: #1e40af;
          margin-bottom: 0.25rem;
        }

        .info-content p {
          margin: 0;
          font-size: 0.8125rem;
          color: #1e40af;
          opacity: 0.8;
        }

        /* Buttons */
        .btn {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
          font-weight: 500;
          white-space: nowrap;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-outline {
          background: white;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .btn-outline:hover {
          background: #f9fafb;
        }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
        }

        @media (max-width: 768px) {
          .generate-form {
            flex-direction: column;
            align-items: stretch;
          }

          .patient-summary {
            grid-template-columns: repeat(2, 1fr);
          }

          .template-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .template-actions {
            width: 100%;
          }

          .template-actions .btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentsPage;