/**
 * PatientChartView.jsx - Read-Only Patient Chart
 *
 * Displays all patient data in a structured, print-friendly format.
 * Used as a slide-over panel from the PatientsPage.
 */

import { formatDate } from '../services/certificationCalculations';

const PatientChartView = ({ patient, onClose, onEdit }) => {
  if (!patient) return null;

  const cti = patient.compliance?.cti;

  // Handle attendingPhysician as object or legacy string
  const ap = typeof patient.attendingPhysician === 'object'
    ? patient.attendingPhysician
    : { name: patient.attendingPhysician || 'N/A' };
  const hp = typeof patient.hospicePhysician === 'object'
    ? patient.hospicePhysician
    : {};

  const Row = ({ label, value, danger }) => (
    <div className="cv-row">
      <span className="cv-label">{label}</span>
      <span className={`cv-value ${danger ? 'cv-danger' : ''}`}>{value || 'N/A'}</span>
    </div>
  );

  const Section = ({ title, children }) => (
    <div className="cv-section">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-section-body">{children}</div>
    </div>
  );


  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cv-header">
          <div>
            <h2>{patient.name}</h2>
            <span className="cv-subtitle">
              MRN: {patient.mrNumber || 'N/A'}
              {patient.dateOfBirth && ` | DOB: ${formatDate(patient.dateOfBirth)}`}
            </span>
          </div>
          <div className="cv-header-actions">
            {onEdit && (
              <button className="cv-btn primary" onClick={() => onEdit(patient)}>Edit</button>
            )}
            <button className="cv-btn close" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Compliance Banner */}
        {cti && (
          <div className={`cv-compliance-bar ${cti.isOverdue ? 'danger' : cti.urgency === 'high' ? 'warning' : ''}`}>
            <span>Period {cti.currentBenefitPeriod} ({cti.periodDuration}d)</span>
            <span>Cert End: {formatDate(cti.certificationEndDate)}</span>
            <span>{cti.isOverdue ? `${Math.abs(cti.daysUntilCertEnd)}d overdue` : `${cti.daysUntilCertEnd}d left`}</span>
            {cti.requiresF2F && <span className={cti.f2fCompleted ? 'cv-f2f-done' : 'cv-f2f-needed'}>F2F: {cti.f2fCompleted ? 'Done' : 'Required'}</span>}
          </div>
        )}

        {/* Body */}
        <div className="cv-body">
          {/* Demographics */}
          <Section title="Demographics">
            <div className="cv-grid">
              <Row label="First Name" value={patient.firstName} />
              <Row label="Last Name" value={patient.lastName} />
              <Row label="Gender" value={patient.gender} />
              <Row label="Date of Birth" value={formatDate(patient.dateOfBirth)} />
              <Row label="Race" value={patient.race} />
              <Row label="Ethnicity" value={patient.ethnicity} />
              <Row label="Marital Status" value={patient.maritalStatus} />
              <Row label="Language" value={patient.primaryLanguage} />
              <Row label="Religion" value={patient.religion} />
            </div>
          </Section>

          {/* Identifiers */}
          <Section title="Identifiers">
            <div className="cv-grid">
              <Row label="MBI" value={patient.mbi} />
              <Row label="Medicaid #" value={patient.medicaidNumber} />
              <Row label="Admission #" value={patient.admissionNumber} />
              <Row label="SSN (last 4)" value={patient.ssn ? `****${patient.ssn}` : 'N/A'} />
            </div>
          </Section>

          {/* Location */}
          <Section title="Location">
            <Row label="Address" value={patient.address} />
            <div className="cv-grid">
              <Row label="Location Type" value={patient.locationType} />
              <Row label="Location Name" value={patient.locationName} />
              <Row label="Institution" value={patient.institutionName} />
            </div>
          </Section>

          {/* Admission */}
          <Section title="Admission">
            <div className="cv-grid">
              <Row label="Admission Date" value={formatDate(patient.admissionDate)} />
              <Row label="Start of Care" value={formatDate(patient.startOfCare)} />
              <Row label="Election Date" value={formatDate(patient.electionDate)} />
              <Row label="Level of Care" value={patient.levelOfCare} />
              <Row label="Starting Period" value={`Period ${patient.startingBenefitPeriod || 1}`} />
              <Row label="Readmission" value={patient.isReadmission ? 'Yes' : 'No'} />
              {patient.isReadmission && <Row label="Prior Hospice Days" value={patient.priorHospiceDays} />}
              <Row label="Disaster Code" value={patient.disasterCode} />
            </div>
          </Section>

          {/* Physicians */}
          <Section title="Physicians">
            <h4 className="cv-sub">Attending Physician</h4>
            <div className="cv-grid">
              <Row label="Name" value={ap.name} />
              <Row label="NPI" value={ap.npi} />
              <Row label="Phone" value={ap.phone} />
              <Row label="Fax" value={ap.fax} />
              <Row label="Email" value={ap.email} />
              <Row label="Address" value={ap.address} />
            </div>
            <h4 className="cv-sub">Hospice Physician</h4>
            <div className="cv-grid">
              <Row label="Name" value={hp.name} />
              <Row label="NPI" value={hp.npi} />
            </div>
          </Section>

          {/* Contacts */}
          <Section title="Contacts & Caregivers">
            {patient.primaryContact?.name && (
              <>
                <h4 className="cv-sub">Primary Contact</h4>
                <div className="cv-grid">
                  <Row label="Name" value={patient.primaryContact.name} />
                  <Row label="Relationship" value={patient.primaryContact.relationship} />
                  <Row label="Phone" value={patient.primaryContact.phone} />
                  <Row label="Address" value={patient.primaryContact.address} />
                </div>
              </>
            )}
            {patient.primaryCaregiver?.name && (
              <>
                <h4 className="cv-sub">Primary Caregiver</h4>
                <div className="cv-grid">
                  <Row label="Name" value={patient.primaryCaregiver.name} />
                  <Row label="Relationship" value={patient.primaryCaregiver.relationship} />
                  <Row label="Mobile" value={patient.primaryCaregiver.mobile} />
                  <Row label="Email" value={patient.primaryCaregiver.email} />
                </div>
              </>
            )}
            {patient.secondaryCaregiver?.name && (
              <>
                <h4 className="cv-sub">Secondary Caregiver</h4>
                <div className="cv-grid">
                  <Row label="Name" value={patient.secondaryCaregiver.name} />
                  <Row label="Relationship" value={patient.secondaryCaregiver.relationship} />
                  <Row label="Mobile" value={patient.secondaryCaregiver.mobile} />
                </div>
              </>
            )}
          </Section>

          {/* Clinical */}
          <Section title="Clinical">
            {/* Diagnoses */}
            <h4 className="cv-sub">Diagnoses</h4>
            {Array.isArray(patient.diagnoses) && patient.diagnoses.length > 0 ? (
              <table className="cv-table">
                <thead><tr><th>Diagnosis</th><th>ICD-10</th><th>Relationship</th></tr></thead>
                <tbody>
                  {patient.diagnoses.map((d, i) => (
                    <tr key={i}><td>{d.name}</td><td>{d.icd10 || '—'}</td><td>{d.relationship}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="cv-empty">No diagnoses recorded</p>}

            {/* Medications */}
            <h4 className="cv-sub">Medications</h4>
            {Array.isArray(patient.medications) && patient.medications.length > 0 ? (
              <table className="cv-table">
                <thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Indication</th></tr></thead>
                <tbody>
                  {patient.medications.map((m, i) => (
                    <tr key={i}><td>{m.name}</td><td>{m.dose}</td><td>{m.route}</td><td>{m.frequency}</td><td>{m.indication}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="cv-empty">No medications recorded</p>}

            {/* Allergies */}
            <h4 className="cv-sub">Allergies</h4>
            {patient.nkda ? (
              <p className="cv-tag-success">NKDA — No Known Drug Allergies</p>
            ) : Array.isArray(patient.allergies) && patient.allergies.length > 0 ? (
              <table className="cv-table">
                <thead><tr><th>Allergen</th><th>Type</th><th>Severity</th></tr></thead>
                <tbody>
                  {patient.allergies.map((a, i) => (
                    <tr key={i}><td>{a.allergen}</td><td>{a.reactionType}</td><td>{a.severity}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="cv-empty">No allergies recorded</p>}
          </Section>

          {/* Advance Directives */}
          <Section title="Advance Directives">
            <div className="cv-grid">
              <Row label="Code Status" value={patient.codeStatus} />
              <Row label="DNR" value={patient.isDnr ? 'Yes' : 'No'} />
              <Row label="DPOA" value={patient.dpoaName} />
              <Row label="Living Will" value={patient.livingWillOnFile ? 'On File' : 'No'} />
              <Row label="POLST" value={patient.polstOnFile ? 'On File' : 'No'} />
            </div>
          </Section>

          {/* Services */}
          <Section title="Services">
            {patient.pharmacy?.name && (
              <>
                <h4 className="cv-sub">Pharmacy</h4>
                <div className="cv-grid">
                  <Row label="Name" value={patient.pharmacy.name} />
                  <Row label="Phone" value={patient.pharmacy.phone} />
                  <Row label="Fax" value={patient.pharmacy.fax} />
                  <Row label="Address" value={patient.pharmacy.address} />
                </div>
              </>
            )}
            {patient.funeralHome?.name && (
              <>
                <h4 className="cv-sub">Funeral Home</h4>
                <div className="cv-grid">
                  <Row label="Name" value={patient.funeralHome.name} />
                  <Row label="Phone" value={patient.funeralHome.phone} />
                </div>
              </>
            )}
            <Row label="Referral Source" value={patient.referral?.source} />
          </Section>

          {/* Compliance / F2F / HUV */}
          <Section title="Compliance">
            <div className="cv-grid">
              <Row label="F2F Completed" value={patient.f2fCompleted ? 'Yes' : 'No'} />
              <Row label="F2F Date" value={formatDate(patient.f2fDate)} />
              <Row label="F2F Physician" value={patient.f2fPhysician} />
              <Row label="HUV1 Completed" value={patient.huv1Completed ? 'Yes' : 'No'} />
              <Row label="HUV1 Date" value={formatDate(patient.huv1Date)} />
              <Row label="HUV2 Completed" value={patient.huv2Completed ? 'Yes' : 'No'} />
              <Row label="HUV2 Date" value={formatDate(patient.huv2Date)} />
            </div>
          </Section>

          {/* Notes */}
          {patient.otherNotes && (
            <Section title="Notes">
              <p className="cv-notes">{patient.otherNotes}</p>
            </Section>
          )}
        </div>
      </div>

      <style>{`
        .cv-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex; justify-content: flex-end;
          z-index: 1000;
        }
        .cv-panel {
          width: 100%; max-width: 700px;
          background: white; height: 100%;
          display: flex; flex-direction: column;
          box-shadow: -4px 0 16px rgba(0,0,0,0.1);
          animation: cv-slide-in 0.2s ease;
        }
        @keyframes cv-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }

        .cv-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          flex-shrink: 0;
        }
        .cv-header h2 { margin: 0; font-size: 1.25rem; }
        .cv-subtitle { font-size: 0.8125rem; color: var(--color-gray-500, #6b7280); }
        .cv-header-actions { display: flex; gap: 0.5rem; align-items: center; }
        .cv-btn {
          padding: 0.5rem 1rem; border-radius: 6px;
          font-size: 0.875rem; cursor: pointer; border: none;
        }
        .cv-btn.primary { background: var(--color-primary, #2563eb); color: white; }
        .cv-btn.close { background: none; font-size: 1.5rem; color: var(--color-gray-400, #9ca3af); padding: 0; line-height: 1; }

        .cv-compliance-bar {
          display: flex; gap: 1rem; flex-wrap: wrap;
          padding: 0.625rem 1.5rem;
          background: var(--color-gray-50, #f9fafb);
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          font-size: 0.8125rem; font-weight: 500;
        }
        .cv-compliance-bar.danger { background: #fef2f2; color: #991b1b; }
        .cv-compliance-bar.warning { background: #fffbeb; color: #92400e; }
        .cv-f2f-done { color: var(--color-success-dark, #065f46); }
        .cv-f2f-needed { color: #dc2626; font-weight: 600; }

        .cv-body {
          flex: 1; overflow-y: auto;
          padding: 1rem 1.5rem;
        }

        .cv-section {
          margin-bottom: 1.25rem;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 8px; overflow: hidden;
        }
        .cv-section-title {
          margin: 0; padding: 0.625rem 1rem;
          font-size: 0.75rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--color-gray-600, #4b5563);
          background: var(--color-gray-50, #f9fafb);
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .cv-section-body { padding: 0.75rem 1rem; }

        .cv-sub {
          margin: 0.75rem 0 0.375rem; font-size: 0.75rem; font-weight: 600;
          color: var(--color-gray-500, #6b7280);
          border-bottom: 1px solid var(--color-gray-100, #f3f4f6);
          padding-bottom: 0.25rem;
        }
        .cv-sub:first-child { margin-top: 0; }

        .cv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 1rem; }
        .cv-row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.8125rem; }
        .cv-label { color: var(--color-gray-500, #6b7280); }
        .cv-value { font-weight: 500; color: var(--color-gray-800, #1f2937); text-align: right; }
        .cv-danger { color: #ef4444; }

        .cv-table {
          width: 100%; border-collapse: collapse;
          font-size: 0.8125rem; margin: 0.25rem 0 0.5rem;
        }
        .cv-table th {
          text-align: left; padding: 0.375rem 0.5rem;
          font-size: 0.7rem; font-weight: 600;
          color: var(--color-gray-500, #6b7280);
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .cv-table td { padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--color-gray-100, #f3f4f6); }

        .cv-empty { color: var(--color-gray-400, #9ca3af); font-size: 0.8125rem; margin: 0.25rem 0; }
        .cv-tag-success {
          display: inline-block; padding: 0.25rem 0.75rem;
          background: var(--color-success-light, #ecfdf5);
          color: var(--color-success-dark, #065f46);
          border-radius: 4px; font-size: 0.8125rem; font-weight: 500;
        }
        .cv-notes {
          font-size: 0.875rem; color: var(--color-gray-700, #374151);
          white-space: pre-wrap; margin: 0;
        }

        @media (max-width: 640px) {
          .cv-panel { max-width: 100%; }
          .cv-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default PatientChartView;
