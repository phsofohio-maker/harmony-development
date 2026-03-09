/**
 * functions/lib/mergeData.js
 * Merge data preparation for document generation.
 *
 * Combines patient data, org data, custom data, and assessment data
 * into a flat key-value dictionary for Google Docs template merge fields.
 */

/**
 * Format date helper — handles Firestore Timestamps, Dates, strings, numbers
 */
function formatDate(dateValue) {
  if (!dateValue) return 'N/A';

  let date;
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    date = dateValue.toDate();
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else {
    return 'N/A';
  }

  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Prepare the full merge data context.
 * Combines patient data, org data, and visit customData into a flat
 * dictionary of ~150+ keys for template merge field resolution.
 *
 * Keys are available in both camelCase (patientName) and UPPER_CASE
 * (PATIENT_NAME) formats to support both naming conventions in templates.
 */
function prepareMergeData(patientData, orgData, customData = {}, assessmentData = null) {
  const p = patientData || {};
  const o = orgData || {};
  const c = customData || {};
  const a = assessmentData || {};

  // Helper: safely access nested physician object or legacy string
  const ap = typeof p.attendingPhysician === 'object' ? p.attendingPhysician : {};
  const apName = ap.name || (typeof p.attendingPhysician === 'string' ? p.attendingPhysician : 'N/A');
  const hp = typeof p.hospicePhysician === 'object' ? p.hospicePhysician : {};

  // Primary diagnosis from diagnoses array
  const primaryDx = Array.isArray(p.diagnoses) && p.diagnoses.length > 0 ? p.diagnoses[0] : {};
  const allDiagnoses = Array.isArray(p.diagnoses) ? p.diagnoses.map(d => `${d.name} (${d.icd10 || 'N/A'}) [${d.relationship || ''}]`).join('; ') : 'N/A';

  // Medications list
  const allMedications = Array.isArray(p.medications) ? p.medications.map(m => `${m.name} ${m.dose} ${m.route} ${m.frequency}`.trim()).join('; ') : 'N/A';

  // Allergies list
  const allAllergies = p.nkda ? 'NKDA' : (Array.isArray(p.allergies) ? p.allergies.map(a => `${a.allergen} (${a.severity || ''})`).join('; ') : 'N/A');

  const base = {
    // ── Spread raw data first (custom overrides below) ──────────
    ...p,
    ...c,

    // ── Generated / Meta ────────────────────────────────────────
    generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    visitDate: formatDate(c.visitDate || new Date()),

    // ── Organization ────────────────────────────────────────────
    orgName: o.name || 'N/A',
    agencyName: o.agencyName || o.name || 'N/A',
    orgNpi: o.npi || 'N/A',
    orgProviderNumber: o.providerNumber || 'N/A',
    orgPhone: o.phone || 'N/A',
    orgFax: o.fax || 'N/A',
    orgAddress: o.address || 'N/A',
    orgCity: o.city || '',
    orgState: o.state || '',
    orgZip: o.zip || '',

    // ── Patient Identity ────────────────────────────────────────
    patientName: p.name || 'N/A',
    patientFirstName: p.firstName || '',
    patientLastName: p.lastName || '',
    patientDOB: formatDate(p.dateOfBirth || p.dob),
    patientMRN: p.mrNumber || p.mrn || 'N/A',
    patientMBI: p.mbi || 'N/A',
    patientMedicaid: p.medicaidNumber || 'N/A',
    patientAdmissionNumber: p.admissionNumber || 'N/A',
    patientSSN: p.ssn || '',

    // ── Demographics ────────────────────────────────────────────
    patientGender: p.gender || 'N/A',
    patientRace: p.race || 'N/A',
    patientEthnicity: p.ethnicity || 'N/A',
    patientMaritalStatus: p.maritalStatus || 'N/A',
    patientLanguage: p.primaryLanguage || 'English',
    patientReligion: p.religion || '',

    // ── Location ────────────────────────────────────────────────
    patientAddress: p.address || 'N/A',
    patientLocationName: p.locationName || '',
    patientLocationType: p.locationType || '',
    patientInstitution: p.institutionName || '',

    // ── Admission ───────────────────────────────────────────────
    admissionDate: formatDate(p.admissionDate || p.socDate),
    startOfCare: formatDate(p.startOfCare),
    electionDate: formatDate(p.electionDate),
    levelOfCare: p.levelOfCare || 'Routine',
    disasterCode: p.disasterCode || '',

    // ── Benefit Period ──────────────────────────────────────────
    currentPeriod: p.compliance?.cti?.periodShortName || `Period ${p.startingBenefitPeriod || 1}`,
    periodStart: formatDate(p.compliance?.cti?.periodStart),
    periodEnd: formatDate(p.compliance?.cti?.periodEnd),
    certDueDate: formatDate(p.compliance?.cti?.certDueDate),
    certificationEndDate: formatDate(p.compliance?.cti?.certificationEndDate),
    daysUntilCertEnd: p.compliance?.cti?.daysUntilCertEnd ?? 'N/A',
    periodDuration: p.compliance?.cti?.periodDuration || 'N/A',
    startingBenefitPeriod: p.startingBenefitPeriod || 1,
    isReadmission: p.isReadmission ? 'Yes' : 'No',
    priorHospiceDays: p.priorHospiceDays || 0,

    // ── Attending Physician ─────────────────────────────────────
    attendingPhysician: apName,
    attendingPhysicianName: apName,
    attendingNPI: ap.npi || 'N/A',
    attendingPhone: ap.phone || 'N/A',
    attendingFax: ap.fax || 'N/A',
    attendingEmail: ap.email || '',
    attendingAddress: ap.address || '',

    // ── Hospice Physician ───────────────────────────────────────
    hospicePhysicianName: hp.name || 'N/A',
    hospicePhysicianNPI: hp.npi || 'N/A',

    // ── F2F ─────────────────────────────────────────────────────
    f2fRequired: p.f2fRequired || (p.startingBenefitPeriod >= 3 || p.isReadmission) ? 'Yes' : 'No',
    f2fCompleted: p.f2fCompleted ? 'Yes' : 'No',
    f2fDate: formatDate(c.f2fDate || p.f2fDate),
    f2fPhysician: p.f2fPhysician || 'N/A',
    f2fProvider: c.f2fProvider || p.f2fPhysician || 'N/A',
    f2fProviderRole: p.f2fProviderRole || 'N/A',
    f2fProviderNpi: p.f2fProviderNpi || 'N/A',
    f2fProviderCredentials: c.f2fProviderCredentials || 'MD/DO/NP/PA',

    // ── HUV ─────────────────────────────────────────────────────
    huv1Completed: p.huv1Completed ? 'Yes' : 'No',
    huv1Date: formatDate(p.huv1Date),
    huv2Completed: p.huv2Completed ? 'Yes' : 'No',
    huv2Date: formatDate(p.huv2Date),

    // ── Diagnoses ───────────────────────────────────────────────
    primaryDiagnosis: primaryDx.name || 'N/A',
    primaryDiagnosisICD10: primaryDx.icd10 || 'N/A',
    diagnosis: primaryDx.name || 'N/A',
    allDiagnoses,

    // ── Medications & Allergies ──────────────────────────────────
    allMedications,
    allAllergies,
    nkda: p.nkda ? 'NKDA' : 'No',

    // ── Advance Directives ──────────────────────────────────────
    codeStatus: p.codeStatus || 'N/A',
    isDnr: p.isDnr ? 'Yes' : 'No',
    dpoaName: p.dpoaName || 'N/A',
    livingWillOnFile: p.livingWillOnFile ? 'Yes' : 'No',
    polstOnFile: p.polstOnFile ? 'Yes' : 'No',

    // ── Contacts ────────────────────────────────────────────────
    primaryContactName: p.primaryContact?.name || 'N/A',
    primaryContactRelationship: p.primaryContact?.relationship || '',
    primaryContactPhone: p.primaryContact?.phone || 'N/A',
    primaryContactAddress: p.primaryContact?.address || '',

    primaryCaregiverName: p.primaryCaregiver?.name || 'N/A',
    primaryCaregiverRelationship: p.primaryCaregiver?.relationship || '',
    primaryCaregiverMobile: p.primaryCaregiver?.mobile || 'N/A',
    primaryCaregiverEmail: p.primaryCaregiver?.email || '',
    primaryCaregiverAddress: p.primaryCaregiver?.address || '',

    secondaryCaregiverName: p.secondaryCaregiver?.name || '',
    secondaryCaregiverRelationship: p.secondaryCaregiver?.relationship || '',
    secondaryCaregiverMobile: p.secondaryCaregiver?.mobile || '',

    // ── Services ────────────────────────────────────────────────
    pharmacyName: p.pharmacy?.name || 'N/A',
    pharmacyPhone: p.pharmacy?.phone || 'N/A',
    pharmacyFax: p.pharmacy?.fax || '',
    pharmacyAddress: p.pharmacy?.address || '',

    funeralHomeName: p.funeralHome?.name || 'N/A',
    funeralHomePhone: p.funeralHome?.phone || '',
    funeralHomeAddress: p.funeralHome?.address || '',

    referralSource: p.referral?.source || 'N/A',

    // ── Notes ───────────────────────────────────────────────────
    otherNotes: p.otherNotes || '',
  };

  // ── UPPER_CASE Template Merge Variable Aliases ──────────────
  const diagnoses = Array.isArray(p.diagnoses) ? p.diagnoses : [];
  const calcAge = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth?.toDate ? p.dateOfBirth.toDate() : p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '';

  Object.assign(base, {
    PATIENT_NAME: base.patientName,
    DOB: base.patientDOB,
    MRN: base.patientMRN,
    MBI: base.patientMBI,
    MPI: base.patientMedicaid,

    CBX_GENDER: base.patientGender || '',

    CBX_BP: base.currentPeriod || '',
    BENEFIT_PERIOD: base.startingBenefitPeriod || '',
    BENEFIT_PERIOD_NUM: base.startingBenefitPeriod || '',
    BENEFIT_PERIOD_1: base.periodStart || '',
    BENEFIT_PERIOD_2: base.periodEnd || '',

    CBX_CT: c.CBX_CT || c.certType || '',
    CBX_F2F: base.f2fRequired || '',
    CBX_R: c.CBX_R || c.diagnosisRelationship || '',

    DIAGNOSIS_1: diagnoses[0]?.name || '',
    DIAGNOSIS_2: diagnoses[1]?.name || '',
    DIAGNOSIS_3: diagnoses[2]?.name || '',
    DIAGNOSIS_4: diagnoses[3]?.name || '',
    DIAGNOSIS_5: diagnoses[4]?.name || '',
    DIAGNOSIS_6: diagnoses[5]?.name || '',
    DIAGNOSIS1: diagnoses[0]?.name || '',
    DIAGNOSIS2: diagnoses[1]?.name || '',
    DIAGNOSIS3: diagnoses[2]?.name || '',
    DIAGNOSIS4: diagnoses[3]?.name || '',
    DIAGNOSIS5: diagnoses[4]?.name || '',
    DIAGNOSIS6: diagnoses[5]?.name || '',

    D1_DATE: formatDate(diagnoses[0]?.onsetDate),
    D2_DATE: formatDate(diagnoses[1]?.onsetDate),
    D3_DATE: formatDate(diagnoses[2]?.onsetDate),
    D4_DATE: formatDate(diagnoses[3]?.onsetDate),
    D5_DATE: formatDate(diagnoses[4]?.onsetDate),
    D6_DATE: formatDate(diagnoses[5]?.onsetDate),

    CALC_ICD: base.primaryDiagnosisICD10 || '',
    CALC_AGE: calcAge !== '' ? String(calcAge) : '',

    ADMISSION: base.admissionDate,
    ELECTION_DATE: base.electionDate,

    CD_1: base.periodStart || '',
    CD_2: base.periodEnd || '',
    CDATE1: base.periodStart || '',
    CDATE2: base.periodEnd || '',

    PHYS_ATT_NAME: base.attendingPhysicianName,
    PHYS_ATT_NPI: base.attendingNPI,
    PHYS_ATT_PHONE: base.attendingPhone,

    F2F_DATE: base.f2fDate,
    F2F_PHYSICIAN: base.f2fProvider,
    F2F_PROVIDER_NAME: base.f2fProvider,
    F2F_NPI: base.f2fProviderNpi,
    CBX_F2F_ROLE: base.f2fProviderRole || '',

    SELECT_DATE: formatDate(a.visitDate) || base.visitDate || '',
    SELECT_TIME: a.visitTime || c.visitTime || c.SELECT_TIME || '',

    PATIENT_LOCATION: base.patientLocationName || base.patientLocationType || '',
    PATIENT_ADDRESS: base.patientAddress,
    PATIENT_PN: c.patientPhone || p.phone || '',
    PATIENT_PHONE: c.patientPhone || p.phone || '',

    PROVIDER: a.clinicianName || c.clinicianName || c.PROVIDER || '',
    NPI: a.clinicianNpi || c.providerNpi || c.NPI || base.attendingNPI || '',
    CBX_VT: a.visitType || c.visitType || c.CBX_VT || '',
    CBX_ROLE: a.clinicianTitle || c.clinicianTitle || c.CBX_ROLE || '',
    CBX_VP: a.visitPurpose || c.visitPurpose || c.CBX_VP || '',

    // ── Tier 2: Visit-level fields from assessment ────────────────
    TIME_IN: a.visitTime || a.timeIn || c.visitTime || '',
    TIME_OUT: a.timeOut || c.timeOut || '',
    VISIT_TYPE: a.visitType || c.visitType || '',
    PROVIDER_NAME: a.clinicianName || c.clinicianName || '',
    PROVIDER_NPI: a.clinicianNpi || c.providerNpi || '',
    PROVIDER_TITLE: a.clinicianTitle || c.clinicianTitle || '',

    // ── Tier 3: Clinical data from assessment ─────────────────────
    VITALS_BP: a.bpSystolic && a.bpDiastolic ? `${a.bpSystolic}/${a.bpDiastolic}` : (c.VITALS_BP || ''),
    VITALS_HR: a.heartRate || c.VITALS_HR || '',
    VITALS_RESP: a.respiratoryRate || c.VITALS_RESP || '',
    VITALS_TEMP: a.temperature || c.VITALS_TEMP || '',
    VITALS_O2: a.o2Saturation || c.VITALS_O2 || '',
    WEIGHT_CURRENT: a.weight || c.WEIGHT_CURRENT || '',

    PAIN_SCORE: a.painLevel || c.PAIN_SCORE || '',
    PAIN_GOAL: a.painGoal || c.PAIN_GOAL || '',
    CBX_PAIN_RELIEF: a.painManaged != null ? (a.painManaged ? '☑ Yes  ☐ No' : '☐ Yes  ☑ No') : '',

    PPS_CURRENT: a.performanceScore || c.PPS_CURRENT || '',
    ADL_SCORE_CURRENT: a.adlScoreCurrent || c.ADL_SCORE_CURRENT || '',
    MOBILITY_STATUS: a.mobilityStatus || c.MOBILITY_STATUS || '',
    FALL_RISK: a.fallRisk || c.FALL_RISK || '',

    ADL_BATHING: a.adlBathing || '',
    ADL_DRESSING: a.adlDressing || '',
    ADL_TOILETING: a.adlToileting || '',
    ADL_TRANSFERRING: a.adlTransferring || '',
    ADL_FEEDING: a.adlFeeding || '',

    SYMPTOM_PAIN: a.symptoms?.pain ? 'Yes' : 'No',
    SYMPTOM_NAUSEA: a.symptoms?.nausea ? 'Yes' : 'No',
    SYMPTOM_DYSPNEA: a.symptoms?.dyspnea ? 'Yes' : 'No',
    SYMPTOM_ANXIETY: a.symptoms?.anxiety ? 'Yes' : 'No',
    SYMPTOM_FATIGUE: a.symptoms?.fatigue ? 'Yes' : 'No',
    SYMPTOM_CONSTIPATION: a.symptoms?.constipation ? 'Yes' : 'No',
    SYMPTOM_EDEMA: a.symptoms?.edema ? 'Yes' : 'No',
    SYMPTOM_SKIN_ISSUES: a.symptoms?.skinIssues ? 'Yes' : 'No',
    SYMPTOM_NOTES: a.symptomNotes || c.SYMPTOM_NOTES || '',

    EXAM_FINDINGS_NARRATIVE: a.examFindingsNarrative || c.EXAM_FINDINGS_NARRATIVE || '',
    HPI_NARRATIVE: a.narrativeNotes || c.HPI_NARRATIVE || '',
    CLINICAL_NARRATIVE: a.narrativeNotes || c.CLINICAL_NARRATIVE || '',

    CBX_MED_CHANGES: a.medicationsReviewed != null ? (a.medicationsReviewed ? '☑ Reviewed  ☐ No Changes' : '☐ Reviewed  ☑ No Changes') : '',
    MED_CHANGE_DETAILS: a.planChanges || c.MED_CHANGE_DETAILS || '',
    ORDERS_DME: a.interventions || c.ORDERS_DME || '',
    GOALS_REVIEWED: a.goalsReviewed ? 'Yes' : 'No',
    EDUCATION_PROVIDED: a.educationProvided || '',
    NEXT_VISIT_DATE: formatDate(a.nextVisitDate),

    SUGGESTION: c.SUGGESTION || c.suggestion || '',
  });

  return base;
}

module.exports = { prepareMergeData, formatDate };
