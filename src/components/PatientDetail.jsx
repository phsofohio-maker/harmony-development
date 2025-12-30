/**
 * PatientDetail.jsx - Individual Patient View/Edit Page
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPatient, updatePatient, deletePatient } from '../services/patientService';
import { formatDate } from '../services/certificationCalculations';
import PatientForm from './PatientForm';

const PatientDetail = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const orgId = user?.orgId || 'org_parrish';

  useEffect(() => {
    loadPatient();
  }, [patientId, orgId]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const data = await getPatient(orgId, patientId);
      setPatient(data);
      setError(null);
    } catch (err) {
      console.error('Error loading patient:', err);
      setError('Failed to load patient');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      setSaving(true);
      await updatePatient(orgId, patientId, formData, user.uid);
      await loadPatient();
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving patient:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this patient? This cannot be undone.')) {
      return;
    }
    
    try {
      setSaving(true);
      await deletePatient(orgId, patientId, user.uid);
      navigate('/');
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError('Failed to delete patient');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading patient...</p>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    );
  }

  const cti = patient?.compliance?.cti;
  const huv = patient?.compliance?.huv;

  return (
    <div className="patient-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        
        <div className="header-content">
          <div className="header-title">
            <h1>{patient.name}</h1>
            {patient.isReadmission && (
              <span className="badge badge-readmit">Readmission</span>
            )}
            {cti?.isInSixtyDayPeriod && (
              <span className="badge badge-60day">60-Day Period</span>
            )}
          </div>
          <p className="mr-number">MR#: {patient.mrNumber || 'N/A'}</p>
        </div>

        <div className="header-actions">
          {!isEditing && (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              Edit Patient
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isEditing ? (
        <div className="edit-section">
          <PatientForm
            patient={patient}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            onDelete={handleDelete}
            isLoading={saving}
          />
        </div>
      ) : (
        <div className="detail-content">
          {/* Compliance Status Cards */}
          <div className="status-cards">
            {/* CTI Status */}
            <div className={`status-card ${cti?.isOverdue ? 'status-danger' : cti?.urgency === 'high' ? 'status-warning' : 'status-normal'}`}>
              <div className="status-header">
                <h3>Certification Status</h3>
                <span className={`status-badge urgency-${cti?.urgency || 'normal'}`}>
                  {cti?.isOverdue ? 'OVERDUE' : cti?.status || 'N/A'}
                </span>
              </div>
              
              <div className="status-details">
                <div className="detail-row">
                  <span className="label">Current Period:</span>
                  <span className="value">
                    <strong>Period {cti?.currentBenefitPeriod}</strong> ({cti?.periodDuration}-day)
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Period Name:</span>
                  <span className="value">{cti?.periodShortName}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Days into Period:</span>
                  <span className="value">{cti?.daysIntoPeriod} of {cti?.periodDuration} days</span>
                </div>
                <div className="detail-row">
                  <span className="label">Certification End:</span>
                  <span className="value highlight">{cti ? formatDate(cti.certificationEndDate) : 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Days Remaining:</span>
                  <span className={`value ${cti?.daysUntilCertEnd <= 7 ? 'text-danger' : ''}`}>
                    {cti?.isOverdue ? `${Math.abs(cti.daysUntilCertEnd)} days overdue` : `${cti?.daysUntilCertEnd} days`}
                  </span>
                </div>
              </div>

              {/* Next Period Preview */}
              {cti?.nextPeriod && (
                <div className="next-period">
                  <strong>Next:</strong> {cti.nextPeriod.name} ({cti.nextPeriod.duration}-day)
                  {cti.nextPeriod.requiresF2F && ' - F2F Required'}
                </div>
              )}
            </div>

            {/* F2F Status */}
            {cti?.requiresF2F && (
              <div className={`status-card ${cti.f2fOverdue ? 'status-danger' : !cti.f2fCompleted ? 'status-warning' : 'status-success'}`}>
                <div className="status-header">
                  <h3>Face-to-Face Encounter</h3>
                  <span className={`status-badge ${cti.f2fCompleted ? 'badge-success' : cti.f2fOverdue ? 'badge-danger' : 'badge-warning'}`}>
                    {cti.f2fCompleted ? 'COMPLETED' : cti.f2fOverdue ? 'OVERDUE' : 'REQUIRED'}
                  </span>
                </div>
                
                <div className="status-details">
                  <div className="detail-row">
                    <span className="label">Reason Required:</span>
                    <span className="value">{cti.f2fReason}</span>
                  </div>
                  {cti.f2fCompleted ? (
                    <>
                      <div className="detail-row">
                        <span className="label">Completed Date:</span>
                        <span className="value">{formatDate(patient.f2fDate)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Physician:</span>
                        <span className="value">{patient.f2fPhysician || 'N/A'}</span>
                      </div>
                    </>
                  ) : (
                    <div className="detail-row">
                      <span className="label">Deadline:</span>
                      <span className="value text-danger">{formatDate(cti.f2fDeadline)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HUV Status */}
            {huv && (
              <div className={`status-card ${huv.anyOverdue ? 'status-danger' : huv.anyActionNeeded ? 'status-warning' : 'status-normal'}`}>
                <div className="status-header">
                  <h3>HOPE Update Visits</h3>
                </div>
                
                <div className="huv-grid">
                  <div className={`huv-item ${huv.huv1.status}`}>
                    <div className="huv-label">HUV1 (Days 5-14)</div>
                    <div className="huv-window">{huv.huv1.windowText}</div>
                    <div className={`huv-status status-${huv.huv1.status}`}>
                      {huv.huv1.completed ? '✓ Complete' : 
                       huv.huv1.isOverdue ? '✗ Overdue' :
                       huv.huv1.needsAction ? '⚠ Action Needed' : 'Upcoming'}
                    </div>
                  </div>
                  
                  <div className={`huv-item ${huv.huv2.status}`}>
                    <div className="huv-label">HUV2 (Days 15-28)</div>
                    <div className="huv-window">{huv.huv2.windowText}</div>
                    <div className={`huv-status status-${huv.huv2.status}`}>
                      {huv.huv2.completed ? '✓ Complete' : 
                       huv.huv2.isOverdue ? '✗ Overdue' :
                       huv.huv2.needsAction ? '⚠ Action Needed' : 'Upcoming'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Patient Information */}
          <div className="info-section">
            <h3>Patient Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Admission Date</span>
                <span className="value">{formatDate(patient.admissionDate)}</span>
              </div>
              <div className="info-item">
                <span className="label">Start of Care</span>
                <span className="value">{formatDate(patient.startOfCare)}</span>
              </div>
              <div className="info-item">
                <span className="label">Starting Benefit Period</span>
                <span className="value">Period {patient.startingBenefitPeriod}</span>
              </div>
              <div className="info-item">
                <span className="label">Attending Physician</span>
                <span className="value">{patient.attendingPhysician || 'N/A'}</span>
              </div>
              {patient.isReadmission && (
                <div className="info-item">
                  <span className="label">Prior Hospice Days</span>
                  <span className="value">{patient.priorHospiceDays || 0}</span>
                </div>
              )}
            </div>
          </div>

          {/* Required Documents */}
          {cti?.requiredDocuments && (
            <div className="docs-section">
              <h3>Required Documents for Current Period</h3>
              <ul className="doc-list">
                {cti.requiredDocuments.map(doc => (
                  <li key={doc}>{doc.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .patient-detail {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem;
        }

        .loading-container, .error-container {
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

        .detail-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .back-btn {
          background: none;
          border: none;
          color: #2563eb;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .header-content { flex: 1; }
        .header-title { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .header-title h1 { margin: 0; font-size: 1.5rem; }
        .mr-number { color: #6b7280; margin: 0.25rem 0 0 0; }

        .badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .badge-readmit { background: #e0e7ff; color: #3730a3; }
        .badge-60day { background: #f3e8ff; color: #6b21a8; }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }

        .btn { padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; cursor: pointer; border: none; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }

        .error-banner {
          background: #fee2e2;
          color: #991b1b;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .status-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .status-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 1.25rem;
        }

        .status-card.status-danger { border-left: 4px solid #ef4444; }
        .status-card.status-warning { border-left: 4px solid #f59e0b; }
        .status-card.status-success { border-left: 4px solid #10b981; }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .status-header h3 { margin: 0; font-size: 1rem; }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .urgency-critical, .urgency-high { background: #fee2e2; color: #991b1b; }
        .urgency-medium { background: #fef3c7; color: #92400e; }
        .urgency-normal { background: #f3f4f6; color: #6b7280; }

        .status-details { display: flex; flex-direction: column; gap: 0.5rem; }
        .detail-row { display: flex; justify-content: space-between; font-size: 0.875rem; }
        .detail-row .label { color: #6b7280; }
        .detail-row .value.highlight { font-weight: 600; color: #1f2937; }
        .detail-row .value.text-danger { color: #ef4444; font-weight: 600; }

        .next-period {
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid #e5e7eb;
          font-size: 0.8rem;
          color: #6b7280;
        }

        .huv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .huv-item { text-align: center; padding: 0.75rem; background: #f9fafb; border-radius: 6px; }
        .huv-label { font-weight: 600; font-size: 0.875rem; }
        .huv-window { font-size: 0.75rem; color: #6b7280; margin: 0.25rem 0; }
        .huv-status { font-size: 0.75rem; font-weight: 500; margin-top: 0.5rem; }
        .huv-status.status-complete { color: #065f46; }
        .huv-status.status-overdue { color: #991b1b; }
        .huv-status.status-action-needed { color: #92400e; }

        .info-section, .docs-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }

        .info-section h3, .docs-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .info-item .label { display: block; font-size: 0.75rem; color: #6b7280; margin-bottom: 0.25rem; }
        .info-item .value { font-size: 0.875rem; font-weight: 500; }

        .doc-list {
          margin: 0;
          padding-left: 1.5rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.5rem;
        }

        .doc-list li { font-size: 0.875rem; }

        .edit-section { background: white; border-radius: 10px; padding: 1.5rem; }
      `}</style>
    </div>
  );
};

export default PatientDetail;