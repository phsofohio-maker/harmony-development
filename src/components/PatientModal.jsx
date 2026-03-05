/**
 * PatientModal.jsx - Add/Edit Patient Modal (v1.2.0)
 *
 * 7-tab structure:
 *   1. Demographics — name, identifiers, location
 *   2. Admission — dates, benefit period, level of care
 *   3. Physicians & Contacts — attending, hospice, contacts, caregivers
 *   4. Clinical — diagnoses, medications, allergies (sub-components)
 *   5. Directives — advance directives
 *   6. Services — pharmacy, funeral home, referral
 *   7. Compliance — F2F, HUV tracking, notes
 */

import { useState, useEffect } from 'react';
import { formatDate } from '../services/certificationCalculations';
import DiagnosisManager from './DiagnosisManager';
import MedicationManager from './MedicationManager';
import AllergyManager from './AllergyManager';

const TABS = [
  { id: 'demographics', label: 'Demographics' },
  { id: 'admission',    label: 'Admission' },
  { id: 'physicians',   label: 'Physicians' },
  { id: 'clinical',     label: 'Clinical' },
  { id: 'directives',   label: 'Directives' },
  { id: 'services',     label: 'Services' },
  { id: 'compliance',   label: 'Compliance' },
];

const EMPTY_FORM = {
  // Demographics
  name: '', firstName: '', lastName: '',
  mrNumber: '', dateOfBirth: '',
  gender: '', race: '', ethnicity: '',
  maritalStatus: '', primaryLanguage: '', religion: '',
  // Identifiers
  mbi: '', medicaidNumber: '', admissionNumber: '', ssn: '',
  // Location
  address: '', locationName: '', locationType: '', institutionName: '', knownHazards: '',
  // Admission
  admissionDate: '', startOfCare: '', electionDate: '',
  levelOfCare: '', disasterCode: '',
  startingBenefitPeriod: 1, isReadmission: false, priorHospiceDays: '',
  // Physicians
  attendingPhysician: { name: '', npi: '', address: '', phone: '', fax: '', email: '' },
  hospicePhysician: { name: '', npi: '' },
  // F2F provider
  f2fPhysician: '', f2fProviderRole: '', f2fProviderNpi: '',
  // Contacts
  primaryContact: { name: '', relationship: '', phone: '', address: '' },
  primaryCaregiver: { name: '', relationship: '', address: '', mobile: '', email: '' },
  secondaryCaregiver: { name: '', relationship: '', address: '', mobile: '' },
  // Clinical
  diagnoses: [], medications: [], allergies: [],
  nkda: false, nfka: false,
  // Directives
  isDnr: false, codeStatus: '', dpoaName: '',
  livingWillOnFile: false, polstOnFile: false,
  // Services
  pharmacy: { name: '', address: '', phone: '', fax: '' },
  funeralHome: { name: '', address: '', phone: '' },
  referral: { source: '' },
  // Compliance
  f2fCompleted: false, f2fDate: '',
  huv1Completed: false, huv1Date: '',
  huv2Completed: false, huv2Date: '',
  // Notes
  otherNotes: '',
};

const PatientModal = ({ patient, onSave, onDelete, onClose, saving }) => {
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('demographics');

  const isEditing = !!patient?.id;
  const showF2FSection = formData.startingBenefitPeriod >= 3 || formData.isReadmission;

  // ── Date helpers ──────────────────────────────────────────────
  const fmtDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  // ── Populate form when editing ────────────────────────────────
  useEffect(() => {
    if (!patient) return;
    // Handle backward compat: attendingPhysician may be a string
    const ap = typeof patient.attendingPhysician === 'string'
      ? { name: patient.attendingPhysician, npi: '', address: '', phone: '', fax: '', email: '' }
      : patient.attendingPhysician || EMPTY_FORM.attendingPhysician;

    setFormData({
      // Demographics
      name: patient.name || '',
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      mrNumber: patient.mrNumber || '',
      dateOfBirth: fmtDate(patient.dateOfBirth),
      gender: patient.gender || '',
      race: patient.race || '',
      ethnicity: patient.ethnicity || '',
      maritalStatus: patient.maritalStatus || '',
      primaryLanguage: patient.primaryLanguage || '',
      religion: patient.religion || '',
      // Identifiers
      mbi: patient.mbi || '',
      medicaidNumber: patient.medicaidNumber || '',
      admissionNumber: patient.admissionNumber || '',
      ssn: patient.ssn || '',
      // Location
      address: patient.address || '',
      locationName: patient.locationName || '',
      locationType: patient.locationType || '',
      institutionName: patient.institutionName || '',
      knownHazards: patient.knownHazards || '',
      // Admission
      admissionDate: fmtDate(patient.admissionDate),
      startOfCare: fmtDate(patient.startOfCare),
      electionDate: fmtDate(patient.electionDate),
      levelOfCare: patient.levelOfCare || '',
      disasterCode: patient.disasterCode || '',
      startingBenefitPeriod: patient.startingBenefitPeriod || 1,
      isReadmission: patient.isReadmission || false,
      priorHospiceDays: patient.priorHospiceDays || '',
      // Physicians
      attendingPhysician: { ...EMPTY_FORM.attendingPhysician, ...ap },
      hospicePhysician: { ...EMPTY_FORM.hospicePhysician, ...(patient.hospicePhysician || {}) },
      f2fPhysician: patient.f2fPhysician || '',
      f2fProviderRole: patient.f2fProviderRole || '',
      f2fProviderNpi: patient.f2fProviderNpi || '',
      // Contacts
      primaryContact: { ...EMPTY_FORM.primaryContact, ...(patient.primaryContact || {}) },
      primaryCaregiver: { ...EMPTY_FORM.primaryCaregiver, ...(patient.primaryCaregiver || {}) },
      secondaryCaregiver: { ...EMPTY_FORM.secondaryCaregiver, ...(patient.secondaryCaregiver || {}) },
      // Clinical
      diagnoses: patient.diagnoses || [],
      medications: patient.medications || [],
      allergies: patient.allergies || [],
      nkda: patient.nkda || false,
      nfka: patient.nfka || false,
      // Directives
      isDnr: patient.isDnr || false,
      codeStatus: patient.codeStatus || '',
      dpoaName: patient.dpoaName || '',
      livingWillOnFile: patient.livingWillOnFile || false,
      polstOnFile: patient.polstOnFile || false,
      // Services
      pharmacy: { ...EMPTY_FORM.pharmacy, ...(patient.pharmacy || {}) },
      funeralHome: { ...EMPTY_FORM.funeralHome, ...(patient.funeralHome || {}) },
      referral: { ...EMPTY_FORM.referral, ...(patient.referral || {}) },
      // Compliance
      f2fCompleted: patient.f2fCompleted || false,
      f2fDate: fmtDate(patient.f2fDate),
      huv1Completed: patient.huv1Completed || false,
      huv1Date: fmtDate(patient.huv1Date),
      huv2Completed: patient.huv2Completed || false,
      huv2Date: fmtDate(patient.huv2Date),
      // Notes
      otherNotes: patient.otherNotes || '',
    });
  }, [patient]);

  // ── Change handlers ───────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked :
              name === 'startingBenefitPeriod' ? parseInt(value) : value
    }));
  };

  /** Update a nested object field, e.g. handleNested('attendingPhysician', 'name', 'Dr. X') */
  const handleNested = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() && !formData.firstName.trim()) {
      setError('Patient name is required');
      setActiveTab('demographics');
      return;
    }
    if (!formData.admissionDate) {
      setError('Admission date is required');
      setActiveTab('admission');
      return;
    }

    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Failed to save patient');
    }
  };

  const handleDelete = () => {
    if (onDelete && patient?.id) {
      onDelete(patient.id);
    }
  };

  // Compliance info for display
  const cti = patient?.compliance?.cti;
  const huv = patient?.compliance?.huv;

  // ── Render helpers ────────────────────────────────────────────
  const Field = ({ label, name: n, type = 'text', placeholder, required, small, ...rest }) => (
    <div className="form-group">
      <label>{label}{required && ' *'}</label>
      <input
        type={type}
        name={n}
        value={formData[n] || ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        {...rest}
      />
      {small && <small>{small}</small>}
    </div>
  );

  const NestedField = ({ label, parent, field, placeholder }) => (
    <div className="form-group">
      <label>{label}</label>
      <input
        type="text"
        value={formData[parent]?.[field] || ''}
        onChange={(e) => handleNested(parent, field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const SelectField = ({ label, name: n, options, small }) => (
    <div className="form-group">
      <label>{label}</label>
      <select name={n} value={formData[n] || ''} onChange={handleChange}>
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      {small && <small>{small}</small>}
    </div>
  );

  const Check = ({ label, name: n, small }) => (
    <div className="form-group checkbox-row">
      <label className="checkbox-label">
        <input type="checkbox" name={n} checked={!!formData[n]} onChange={handleChange} />
        <span>
          {label}
          {small && <small>{small}</small>}
        </span>
      </label>
    </div>
  );

  const SectionTitle = ({ children }) => (
    <h4 className="section-title">{children}</h4>
  );

  // ═════════════════════════════════════════════════════════════
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container wide" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Patient' : 'Add New Patient'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Compliance Summary (when editing) */}
        {isEditing && cti && (
          <div className="compliance-summary">
            <div className={`summary-item ${cti.isOverdue ? 'danger' : cti.urgency === 'high' ? 'warning' : ''}`}>
              <span className="summary-label">Period</span>
              <span className="summary-value">{cti.currentBenefitPeriod} ({cti.periodDuration}d)</span>
            </div>
            <div className={`summary-item ${cti.isOverdue ? 'danger' : cti.daysUntilCertEnd <= 14 ? 'warning' : ''}`}>
              <span className="summary-label">Cert End</span>
              <span className="summary-value">{formatDate(cti.certificationEndDate)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Days Left</span>
              <span className="summary-value">{cti.isOverdue ? `${Math.abs(cti.daysUntilCertEnd)} overdue` : cti.daysUntilCertEnd}</span>
            </div>
            {cti.requiresF2F && (
              <div className={`summary-item ${cti.f2fCompleted ? 'success' : 'warning'}`}>
                <span className="summary-label">F2F</span>
                <span className="summary-value">{cti.f2fCompleted ? 'Done' : 'Required'}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="modal-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            {/* ─── Tab 1: Demographics ────────────────────────── */}
            {activeTab === 'demographics' && (
              <div className="form-section">
                <SectionTitle>Patient Name</SectionTitle>
                <div className="form-row">
                  <Field label="Full Name (Last, First)" name="name" placeholder="Last, First" required />
                  <Field label="MR Number" name="mrNumber" placeholder="Medical Record #" />
                </div>
                <div className="form-row">
                  <Field label="First Name" name="firstName" placeholder="First" />
                  <Field label="Last Name" name="lastName" placeholder="Last" />
                </div>

                <SectionTitle>Demographics</SectionTitle>
                <div className="form-row">
                  <Field label="Date of Birth" name="dateOfBirth" type="date" />
                  <SelectField label="Gender" name="gender" options={['Male', 'Female', 'Other']} />
                </div>
                <div className="form-row">
                  <SelectField label="Race" name="race" options={['White', 'Black or African American', 'Asian', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander', 'Two or More Races', 'Other']} />
                  <SelectField label="Ethnicity" name="ethnicity" options={['Hispanic or Latino', 'Not Hispanic or Latino']} />
                </div>
                <div className="form-row">
                  <SelectField label="Marital Status" name="maritalStatus" options={['Single', 'Married', 'Divorced', 'Widowed', 'Separated']} />
                  <Field label="Primary Language" name="primaryLanguage" placeholder="English" />
                </div>
                <div className="form-row">
                  <Field label="Religion" name="religion" placeholder="Optional" />
                </div>

                <SectionTitle>Identifiers</SectionTitle>
                <div className="form-row">
                  <Field label="MBI (Medicare ID)" name="mbi" placeholder="Medicare Beneficiary Identifier" />
                  <Field label="Medicaid Number" name="medicaidNumber" placeholder="Medicaid #" />
                </div>
                <div className="form-row">
                  <Field label="Admission Number" name="admissionNumber" placeholder="Admission #" />
                  <Field label="SSN (Last 4)" name="ssn" placeholder="XXXX" maxLength={4} />
                </div>

                <SectionTitle>Location</SectionTitle>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Street, City, State ZIP" />
                </div>
                <div className="form-row">
                  <SelectField label="Location Type" name="locationType" options={['Home', 'Facility', 'Hospital', 'Nursing Home', 'Assisted Living']} />
                  <Field label="Location / Facility Name" name="locationName" placeholder="If applicable" />
                </div>
                <div className="form-row">
                  <Field label="Institution Name" name="institutionName" placeholder="If applicable" />
                </div>

                <SectionTitle>Safety</SectionTitle>
                <div className="form-group">
                  <label>Known Hazards</label>
                  <input
                    type="text"
                    name="knownHazards"
                    value={formData.knownHazards}
                    onChange={handleChange}
                    placeholder="e.g., aggressive dog, stairs only, oxygen in use"
                  />
                </div>
              </div>
            )}

            {/* ─── Tab 2: Admission ───────────────────────────── */}
            {activeTab === 'admission' && (
              <div className="form-section">
                <SectionTitle>Dates</SectionTitle>
                <div className="form-row">
                  <Field label="Admission Date" name="admissionDate" type="date" required />
                  <Field label="Start of Care" name="startOfCare" type="date" small="For HUV calculations" />
                </div>
                <div className="form-row">
                  <Field label="Election Date" name="electionDate" type="date" />
                  <SelectField label="Level of Care" name="levelOfCare" options={['Routine', 'Continuous', 'Respite', 'General Inpatient']} />
                </div>
                <div className="form-row">
                  <Field label="Disaster Code" name="disasterCode" placeholder="If applicable" />
                </div>

                <SectionTitle>Benefit Period</SectionTitle>
                <div className="form-row">
                  <SelectField
                    label="Starting Benefit Period"
                    name="startingBenefitPeriod"
                    options={[
                      { value: 1, label: 'Period 1 (Initial 90 days)' },
                      { value: 2, label: 'Period 2 (Second 90 days)' },
                      { value: 3, label: 'Period 3 (1st 60-day)' },
                      { value: 4, label: 'Period 4 (2nd 60-day)' },
                      { value: 5, label: 'Period 5+ (Subsequent)' },
                    ]}
                    small="Which Medicare benefit period is this patient starting on?"
                  />
                </div>

                <Check
                  label="This is a readmission"
                  name="isReadmission"
                  small="Patient returning after previous hospice discharge"
                />

                {formData.isReadmission && (
                  <div className="form-row">
                    <Field label="Prior Hospice Days Used" name="priorHospiceDays" type="number" min={0} placeholder="Optional" />
                  </div>
                )}
              </div>
            )}

            {/* ─── Tab 3: Physicians & Contacts ───────────────── */}
            {activeTab === 'physicians' && (
              <div className="form-section">
                <SectionTitle>Attending Physician</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="attendingPhysician" field="name" placeholder="Dr. Name" />
                  <NestedField label="NPI" parent="attendingPhysician" field="npi" placeholder="NPI #" />
                </div>
                <div className="form-row">
                  <NestedField label="Phone" parent="attendingPhysician" field="phone" placeholder="Phone" />
                  <NestedField label="Fax" parent="attendingPhysician" field="fax" placeholder="Fax" />
                </div>
                <div className="form-row">
                  <NestedField label="Email" parent="attendingPhysician" field="email" placeholder="Email" />
                  <NestedField label="Address" parent="attendingPhysician" field="address" placeholder="Address" />
                </div>

                <SectionTitle>Hospice Physician</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="hospicePhysician" field="name" placeholder="Dr. Name" />
                  <NestedField label="NPI" parent="hospicePhysician" field="npi" placeholder="NPI #" />
                </div>

                <SectionTitle>Primary Contact</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="primaryContact" field="name" placeholder="Full name" />
                  <NestedField label="Relationship" parent="primaryContact" field="relationship" placeholder="e.g. Spouse" />
                </div>
                <div className="form-row">
                  <NestedField label="Phone" parent="primaryContact" field="phone" placeholder="Phone" />
                  <NestedField label="Address" parent="primaryContact" field="address" placeholder="Address" />
                </div>

                <SectionTitle>Primary Caregiver</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="primaryCaregiver" field="name" placeholder="Full name" />
                  <NestedField label="Relationship" parent="primaryCaregiver" field="relationship" placeholder="e.g. Daughter" />
                </div>
                <div className="form-row">
                  <NestedField label="Mobile" parent="primaryCaregiver" field="mobile" placeholder="Mobile" />
                  <NestedField label="Email" parent="primaryCaregiver" field="email" placeholder="Email" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    value={formData.primaryCaregiver?.address || ''}
                    onChange={(e) => handleNested('primaryCaregiver', 'address', e.target.value)}
                    placeholder="Address"
                  />
                </div>

                <SectionTitle>Secondary Caregiver</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="secondaryCaregiver" field="name" placeholder="Full name" />
                  <NestedField label="Relationship" parent="secondaryCaregiver" field="relationship" placeholder="e.g. Son" />
                </div>
                <div className="form-row">
                  <NestedField label="Mobile" parent="secondaryCaregiver" field="mobile" placeholder="Mobile" />
                  <NestedField label="Address" parent="secondaryCaregiver" field="address" placeholder="Address" />
                </div>
              </div>
            )}

            {/* ─── Tab 4: Clinical ────────────────────────────── */}
            {activeTab === 'clinical' && (
              <div className="form-section">
                <SectionTitle>Diagnoses</SectionTitle>
                <DiagnosisManager
                  diagnoses={formData.diagnoses}
                  onChange={(diagnoses) => setFormData(prev => ({ ...prev, diagnoses }))}
                />

                <SectionTitle>Medications</SectionTitle>
                <MedicationManager
                  medications={formData.medications}
                  onChange={(medications) => setFormData(prev => ({ ...prev, medications }))}
                />

                <SectionTitle>Allergies</SectionTitle>
                <div className="form-row">
                  <Check label="NKDA (No Known Drug Allergies)" name="nkda" />
                  <Check label="NFKA (No Known Food Allergies)" name="nfka" />
                </div>
                {!formData.nkda && (
                  <AllergyManager
                    allergies={formData.allergies}
                    onChange={(allergies) => setFormData(prev => ({ ...prev, allergies }))}
                  />
                )}
              </div>
            )}

            {/* ─── Tab 5: Advance Directives ──────────────────── */}
            {activeTab === 'directives' && (
              <div className="form-section">
                <SectionTitle>Code Status</SectionTitle>
                <div className="form-row">
                  <Check label="DNR (Do Not Resuscitate)" name="isDnr" />
                  <SelectField label="Code Status" name="codeStatus" options={['Full Code', 'DNR', 'DNR/DNI', 'Comfort Measures Only']} />
                </div>

                <SectionTitle>Documents on File</SectionTitle>
                <div className="form-row">
                  <Check label="Living Will on File" name="livingWillOnFile" />
                  <Check label="POLST on File" name="polstOnFile" />
                </div>

                <SectionTitle>Durable Power of Attorney</SectionTitle>
                <div className="form-row">
                  <Field label="DPOA Name" name="dpoaName" placeholder="Full name of healthcare POA" />
                </div>
              </div>
            )}

            {/* ─── Tab 6: Services ────────────────────────────── */}
            {activeTab === 'services' && (
              <div className="form-section">
                <SectionTitle>Pharmacy</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="pharmacy" field="name" placeholder="Pharmacy name" />
                  <NestedField label="Phone" parent="pharmacy" field="phone" placeholder="Phone" />
                </div>
                <div className="form-row">
                  <NestedField label="Fax" parent="pharmacy" field="fax" placeholder="Fax" />
                  <NestedField label="Address" parent="pharmacy" field="address" placeholder="Address" />
                </div>

                <SectionTitle>Funeral Home</SectionTitle>
                <div className="form-row">
                  <NestedField label="Name" parent="funeralHome" field="name" placeholder="Funeral home name" />
                  <NestedField label="Phone" parent="funeralHome" field="phone" placeholder="Phone" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    value={formData.funeralHome?.address || ''}
                    onChange={(e) => handleNested('funeralHome', 'address', e.target.value)}
                    placeholder="Address"
                  />
                </div>

                <SectionTitle>Referral</SectionTitle>
                <div className="form-row">
                  <NestedField label="Referral Source" parent="referral" field="source" placeholder="e.g. Hospital, Physician" />
                </div>
              </div>
            )}

            {/* ─── Tab 7: Compliance ──────────────────────────── */}
            {activeTab === 'compliance' && (
              <div className="form-section">
                {/* F2F Section */}
                {showF2FSection && (
                  <div className="f2f-section">
                    <h4>Face-to-Face Encounter Required</h4>
                    <p className="f2f-reason">
                      Reason: {formData.isReadmission && formData.startingBenefitPeriod >= 3
                        ? 'Readmission + Period 3+'
                        : formData.isReadmission
                          ? 'Readmission'
                          : 'Period 3+ (60-day cycle)'}
                    </p>

                    <Check label="F2F Encounter Completed" name="f2fCompleted" />

                    {formData.f2fCompleted && (
                      <>
                        <div className="form-row">
                          <Field label="F2F Date" name="f2fDate" type="date" />
                          <Field label="F2F Physician" name="f2fPhysician" placeholder="Physician name" />
                        </div>
                        <div className="form-row">
                          <SelectField label="F2F Provider Role" name="f2fProviderRole" options={['Physician', 'Nurse Practitioner', 'Physician Assistant']} />
                          <Field label="F2F Provider NPI" name="f2fProviderNpi" placeholder="NPI #" />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!showF2FSection && (
                  <div className="info-box">F2F encounter not required for this benefit period.</div>
                )}

                <SectionTitle>HUV Tracking</SectionTitle>
                {huv && (
                  <div className="huv-windows">
                    <div className="huv-window"><strong>HUV1 Window:</strong> {huv.huv1.windowText}</div>
                    <div className="huv-window"><strong>HUV2 Window:</strong> {huv.huv2.windowText}</div>
                  </div>
                )}
                <Check label="HUV1 Completed (Days 5-14)" name="huv1Completed" />
                {formData.huv1Completed && (
                  <div className="form-row"><Field label="HUV1 Date" name="huv1Date" type="date" /></div>
                )}
                <Check label="HUV2 Completed (Days 15-28)" name="huv2Completed" />
                {formData.huv2Completed && (
                  <div className="form-row"><Field label="HUV2 Date" name="huv2Date" type="date" /></div>
                )}

                <SectionTitle>Notes</SectionTitle>
                <div className="form-group">
                  <label>Other Notes</label>
                  <textarea
                    name="otherNotes"
                    value={formData.otherNotes}
                    onChange={handleChange}
                    placeholder="Additional notes about this patient..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {isEditing && onDelete && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div className="footer-right">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Patient')}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-container.wide {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }
        .modal-header h2 { margin: 0; font-size: 1.125rem; }
        .close-btn {
          background: none; border: none;
          font-size: 1.5rem; cursor: pointer;
          color: #6b7280; line-height: 1;
        }

        /* Compliance Summary */
        .compliance-summary {
          display: flex; gap: 1rem;
          padding: 0.75rem 1.5rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .summary-item {
          display: flex; flex-direction: column;
          padding: 0.25rem 0.75rem;
          border-radius: 6px; background: white;
          border: 1px solid #e5e7eb;
        }
        .summary-item.danger { border-color: #ef4444; background: #fef2f2; }
        .summary-item.warning { border-color: #f59e0b; background: #fffbeb; }
        .summary-item.success { border-color: #10b981; background: #ecfdf5; }
        .summary-label { font-size: 0.65rem; color: #6b7280; text-transform: uppercase; }
        .summary-value { font-size: 0.875rem; font-weight: 600; }

        /* Tabs */
        .modal-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
          flex-shrink: 0;
        }
        .tab {
          padding: 0.625rem 0.75rem;
          background: none; border: none;
          border-bottom: 2px solid transparent;
          font-size: 0.8rem; color: #6b7280;
          cursor: pointer; white-space: nowrap;
        }
        .tab:hover { color: #1f2937; }
        .tab.active { color: #2563eb; border-bottom-color: #2563eb; }

        /* Body */
        .modal-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }
        .error-message {
          background: #fee2e2; color: #991b1b;
          padding: 0.75rem; border-radius: 6px;
          margin-bottom: 1rem; font-size: 0.875rem;
        }
        .info-box {
          background: #eff6ff; color: #1e40af;
          padding: 0.75rem; border-radius: 6px;
          font-size: 0.875rem; margin-bottom: 1rem;
        }

        /* Section titles */
        .section-title {
          margin: 1.25rem 0 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 0.375rem;
        }
        .section-title:first-child { margin-top: 0; }

        /* Form */
        .form-section { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; margin-bottom: 0.25rem; }
        .form-group label {
          font-size: 0.875rem; font-weight: 500;
          margin-bottom: 0.375rem; color: #374151;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: inherit;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .form-group small { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }

        /* Checkbox */
        .checkbox-row { margin-top: 0.25rem; }
        .checkbox-label {
          display: flex; align-items: flex-start;
          gap: 0.5rem; cursor: pointer;
        }
        .checkbox-label input { margin-top: 0.25rem; }
        .checkbox-label span { display: flex; flex-direction: column; }
        .checkbox-label small { color: #6b7280; font-size: 0.75rem; }

        /* F2F */
        .f2f-section {
          background: #fef3c7; border: 1px solid #f59e0b;
          border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;
        }
        .f2f-section h4 { margin: 0 0 0.5rem; font-size: 0.875rem; }
        .f2f-reason { font-size: 0.8rem; color: #92400e; margin: 0 0 1rem; }

        /* HUV */
        .huv-windows {
          background: #f3f4f6; padding: 0.75rem;
          border-radius: 6px; margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        .huv-window { margin-bottom: 0.25rem; }

        /* Footer */
        .modal-footer {
          display: flex; justify-content: space-between;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          flex-shrink: 0;
        }
        .footer-right { display: flex; gap: 0.75rem; }

        /* Buttons */
        .btn {
          padding: 0.5rem 1rem; border-radius: 6px;
          font-size: 0.875rem; cursor: pointer; border: none;
        }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
        .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn-danger { background: #fee2e2; color: #991b1b; }
        .btn-danger:hover { background: #fecaca; }

        @media (max-width: 640px) {
          .form-row { grid-template-columns: 1fr; }
          .compliance-summary { flex-direction: column; }
          .modal-container.wide { max-width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default PatientModal;
