/**
 * HomeVisitsPage.jsx - Home Visits Assessment Toolkit/Dashboard
 *
 * Wrapper page for the home visits workflow:
 *   - Patient selector
 *   - Quick-access patient profile (demographics, hazards, maps link)
 *   - Previous assessments table
 *   - "Start New Assessment" opens HomeVisitAssessment as a modal
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
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
  Activity,
  Heart,
  Thermometer,
  Wind,
  Check,
  XCircle,
} from 'lucide-react';

const HomeVisitsPage = () => {
  const { user, userProfile } = useAuth();
  const toast = useToast();
  const orgId = userProfile?.organizationId || user?.customClaims?.orgId || 'org_parrish';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [viewingVisit, setViewingVisit] = useState(null);
  const assessmentCloseRef = useRef(null);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Load patients
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { status: 'active' });
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients:', err);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

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
      toast.error('Failed to load visit history');
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

  const handleAssessmentClose = (skipGuard = false) => {
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
              <button className="hvp-modal-close" onClick={() => assessmentCloseRef.current ? assessmentCloseRef.current() : handleAssessmentClose()}>
                <X size={20} />
              </button>
            </div>
            <div className="hvp-modal-body">
              <HomeVisitAssessment
                preSelectedPatientId={selectedPatientId}
                onComplete={handleAssessmentClose}
                onCloseRef={assessmentCloseRef}
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
              <h3>Assessment Detail</h3>
              <button className="hvp-modal-close" onClick={() => setViewingVisit(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="hvp-modal-body">
              {/* A2: Compact Patient Header Bar */}
              <div className="hvp-detail-patient-bar">
                <div className="hvp-detail-patient-info">
                  <span className="hvp-detail-patient-name">{selectedPatient?.name || 'Patient'}</span>
                  {selectedPatient?.mrNumber && <span className="hvp-detail-patient-meta">MR# {selectedPatient.mrNumber}</span>}
                  {selectedPatient?.dateOfBirth && <span className="hvp-detail-patient-meta">DOB: {(() => { const d = selectedPatient.dateOfBirth?.toDate ? selectedPatient.dateOfBirth.toDate() : new Date(selectedPatient.dateOfBirth); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(); })()}</span>}
                </div>
                <div className="hvp-detail-patient-visit">
                  <Calendar size={14} />
                  <span>{viewingVisit.visitDate || 'N/A'}</span>
                  {viewingVisit.visitType && <span className="hvp-detail-type-badge">{viewingVisit.visitType}</span>}
                </div>
              </div>

              <div className="hvp-detail-cards">
                {/* Visit Information Card */}
                <div className="hvp-section-card">
                  <div className="hvp-section-header hvp-section-blue">
                    <ClipboardList size={16} /> Visit Information
                  </div>
                  <div className="hvp-section-body">
                    <div className="hvp-info-grid">
                      <div className="hvp-info-item"><span className="hvp-info-label">Date</span><span className="hvp-info-value">{viewingVisit.visitDate || 'N/A'}</span></div>
                      <div className="hvp-info-item"><span className="hvp-info-label">Time</span><span className="hvp-info-value">{viewingVisit.visitTime || 'N/A'}</span></div>
                      <div className="hvp-info-item"><span className="hvp-info-label">Type</span><span className="hvp-info-value">{viewingVisit.visitType || 'N/A'}</span></div>
                      <div className="hvp-info-item"><span className="hvp-info-label">Provider</span><span className="hvp-info-value">{viewingVisit.clinicianName || 'N/A'}</span></div>
                      <div className="hvp-info-item"><span className="hvp-info-label">Title</span><span className="hvp-info-value">{viewingVisit.clinicianTitle || 'N/A'}</span></div>
                      {viewingVisit.nextVisitDate && <div className="hvp-info-item"><span className="hvp-info-label">Next Visit</span><span className="hvp-info-value">{viewingVisit.nextVisitDate}</span></div>}
                    </div>
                  </div>
                </div>

                {/* A3: Vitals Card with Conditional Highlighting */}
                <div className="hvp-section-card">
                  <div className="hvp-section-header hvp-section-red">
                    <Activity size={16} /> Vitals
                  </div>
                  <div className="hvp-section-body">
                    <div className="hvp-vitals-grid">
                      <div className="hvp-vital-item">
                        <span className="hvp-vital-label">BP</span>
                        <span className="hvp-vital-value">{viewingVisit.bpSystolic && viewingVisit.bpDiastolic ? `${viewingVisit.bpSystolic}/${viewingVisit.bpDiastolic}` : 'N/A'}</span>
                      </div>
                      <div className={`hvp-vital-item${Number(viewingVisit.heartRate) > 100 || Number(viewingVisit.heartRate) < 60 ? ' hvp-vital-warn' : ''}`}>
                        <span className="hvp-vital-label">HR</span>
                        <span className="hvp-vital-value">{viewingVisit.heartRate ? `${viewingVisit.heartRate} bpm` : 'N/A'}</span>
                      </div>
                      <div className={`hvp-vital-item${Number(viewingVisit.respiratoryRate) > 24 ? ' hvp-vital-warn' : ''}`}>
                        <span className="hvp-vital-label">RR</span>
                        <span className="hvp-vital-value">{viewingVisit.respiratoryRate ? `${viewingVisit.respiratoryRate} /min` : 'N/A'}</span>
                      </div>
                      <div className={`hvp-vital-item${Number(viewingVisit.temperature) > 100.4 ? ' hvp-vital-alert' : ''}`}>
                        <span className="hvp-vital-label">Temp</span>
                        <span className="hvp-vital-value">{viewingVisit.temperature ? `${viewingVisit.temperature}°F` : 'N/A'}</span>
                      </div>
                      <div className={`hvp-vital-item${Number(viewingVisit.o2Saturation) < 92 ? ' hvp-vital-alert' : ''}`}>
                        <span className="hvp-vital-label">O2 Sat</span>
                        <span className="hvp-vital-value">{viewingVisit.o2Saturation ? `${viewingVisit.o2Saturation}%` : 'N/A'}</span>
                      </div>
                      <div className={`hvp-vital-item${Number(viewingVisit.painLevel) > 6 ? ' hvp-vital-alert' : ''}`}>
                        <span className="hvp-vital-label">Pain</span>
                        <span className="hvp-vital-value">{viewingVisit.painLevel != null ? `${viewingVisit.painLevel}/10` : 'N/A'}</span>
                      </div>
                      <div className="hvp-vital-item">
                        <span className="hvp-vital-label">Weight</span>
                        <span className="hvp-vital-value">{viewingVisit.weight ? `${viewingVisit.weight} lbs` : 'N/A'}</span>
                      </div>
                      <div className="hvp-vital-item">
                        <span className="hvp-vital-label">PPS</span>
                        <span className="hvp-vital-value">{viewingVisit.performanceScore ? `${viewingVisit.performanceScore}%` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* A4: Functional Status Card */}
                <div className="hvp-section-card">
                  <div className="hvp-section-header hvp-section-green">
                    <User size={16} /> Functional Status
                  </div>
                  <div className="hvp-section-body">
                    <div className="hvp-func-group">
                      <span className="hvp-func-group-label">ADL Assessment</span>
                      <div className="hvp-chip-row">
                        {[
                          { key: 'adlBathing', label: 'Bathing' },
                          { key: 'adlDressing', label: 'Dressing' },
                          { key: 'adlToileting', label: 'Toileting' },
                          { key: 'adlTransferring', label: 'Transfers' },
                          { key: 'adlFeeding', label: 'Feeding' },
                        ].map(adl => {
                          const val = viewingVisit[adl.key];
                          const chipClass = !val ? 'hvp-chip-neutral' :
                            val === 'Independent' ? 'hvp-chip-green' :
                            val === 'Total Dependence' ? 'hvp-chip-red' : 'hvp-chip-yellow';
                          return (
                            <span key={adl.key} className={`hvp-chip ${chipClass}`} title={val || 'Not recorded'}>
                              {adl.label}: {val || 'N/A'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="hvp-func-badges">
                      <div className="hvp-func-badge">
                        <span className="hvp-func-badge-label">Mobility</span>
                        <span className={`hvp-func-badge-value${viewingVisit.mobilityStatus === 'Bedbound' ? ' hvp-badge-red' : viewingVisit.mobilityStatus === 'Wheelchair' ? ' hvp-badge-yellow' : ''}`}>
                          {viewingVisit.mobilityStatus || 'N/A'}
                        </span>
                      </div>
                      <div className="hvp-func-badge">
                        <span className="hvp-func-badge-label">Fall Risk</span>
                        <span className={`hvp-func-badge-value${viewingVisit.fallRisk === 'High' ? ' hvp-badge-red' : viewingVisit.fallRisk === 'Moderate' ? ' hvp-badge-yellow' : ''}`}>
                          {viewingVisit.fallRisk || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* A5: Symptom Management Card */}
                <div className="hvp-section-card">
                  <div className="hvp-section-header hvp-section-amber">
                    <Thermometer size={16} /> Symptom Management
                  </div>
                  <div className="hvp-section-body">
                    <div className="hvp-chip-row">
                      {[
                        { key: 'painManaged', label: 'Pain Managed', invert: true },
                        { key: 'nauseaPresent', label: 'Nausea' },
                        { key: 'dyspneaPresent', label: 'Dyspnea' },
                        { key: 'anxietyPresent', label: 'Anxiety' },
                        { key: 'fatiguePresent', label: 'Fatigue' },
                        { key: 'constipationPresent', label: 'Constipation' },
                        { key: 'edemaPresent', label: 'Edema' },
                        { key: 'skinIssues', label: 'Skin Issues' },
                      ].map(sym => {
                        const present = sym.invert ? viewingVisit[sym.key] === false : viewingVisit[sym.key] === true;
                        return (
                          <span key={sym.key} className={`hvp-symptom-chip ${present ? 'hvp-symptom-active' : 'hvp-symptom-inactive'}`}>
                            {present ? '●' : '○'} {sym.label}
                          </span>
                        );
                      })}
                    </div>
                    {viewingVisit.symptomNotes && (
                      <div className="hvp-symptom-notes">{viewingVisit.symptomNotes}</div>
                    )}
                  </div>
                </div>

                {/* A6: Care Plan Card */}
                <div className="hvp-section-card">
                  <div className="hvp-section-header hvp-section-purple">
                    <Heart size={16} /> Care Plan
                  </div>
                  <div className="hvp-section-body">
                    <div className="hvp-care-checks">
                      <span className={`hvp-care-check ${viewingVisit.goalsReviewed ? 'hvp-check-yes' : 'hvp-check-no'}`}>
                        {viewingVisit.goalsReviewed ? <Check size={14} /> : <XCircle size={14} />}
                        Goals Reviewed
                      </span>
                      <span className={`hvp-care-check ${viewingVisit.medicationsReviewed ? 'hvp-check-yes' : 'hvp-check-no'}`}>
                        {viewingVisit.medicationsReviewed ? <Check size={14} /> : <XCircle size={14} />}
                        Meds Reviewed
                      </span>
                    </div>
                    {viewingVisit.educationProvided && (
                      <div className="hvp-care-block"><span className="hvp-care-block-label">Education Provided</span><p>{viewingVisit.educationProvided}</p></div>
                    )}
                    {viewingVisit.interventions && (
                      <div className="hvp-care-block"><span className="hvp-care-block-label">Interventions</span><p>{viewingVisit.interventions}</p></div>
                    )}
                    {viewingVisit.planChanges && (
                      <div className="hvp-care-block"><span className="hvp-care-block-label">Plan Changes</span><p>{viewingVisit.planChanges}</p></div>
                    )}
                  </div>
                </div>

                {/* A7: Narrative Notes Card */}
                {viewingVisit.narrativeNotes && (
                  <div className="hvp-section-card">
                    <div className="hvp-section-header hvp-section-blue">
                      <ClipboardList size={16} /> Clinical Narrative
                    </div>
                    <div className="hvp-section-body">
                      <blockquote className="hvp-narrative-block">{viewingVisit.narrativeNotes}</blockquote>
                    </div>
                  </div>
                )}
              </div>
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
    overflow-y: scroll; flex: 1; min-height: 0;
    padding: 0;
  }

  /* Detail view — Patient Header Bar (A2) */
  .hvp-detail-patient-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.875rem 1.5rem;
    background: var(--color-gray-50);
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap; gap: 0.5rem;
  }
  .hvp-detail-patient-info { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .hvp-detail-patient-name { font-weight: 600; font-size: 1rem; color: var(--color-gray-900); }
  .hvp-detail-patient-meta {
    font-size: var(--font-size-xs); color: var(--color-gray-500);
    padding: 0.125rem 0.5rem; background: var(--color-gray-100);
    border-radius: var(--radius-sm);
  }
  .hvp-detail-patient-visit {
    display: flex; align-items: center; gap: 0.375rem;
    font-size: var(--font-size-sm); color: var(--color-gray-600);
  }
  .hvp-detail-type-badge {
    padding: 0.125rem 0.625rem; font-size: var(--font-size-xs); font-weight: 500;
    background: var(--scorecard-blue-bg, #eff6ff); color: var(--scorecard-blue-text, #2563eb);
    border-radius: var(--radius-full, 9999px);
  }

  /* Detail view — Card Layout (A1) */
  .hvp-detail-cards { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .hvp-section-card {
    border: 1px solid var(--border-color); border-radius: var(--radius-lg);
    overflow: hidden; background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .hvp-section-header {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 1rem; font-size: var(--font-size-sm); font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .hvp-section-blue { background: var(--scorecard-blue-bg, #eff6ff); color: var(--scorecard-blue-text, #2563eb); }
  .hvp-section-red { background: var(--scorecard-red-bg, #fef2f2); color: var(--scorecard-red-text, #ef4444); }
  .hvp-section-green { background: var(--scorecard-green-bg, #ecfdf5); color: var(--scorecard-green-text, #10b981); }
  .hvp-section-amber { background: var(--scorecard-amber-bg, #fffbeb); color: var(--scorecard-amber-text, #f59e0b); }
  .hvp-section-purple { background: var(--scorecard-purple-bg, #f5f3ff); color: var(--scorecard-purple-text, #7c3aed); }
  .hvp-section-body { padding: 1rem; }

  /* Visit Info Grid */
  .hvp-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .hvp-info-item { display: flex; flex-direction: column; gap: 0.125rem; }
  .hvp-info-label { font-size: var(--font-size-xs); color: var(--color-gray-500); text-transform: uppercase; letter-spacing: 0.05em; }
  .hvp-info-value { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-gray-800); }

  /* Vitals Grid with Indicators (A3) */
  .hvp-vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
  .hvp-vital-item {
    display: flex; flex-direction: column; align-items: center;
    padding: 0.625rem 0.5rem; border-radius: var(--radius-md);
    background: var(--color-gray-50); border: 1px solid var(--color-gray-100);
    text-align: center; transition: var(--transition-normal);
  }
  .hvp-vital-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-gray-500); margin-bottom: 0.125rem; }
  .hvp-vital-value { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-800); }
  .hvp-vital-warn { background: #fffbeb; border-color: #fde68a; }
  .hvp-vital-warn .hvp-vital-value { color: #92400e; }
  .hvp-vital-alert { background: #fef2f2; border-color: #fecaca; }
  .hvp-vital-alert .hvp-vital-value { color: #991b1b; }

  /* Functional Status Chips (A4) */
  .hvp-func-group { margin-bottom: 0.75rem; }
  .hvp-func-group-label { font-size: var(--font-size-xs); color: var(--color-gray-500); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.375rem; }
  .hvp-chip-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .hvp-chip {
    display: inline-block; padding: 0.25rem 0.625rem; border-radius: var(--radius-full, 9999px);
    font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap;
  }
  .hvp-chip-green { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .hvp-chip-yellow { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .hvp-chip-red { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .hvp-chip-neutral { background: var(--color-gray-100); color: var(--color-gray-500); border: 1px solid var(--color-gray-200); }
  .hvp-func-badges { display: flex; gap: 1rem; }
  .hvp-func-badge { display: flex; flex-direction: column; gap: 0.125rem; }
  .hvp-func-badge-label { font-size: var(--font-size-xs); color: var(--color-gray-500); text-transform: uppercase; letter-spacing: 0.05em; }
  .hvp-func-badge-value {
    display: inline-block; padding: 0.25rem 0.625rem; border-radius: var(--radius-md);
    font-size: var(--font-size-sm); font-weight: 500;
    background: var(--color-gray-100); color: var(--color-gray-700);
  }
  .hvp-badge-yellow { background: #fffbeb; color: #92400e; }
  .hvp-badge-red { background: #fef2f2; color: #991b1b; }

  /* Symptom Chips (A5) */
  .hvp-symptom-chip {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.25rem 0.625rem; border-radius: var(--radius-full, 9999px);
    font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap;
  }
  .hvp-symptom-active { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .hvp-symptom-inactive { background: var(--color-gray-50); color: var(--color-gray-400); border: 1px solid var(--color-gray-200); }
  .hvp-symptom-notes {
    margin-top: 0.75rem; font-size: var(--font-size-sm); color: var(--color-gray-700);
    background: var(--color-gray-50); padding: 0.625rem 0.875rem;
    border-radius: var(--radius-md); white-space: pre-wrap;
  }

  /* Care Plan (A6) */
  .hvp-care-checks { display: flex; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .hvp-care-check {
    display: inline-flex; align-items: center; gap: 0.375rem;
    padding: 0.375rem 0.75rem; border-radius: var(--radius-md);
    font-size: var(--font-size-sm); font-weight: 500;
  }
  .hvp-check-yes { background: #ecfdf5; color: #065f46; }
  .hvp-check-no { background: var(--color-gray-100); color: var(--color-gray-500); }
  .hvp-care-block { margin-top: 0.625rem; }
  .hvp-care-block-label {
    font-size: var(--font-size-xs); color: var(--color-gray-500);
    text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.25rem;
  }
  .hvp-care-block p {
    margin: 0; font-size: var(--font-size-sm); color: var(--color-gray-700);
    background: var(--color-gray-50); padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md); white-space: pre-wrap;
  }

  /* Narrative Blockquote (A7) */
  .hvp-narrative-block {
    margin: 0; padding: 0.875rem 1rem; font-size: var(--font-size-sm);
    color: var(--color-gray-700); white-space: pre-wrap;
    background: var(--color-gray-50); border-left: 3px solid var(--color-primary);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    font-style: normal;
  }

  /* Responsive (A8) */
  @media (max-width: 768px) {
    .hvp-header { flex-direction: column; align-items: stretch; }
    .hvp-patient-select select { min-width: unset; width: 100%; }
    .hvp-profile-grid { grid-template-columns: repeat(2, 1fr); }
    .hvp-detail-patient-bar { flex-direction: column; align-items: flex-start; }
    .hvp-info-grid { grid-template-columns: repeat(2, 1fr); }
    .hvp-vitals-grid { grid-template-columns: repeat(2, 1fr); }
    .hvp-func-badges { flex-direction: column; }
    .hvp-chip-row { gap: 0.25rem; }
    .hvp-care-checks { flex-direction: column; gap: 0.5rem; }
  }
`;

export default HomeVisitsPage;
