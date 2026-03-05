/**
 * HomeVisitsPage.jsx - Home Visits Assessment Toolkit/Dashboard
 *
 * Wrapper page for the home visits workflow:
 *   - Patient selector
 *   - Quick-access patient profile (demographics, hazards, maps link)
 *   - Previous assessments table
 *   - "Start New Assessment" opens HomeVisitAssessment as a modal
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients } from '../services/patientService';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import HomeVisitAssessment from './HomeVisitAssessment';
import {
  AlertTriangle,
  MapPin,
  Phone,
  Calendar,
  User,
  Plus,
  Eye,
  X,
  Loader2,
  ClipboardList,
} from 'lucide-react';

const HomeVisitsPage = () => {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.organizationId || user?.customClaims?.orgId || 'org_parrish';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [viewingVisit, setViewingVisit] = useState(null);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Load patients
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { status: 'active' });
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Load visits when patient changes
  useEffect(() => {
    if (selectedPatientId) {
      loadVisits();
    } else {
      setVisits([]);
    }
  }, [selectedPatientId]);

  const loadVisits = async () => {
    try {
      setVisitsLoading(true);
      const visitsRef = collection(
        db, 'organizations', orgId, 'patients', selectedPatientId, 'visits'
      );
      const visitsQuery = query(visitsRef, orderBy('createdAt', 'desc'), limit(10));
      const snapshot = await getDocs(visitsQuery);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
      setVisits(data);
    } catch (err) {
      console.error('Error loading visits:', err);
    } finally {
      setVisitsLoading(false);
    }
  };

  const calcAge = (dob) => {
    if (!dob) return 'N/A';
    const d = dob.toDate ? dob.toDate() : new Date(dob);
    if (isNaN(d.getTime())) return 'N/A';
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const handleAssessmentClose = () => {
    setShowAssessmentModal(false);
    // Refresh visits list
    if (selectedPatientId) loadVisits();
  };

  if (loading) {
    return (
      <div className="hvp-loading">
        <Loader2 size={24} className="hvp-spin" />
        <span>Loading...</span>
        <style>{hvpStyles}</style>
      </div>
    );
  }

  return (
    <div className="hvp-page">
      {/* Header */}
      <div className="hvp-header">
        <h2><ClipboardList size={22} style={{verticalAlign: 'middle', marginRight: '0.5rem'}} />Home Visits</h2>
        <div className="hvp-patient-select">
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
          >
            <option value="">Select Patient...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.mrNumber ? `(MR# ${p.mrNumber})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedPatient && (
        <div className="hvp-empty-state">
          <User size={32} />
          <p>Select a patient to view their home visit dashboard</p>
        </div>
      )}

      {selectedPatient && (
        <>
          {/* Quick-Access Patient Profile */}
          <div className="hvp-card hvp-profile-card">
            <div className="hvp-card-header">
              <h3>Quick-Access Patient Profile</h3>
            </div>
            <div className="hvp-card-body">
              <div className="hvp-profile-grid">
                <div className="hvp-profile-item">
                  <span className="hvp-label">Name</span>
                  <span className="hvp-value">{selectedPatient.name}</span>
                </div>
                <div className="hvp-profile-item">
                  <span className="hvp-label">Age</span>
                  <span className="hvp-value">{calcAge(selectedPatient.dateOfBirth)}</span>
                </div>
                <div className="hvp-profile-item">
                  <span className="hvp-label">Gender</span>
                  <span className="hvp-value">{selectedPatient.gender || 'N/A'}</span>
                </div>
                <div className="hvp-profile-item">
                  <span className="hvp-label">Language</span>
                  <span className="hvp-value">{selectedPatient.primaryLanguage || 'English'}</span>
                </div>
              </div>

              {/* Known Hazards */}
              {selectedPatient.knownHazards && (
                <div className="hvp-hazards">
                  <AlertTriangle size={16} />
                  <span><strong>Known Hazards:</strong> {selectedPatient.knownHazards}</span>
                </div>
              )}

              {/* Contact & Address */}
              <div className="hvp-contact-row">
                {(selectedPatient.primaryContact?.phone || selectedPatient.phone) && (
                  <div className="hvp-contact-item">
                    <Phone size={14} />
                    <span>{selectedPatient.primaryContact?.phone || selectedPatient.phone}</span>
                  </div>
                )}
                {selectedPatient.address && (
                  <div className="hvp-contact-item">
                    <MapPin size={14} />
                    <span>{selectedPatient.address}</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPatient.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hvp-maps-link"
                    >
                      Open in Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Previous Assessments */}
          <div className="hvp-card">
            <div className="hvp-card-header">
              <h3>Previous Assessments</h3>
              <span className="hvp-badge">{visits.length}</span>
            </div>
            <div className="hvp-card-body">
              {visitsLoading ? (
                <div className="hvp-loading-inline">
                  <Loader2 size={16} className="hvp-spin" />
                  <span>Loading assessments...</span>
                </div>
              ) : visits.length === 0 ? (
                <div className="hvp-empty-inline">
                  No previous assessments recorded.
                </div>
              ) : (
                <table className="hvp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Provider</th>
                      <th>Visit Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map(visit => (
                      <tr key={visit.id}>
                        <td>{visit.visitDate || visit.createdAt?.toLocaleDateString() || 'N/A'}</td>
                        <td>{visit.clinicianName || 'N/A'}</td>
                        <td>
                          <span className="hvp-visit-type">{visit.visitType || 'Routine'}</span>
                        </td>
                        <td>
                          <button
                            className="hvp-btn-sm"
                            onClick={() => setViewingVisit(visit)}
                          >
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Start New Assessment Button */}
          <div className="hvp-action-bar">
            <button
              className="hvp-btn-primary"
              onClick={() => setShowAssessmentModal(true)}
            >
              <Plus size={18} />
              Start New Assessment
            </button>
          </div>
        </>
      )}

      {/* Assessment Modal */}
      {showAssessmentModal && (
        <div className="hvp-modal-overlay">
          <div className="hvp-modal">
            <div className="hvp-modal-header">
              <h3>New Home Visit Assessment</h3>
              <button className="hvp-modal-close" onClick={handleAssessmentClose}>
                <X size={20} />
              </button>
            </div>
            <div className="hvp-modal-body">
              <HomeVisitAssessment
                preSelectedPatientId={selectedPatientId}
                onComplete={handleAssessmentClose}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Visit Detail Modal */}
      {viewingVisit && (
        <div className="hvp-modal-overlay">
          <div className="hvp-modal">
            <div className="hvp-modal-header">
              <h3>Assessment Detail — {viewingVisit.visitDate || 'N/A'}</h3>
              <button className="hvp-modal-close" onClick={() => setViewingVisit(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="hvp-modal-body">
              <div className="hvp-detail-grid">
                <div className="hvp-detail-section">
                  <h4>Visit Info</h4>
                  <div className="hvp-detail-row"><span>Date:</span> {viewingVisit.visitDate || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Time:</span> {viewingVisit.visitTime || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Type:</span> {viewingVisit.visitType || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Provider:</span> {viewingVisit.clinicianName || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Title:</span> {viewingVisit.clinicianTitle || 'N/A'}</div>
                </div>
                <div className="hvp-detail-section">
                  <h4>Vitals</h4>
                  <div className="hvp-detail-row"><span>BP:</span> {viewingVisit.bpSystolic && viewingVisit.bpDiastolic ? `${viewingVisit.bpSystolic}/${viewingVisit.bpDiastolic}` : 'N/A'}</div>
                  <div className="hvp-detail-row"><span>HR:</span> {viewingVisit.heartRate || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>RR:</span> {viewingVisit.respiratoryRate || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Temp:</span> {viewingVisit.temperature || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>O2 Sat:</span> {viewingVisit.o2Saturation || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Pain:</span> {viewingVisit.painLevel || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Weight:</span> {viewingVisit.weight || 'N/A'}</div>
                </div>
                <div className="hvp-detail-section">
                  <h4>Performance</h4>
                  <div className="hvp-detail-row"><span>PPS Score:</span> {viewingVisit.performanceScore || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Mobility:</span> {viewingVisit.mobilityStatus || 'N/A'}</div>
                  <div className="hvp-detail-row"><span>Fall Risk:</span> {viewingVisit.fallRisk || 'N/A'}</div>
                </div>
              </div>
              {viewingVisit.narrativeNotes && (
                <div className="hvp-detail-section" style={{marginTop: '1rem'}}>
                  <h4>Narrative Notes</h4>
                  <p className="hvp-narrative">{viewingVisit.narrativeNotes}</p>
                </div>
              )}
              {viewingVisit.symptomNotes && (
                <div className="hvp-detail-section" style={{marginTop: '1rem'}}>
                  <h4>Symptom Notes</h4>
                  <p className="hvp-narrative">{viewingVisit.symptomNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{hvpStyles}</style>
    </div>
  );
};

const hvpStyles = `
  .hvp-page { max-width: 1000px; margin: 0 auto; }

  .hvp-loading {
    display: flex; align-items: center; justify-content: center;
    gap: 0.75rem; padding: 4rem;
    color: var(--color-gray-500);
  }

  .hvp-spin { animation: hvp-spin 1s linear infinite; }
  @keyframes hvp-spin { to { transform: rotate(360deg); } }

  /* Header */
  .hvp-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;
  }
  .hvp-header h2 { margin: 0; font-size: 1.5rem; color: var(--color-gray-800); }
  .hvp-patient-select select {
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    min-width: 280px;
  }
  .hvp-patient-select select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }

  /* Cards */
  .hvp-card {
    background: white; border: 1px solid var(--border-color);
    border-radius: var(--radius-xl); margin-bottom: 1rem; overflow: hidden;
  }
  .hvp-card-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--color-gray-50);
  }
  .hvp-card-header h3 { margin: 0; font-size: var(--font-size-base); }
  .hvp-card-body { padding: 1.25rem; }

  .hvp-badge {
    font-size: var(--font-size-xs);
    padding: 0.125rem 0.5rem;
    background: var(--color-gray-200);
    border-radius: var(--radius-sm);
    color: var(--color-gray-600);
  }

  /* Profile */
  .hvp-profile-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1rem; margin-bottom: 1rem;
  }
  .hvp-profile-item { display: flex; flex-direction: column; }
  .hvp-label { font-size: var(--font-size-xs); color: var(--color-gray-500); text-transform: uppercase; letter-spacing: 0.05em; }
  .hvp-value { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-gray-900); }

  .hvp-hazards {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: #fffbeb; border: 1px solid #fde68a;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm); color: #92400e;
    margin-bottom: 1rem;
  }

  .hvp-contact-row {
    display: flex; flex-direction: column; gap: 0.5rem;
  }
  .hvp-contact-item {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: var(--font-size-sm); color: var(--color-gray-600);
  }
  .hvp-maps-link {
    margin-left: 0.5rem; font-size: var(--font-size-xs);
    color: var(--color-primary); text-decoration: none;
    font-weight: 500;
  }
  .hvp-maps-link:hover { text-decoration: underline; }

  /* Empty states */
  .hvp-empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 1rem;
    padding: 4rem 2rem; color: var(--color-gray-400);
    text-align: center;
  }
  .hvp-empty-state p { margin: 0; font-size: var(--font-size-sm); }
  .hvp-empty-inline {
    padding: 2rem; text-align: center;
    color: var(--color-gray-500); font-size: var(--font-size-sm);
  }
  .hvp-loading-inline {
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; padding: 2rem; color: var(--color-gray-500);
    font-size: var(--font-size-sm);
  }

  /* Table */
  .hvp-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
  .hvp-table th {
    text-align: left; padding: 0.625rem 0.75rem;
    background: var(--color-gray-50); border-bottom: 1px solid var(--border-color);
    font-weight: 500; color: var(--color-gray-500);
  }
  .hvp-table td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border-color); }

  .hvp-visit-type {
    display: inline-block; padding: 0.125rem 0.5rem;
    background: var(--color-gray-100); border-radius: var(--radius-sm);
    font-size: var(--font-size-xs); color: var(--color-gray-700);
  }

  .hvp-btn-sm {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.25rem 0.625rem; border: 1px solid var(--color-gray-300);
    background: white; border-radius: var(--radius-md);
    font-size: var(--font-size-xs); color: var(--color-gray-600);
    cursor: pointer;
  }
  .hvp-btn-sm:hover { border-color: var(--color-primary); color: var(--color-primary); }

  /* Action bar */
  .hvp-action-bar {
    display: flex; justify-content: center; padding: 1.5rem 0;
  }
  .hvp-btn-primary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--color-primary); color: white; border: none;
    border-radius: var(--radius-lg); font-size: var(--font-size-base);
    font-weight: 500; cursor: pointer;
  }
  .hvp-btn-primary:hover { background: var(--color-primary-hover); }

  /* Modal */
  .hvp-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 1rem;
  }
  .hvp-modal {
    background: white; border-radius: var(--radius-xl);
    width: 100%; max-width: 900px; max-height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .hvp-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }
  .hvp-modal-header h3 { margin: 0; font-size: 1.125rem; }
  .hvp-modal-close {
    background: none; border: none; cursor: pointer;
    color: var(--color-gray-500); line-height: 1;
  }
  .hvp-modal-close:hover { color: var(--color-gray-800); }
  .hvp-modal-body {
    overflow-y: auto; flex: 1; min-height: 0;
    padding: 0;
  }

  /* Detail view */
  .hvp-detail-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
  }
  .hvp-detail-section h4 {
    margin: 0 0 0.5rem; font-size: 0.8rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--color-gray-500);
    border-bottom: 1px solid var(--color-gray-100); padding-bottom: 0.25rem;
  }
  .hvp-detail-row {
    font-size: var(--font-size-sm); color: var(--color-gray-700);
    padding: 0.125rem 0;
  }
  .hvp-detail-row span { color: var(--color-gray-500); }
  .hvp-narrative {
    font-size: var(--font-size-sm); color: var(--color-gray-700);
    white-space: pre-wrap; background: var(--color-gray-50);
    padding: 0.75rem; border-radius: var(--radius-md);
    margin: 0;
  }

  @media (max-width: 768px) {
    .hvp-header { flex-direction: column; align-items: stretch; }
    .hvp-patient-select select { min-width: unset; width: 100%; }
    .hvp-profile-grid { grid-template-columns: repeat(2, 1fr); }
    .hvp-detail-grid { grid-template-columns: 1fr; }
  }
`;

export default HomeVisitsPage;
