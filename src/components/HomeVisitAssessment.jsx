/**
 * HomeVisitAssessment.jsx - Home Visit Clinical Assessment Form
 *
 * Multi-section assessment form for documenting home visits:
 *   1. Visit Info — date, time, visit type, clinician
 *   2. Vitals — BP, HR, RR, Temp, O2 Sat, Pain, Weight
 *   3. Functional Status — ADLs, mobility, Karnofsky/PPS
 *   4. Symptom Management — pain, nausea, dyspnea, anxiety, etc.
 *   5. Care Plan — goals, interventions, education provided
 *   6. Clinician Notes — narrative assessment
 *
 * On submit:
 *   - Saves visit record to organizations/{orgId}/patients/{patientId}/visits
 *   - Optionally generates PDF via generateDocument Cloud Function
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients } from '../services/patientService';
import { generateDocument } from '../services/documentService';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const EMPTY_ASSESSMENT = {
  // Visit Info
  visitDate: new Date().toISOString().split('T')[0],
  visitTime: '',
  visitType: 'Routine',
  clinicianName: '',
  clinicianTitle: '',

  // Vitals
  bpSystolic: '',
  bpDiastolic: '',
  heartRate: '',
  respiratoryRate: '',
  temperature: '',
  o2Saturation: '',
  painLevel: '',
  weight: '',

  // Functional Status
  adlBathing: 'Independent',
  adlDressing: 'Independent',
  adlToileting: 'Independent',
  adlTransferring: 'Independent',
  adlFeeding: 'Independent',
  mobilityStatus: 'Ambulatory',
  fallRisk: 'Low',
  performanceScore: '',

  // Symptom Management
  painManaged: true,
  nauseaPresent: false,
  dyspneaPresent: false,
  anxietyPresent: false,
  fatiguePresent: false,
  constipationPresent: false,
  edemaPresent: false,
  skinIssues: false,
  symptomNotes: '',

  // Care Plan
  goalsReviewed: false,
  medicationsReviewed: false,
  educationProvided: '',
  interventions: '',
  planChanges: '',
  nextVisitDate: '',

  // Clinician Notes
  narrativeNotes: '',
};

const ADL_OPTIONS = ['Independent', 'Supervision', 'Limited Assist', 'Extensive Assist', 'Total Dependence'];
const MOBILITY_OPTIONS = ['Ambulatory', 'Ambulatory with Device', 'Wheelchair', 'Bedbound'];
const VISIT_TYPES = ['Routine', 'PRN', 'Admission', 'Recertification', 'Discharge', 'Follow-Up'];

const HomeVisitAssessment = () => {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.organizationId || user?.customClaims?.orgId || 'org_parrish';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [assessment, setAssessment] = useState({ ...EMPTY_ASSESSMENT });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeSection, setActiveSection] = useState('visit');

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Load patients
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { status: 'active' });
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients:', err);
      setMessage({ type: 'error', text: 'Failed to load patients.' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Pre-fill clinician name from user profile
  useEffect(() => {
    if (userProfile?.displayName || userProfile?.email) {
      setAssessment(prev => ({
        ...prev,
        clinicianName: userProfile.displayName || userProfile.email || '',
      }));
    }
  }, [userProfile]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAssessment(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setAssessment({ ...EMPTY_ASSESSMENT, clinicianName: userProfile?.displayName || '' });
    setSelectedPatientId('');
    setMessage(null);
  };

  // ── Save Assessment ───────────────────────────────────────────
  const handleSave = async (andGenerate = false) => {
    if (!selectedPatientId) {
      setMessage({ type: 'error', text: 'Please select a patient.' });
      return;
    }
    if (!assessment.visitDate) {
      setMessage({ type: 'error', text: 'Visit date is required.' });
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: 'info', text: 'Saving assessment...' });

      // Save to Firestore
      const visitRef = collection(
        db, 'organizations', orgId, 'patients', selectedPatientId, 'visits'
      );
      const visitDoc = await addDoc(visitRef, {
        ...assessment,
        patientId: selectedPatientId,
        patientName: selectedPatient?.name || '',
        assessmentType: 'HOME_VISIT',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setMessage({ type: 'success', text: `Assessment saved (ID: ${visitDoc.id})` });

      // Optionally generate PDF
      if (andGenerate) {
        await handleGenerate(visitDoc.id);
      }
    } catch (err) {
      console.error('Error saving assessment:', err);
      setMessage({ type: 'error', text: `Failed to save: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ── Generate PDF ──────────────────────────────────────────────
  const handleGenerate = async (visitId) => {
    try {
      setGenerating(true);
      setMessage({ type: 'info', text: 'Generating PDF...' });

      const result = await generateDocument(
        selectedPatientId,
        'HOME_VISIT_ASSESSMENT',
        {
          ...assessment,
          visitId,
          bloodPressure: assessment.bpSystolic && assessment.bpDiastolic
            ? `${assessment.bpSystolic}/${assessment.bpDiastolic}`
            : 'N/A',
        }
      );

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Assessment saved and PDF generated!',
          downloadUrl: result.downloadUrl,
        });
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Assessment was already saved; just warn about PDF failure
      setMessage({
        type: 'warning',
        text: `Assessment saved, but PDF generation failed: ${err.message}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  // ── Section config ────────────────────────────────────────────
  const SECTIONS = [
    { id: 'visit', label: 'Visit Info' },
    { id: 'vitals', label: 'Vitals' },
    { id: 'functional', label: 'Functional' },
    { id: 'symptoms', label: 'Symptoms' },
    { id: 'careplan', label: 'Care Plan' },
    { id: 'notes', label: 'Notes' },
  ];

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="hva-loading">
        <div className="hva-spinner" />
        <p>Loading...</p>
        <style>{hvaStyles}</style>
      </div>
    );
  }

  return (
    <div className="hva-page">
      {/* Header */}
      <div className="hva-header">
        <h2>Home Visit Assessment</h2>
        <p>Document clinical findings from a home visit</p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`hva-banner ${message.type}`}>
          <span>{message.text}</span>
          {message.downloadUrl && (
            <a href={message.downloadUrl} target="_blank" rel="noopener noreferrer" className="hva-download-link">
              Download PDF
            </a>
          )}
          <button className="hva-banner-close" onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Patient Selection */}
      <div className="hva-card">
        <div className="hva-card-header">
          <h3>Patient</h3>
        </div>
        <div className="hva-card-body">
          <select
            className="hva-select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={saving || generating}
          >
            <option value="">Select a patient...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.mrNumber ? `(MR# ${p.mrNumber})` : ''}
              </option>
            ))}
          </select>

          {selectedPatient && (
            <div className="hva-patient-info">
              <span><strong>DOB:</strong> {selectedPatient.dateOfBirth ? new Date(selectedPatient.dateOfBirth).toLocaleDateString() : 'N/A'}</span>
              <span><strong>MRN:</strong> {selectedPatient.mrNumber || 'N/A'}</span>
              <span><strong>Period:</strong> {selectedPatient.compliance?.cti?.periodShortName || 'N/A'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section Navigation */}
      {selectedPatient && (
        <>
          <div className="hva-sections-nav">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`hva-section-btn ${activeSection === s.id ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="hva-card">
            <div className="hva-card-body">

              {/* ── Visit Info ──────────────────────────────── */}
              {activeSection === 'visit' && (
                <div className="hva-form">
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Visit Date *</label>
                      <input type="date" name="visitDate" value={assessment.visitDate} onChange={handleChange} required />
                    </div>
                    <div className="hva-field">
                      <label>Visit Time</label>
                      <input type="time" name="visitTime" value={assessment.visitTime} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Visit Type</label>
                      <select name="visitType" value={assessment.visitType} onChange={handleChange}>
                        {VISIT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="hva-field">
                      <label>Clinician Name</label>
                      <input type="text" name="clinicianName" value={assessment.clinicianName} onChange={handleChange} placeholder="Your name" />
                    </div>
                  </div>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Title / Credentials</label>
                      <input type="text" name="clinicianTitle" value={assessment.clinicianTitle} onChange={handleChange} placeholder="e.g. RN, BSN" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Vitals ─────────────────────────────────── */}
              {activeSection === 'vitals' && (
                <div className="hva-form">
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>BP Systolic</label>
                      <input type="number" name="bpSystolic" value={assessment.bpSystolic} onChange={handleChange} placeholder="mmHg" />
                    </div>
                    <div className="hva-field">
                      <label>BP Diastolic</label>
                      <input type="number" name="bpDiastolic" value={assessment.bpDiastolic} onChange={handleChange} placeholder="mmHg" />
                    </div>
                  </div>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Heart Rate</label>
                      <input type="number" name="heartRate" value={assessment.heartRate} onChange={handleChange} placeholder="bpm" />
                    </div>
                    <div className="hva-field">
                      <label>Respiratory Rate</label>
                      <input type="number" name="respiratoryRate" value={assessment.respiratoryRate} onChange={handleChange} placeholder="breaths/min" />
                    </div>
                  </div>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Temperature</label>
                      <input type="number" name="temperature" value={assessment.temperature} onChange={handleChange} placeholder="F" step="0.1" />
                    </div>
                    <div className="hva-field">
                      <label>O2 Saturation</label>
                      <input type="number" name="o2Saturation" value={assessment.o2Saturation} onChange={handleChange} placeholder="%" />
                    </div>
                  </div>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Pain Level (0-10)</label>
                      <input type="number" name="painLevel" value={assessment.painLevel} onChange={handleChange} min="0" max="10" placeholder="0-10" />
                    </div>
                    <div className="hva-field">
                      <label>Weight (lbs)</label>
                      <input type="number" name="weight" value={assessment.weight} onChange={handleChange} placeholder="lbs" step="0.1" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Functional Status ──────────────────────── */}
              {activeSection === 'functional' && (
                <div className="hva-form">
                  <h4 className="hva-sub-title">ADL Assessment</h4>
                  {['Bathing', 'Dressing', 'Toileting', 'Transferring', 'Feeding'].map(adl => (
                    <div className="hva-row" key={adl}>
                      <div className="hva-field">
                        <label>{adl}</label>
                        <select name={`adl${adl}`} value={assessment[`adl${adl}`]} onChange={handleChange}>
                          {ADL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}

                  <h4 className="hva-sub-title">Mobility & Performance</h4>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>Mobility Status</label>
                      <select name="mobilityStatus" value={assessment.mobilityStatus} onChange={handleChange}>
                        {MOBILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="hva-field">
                      <label>Fall Risk</label>
                      <select name="fallRisk" value={assessment.fallRisk} onChange={handleChange}>
                        <option value="Low">Low</option>
                        <option value="Moderate">Moderate</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="hva-row">
                    <div className="hva-field">
                      <label>PPS / Karnofsky Score</label>
                      <input type="number" name="performanceScore" value={assessment.performanceScore} onChange={handleChange} placeholder="0-100" min="0" max="100" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Symptom Management ─────────────────────── */}
              {activeSection === 'symptoms' && (
                <div className="hva-form">
                  <h4 className="hva-sub-title">Symptom Checklist</h4>
                  <div className="hva-check-grid">
                    {[
                      { name: 'painManaged', label: 'Pain Managed' },
                      { name: 'nauseaPresent', label: 'Nausea Present' },
                      { name: 'dyspneaPresent', label: 'Dyspnea Present' },
                      { name: 'anxietyPresent', label: 'Anxiety Present' },
                      { name: 'fatiguePresent', label: 'Fatigue Present' },
                      { name: 'constipationPresent', label: 'Constipation Present' },
                      { name: 'edemaPresent', label: 'Edema Present' },
                      { name: 'skinIssues', label: 'Skin Issues' },
                    ].map(s => (
                      <label key={s.name} className="hva-check-label">
                        <input type="checkbox" name={s.name} checked={!!assessment[s.name]} onChange={handleChange} />
                        {s.label}
                      </label>
                    ))}
                  </div>
                  <div className="hva-field" style={{ marginTop: '1rem' }}>
                    <label>Symptom Notes</label>
                    <textarea name="symptomNotes" value={assessment.symptomNotes} onChange={handleChange} rows={3} placeholder="Additional symptom details..." />
                  </div>
                </div>
              )}

              {/* ── Care Plan ──────────────────────────────── */}
              {activeSection === 'careplan' && (
                <div className="hva-form">
                  <div className="hva-check-grid">
                    <label className="hva-check-label">
                      <input type="checkbox" name="goalsReviewed" checked={assessment.goalsReviewed} onChange={handleChange} />
                      Goals of Care Reviewed with Patient/Family
                    </label>
                    <label className="hva-check-label">
                      <input type="checkbox" name="medicationsReviewed" checked={assessment.medicationsReviewed} onChange={handleChange} />
                      Medication Reconciliation Performed
                    </label>
                  </div>
                  <div className="hva-field" style={{ marginTop: '1rem' }}>
                    <label>Education Provided</label>
                    <textarea name="educationProvided" value={assessment.educationProvided} onChange={handleChange} rows={2} placeholder="Topics discussed with patient/family..." />
                  </div>
                  <div className="hva-field">
                    <label>Interventions</label>
                    <textarea name="interventions" value={assessment.interventions} onChange={handleChange} rows={2} placeholder="Clinical interventions performed..." />
                  </div>
                  <div className="hva-field">
                    <label>Plan of Care Changes</label>
                    <textarea name="planChanges" value={assessment.planChanges} onChange={handleChange} rows={2} placeholder="Any changes to the plan of care..." />
                  </div>
                  <div className="hva-field">
                    <label>Next Visit Date</label>
                    <input type="date" name="nextVisitDate" value={assessment.nextVisitDate} onChange={handleChange} />
                  </div>
                </div>
              )}

              {/* ── Clinician Notes ─────────────────────────── */}
              {activeSection === 'notes' && (
                <div className="hva-form">
                  <div className="hva-field">
                    <label>Narrative Assessment</label>
                    <textarea
                      name="narrativeNotes"
                      value={assessment.narrativeNotes}
                      onChange={handleChange}
                      rows={8}
                      placeholder="Detailed visit narrative, clinical observations, patient/family response, overall assessment..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="hva-actions">
            <button type="button" className="hva-btn secondary" onClick={resetForm} disabled={saving || generating}>
              Reset
            </button>
            <div className="hva-actions-right">
              <button type="button" className="hva-btn primary" onClick={() => handleSave(false)} disabled={saving || generating}>
                {saving ? 'Saving...' : 'Save Assessment'}
              </button>
              <button type="button" className="hva-btn primary-outline" onClick={() => handleSave(true)} disabled={saving || generating}>
                {generating ? 'Generating...' : 'Save & Generate PDF'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{hvaStyles}</style>
    </div>
  );
};

const hvaStyles = `
  .hva-page { max-width: 900px; margin: 0 auto; }
  .hva-loading {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 300px; color: var(--color-gray-500);
  }
  .hva-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--color-gray-200);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: hva-spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }
  @keyframes hva-spin { to { transform: rotate(360deg); } }

  .hva-header { margin-bottom: 1.5rem; }
  .hva-header h2 { margin: 0; font-size: 1.5rem; color: var(--color-gray-800); }
  .hva-header p { margin: 0.25rem 0 0; color: var(--color-gray-500); font-size: var(--font-size-sm); }

  /* Banner */
  .hva-banner {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 1rem; border-radius: var(--radius-lg);
    font-size: var(--font-size-sm); margin-bottom: 1rem;
  }
  .hva-banner.info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
  .hva-banner.success { background: var(--color-success-light); border: 1px solid #a7f3d0; color: var(--color-success-dark); }
  .hva-banner.warning { background: var(--color-warning-light); border: 1px solid #fde68a; color: var(--color-warning-dark); }
  .hva-banner.error { background: var(--color-error-light); border: 1px solid #fecaca; color: var(--color-error-dark); }
  .hva-banner-close { background: none; border: none; font-size: 1.25rem; cursor: pointer; margin-left: auto; line-height: 1; color: inherit; }
  .hva-download-link { font-weight: 600; text-decoration: underline; color: inherit; }

  /* Card */
  .hva-card { background: white; border: 1px solid var(--border-color); border-radius: var(--radius-xl); margin-bottom: 1rem; overflow: hidden; }
  .hva-card-header { padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border-color); background: var(--color-gray-50); }
  .hva-card-header h3 { margin: 0; font-size: var(--font-size-base); }
  .hva-card-body { padding: 1.25rem; }

  /* Select */
  .hva-select {
    width: 100%; padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }
  .hva-select:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

  .hva-patient-info {
    display: flex; gap: 1.5rem; margin-top: 0.75rem;
    font-size: var(--font-size-sm); color: var(--color-gray-600);
  }

  /* Section nav */
  .hva-sections-nav {
    display: flex; gap: 0.25rem;
    background: var(--color-gray-100); padding: 0.25rem;
    border-radius: var(--radius-lg); margin-bottom: 1rem;
    overflow-x: auto;
  }
  .hva-section-btn {
    padding: 0.5rem 0.875rem; border: none;
    background: transparent; border-radius: var(--radius-md);
    font-size: 0.8125rem; font-weight: 500;
    color: var(--color-gray-500); cursor: pointer;
    white-space: nowrap; transition: all 0.15s;
  }
  .hva-section-btn:hover { color: var(--color-gray-800); }
  .hva-section-btn.active { background: white; color: var(--color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

  /* Form */
  .hva-form { display: flex; flex-direction: column; gap: 0.75rem; }
  .hva-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .hva-field { display: flex; flex-direction: column; }
  .hva-field label { font-size: 0.875rem; font-weight: 500; margin-bottom: 0.375rem; color: var(--color-gray-700); }
  .hva-field input, .hva-field select, .hva-field textarea {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: 0.875rem; font-family: inherit;
  }
  .hva-field input:focus, .hva-field select:focus, .hva-field textarea:focus {
    outline: none; border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }

  .hva-sub-title {
    margin: 0.5rem 0 0.25rem; font-size: 0.8rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-gray-500);
    border-bottom: 1px solid var(--color-gray-100); padding-bottom: 0.25rem;
  }

  /* Checkbox grid */
  .hva-check-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .hva-check-label {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.875rem; color: var(--color-gray-700);
    cursor: pointer;
  }

  /* Actions */
  .hva-actions {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 0; margin-top: 0.5rem;
  }
  .hva-actions-right { display: flex; gap: 0.75rem; }

  .hva-btn {
    padding: 0.625rem 1.25rem; border-radius: var(--radius-md);
    font-size: var(--font-size-sm); font-weight: 500;
    cursor: pointer; border: none; transition: all 0.15s;
  }
  .hva-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .hva-btn.primary { background: var(--color-primary); color: white; }
  .hva-btn.primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .hva-btn.primary-outline { background: white; color: var(--color-primary); border: 1px solid var(--color-primary); }
  .hva-btn.primary-outline:hover:not(:disabled) { background: #eff6ff; }
  .hva-btn.secondary { background: var(--color-gray-100); color: var(--color-gray-700); border: 1px solid var(--border-color); }
  .hva-btn.secondary:hover:not(:disabled) { background: var(--color-gray-200); }

  @media (max-width: 640px) {
    .hva-row { grid-template-columns: 1fr; }
    .hva-check-grid { grid-template-columns: 1fr; }
    .hva-actions { flex-direction: column; gap: 0.75rem; }
    .hva-actions-right { width: 100%; }
    .hva-btn { width: 100%; text-align: center; }
  }
`;

export default HomeVisitAssessment;
