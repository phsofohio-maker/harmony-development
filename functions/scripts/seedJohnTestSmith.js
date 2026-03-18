/**
 * Seed a complete patient profile for "John Test Smith"
 *
 * Populates EVERY field in the patient schema with realistic test data.
 *
 * USAGE: cd functions && node scripts/seedJohnTestSmith.js
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'service-account-key.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'parrish-harmonyhca'
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return admin.firestore.Timestamp.fromDate(date);
}

function dateFromString(str) {
  return admin.firestore.Timestamp.fromDate(new Date(str));
}

const johnTestSmith = {
  // ── Basic Info ──
  name: 'Smith, John Test',
  firstName: 'John Test',
  lastName: 'Smith',
  mrNumber: 'MR-TEST-001',
  dateOfBirth: dateFromString('1956-07-15'),

  // ── Identifiers ──
  mbi: '1EG4-TE5-MK72',
  medicaidNumber: 'OH-12345678',
  admissionNumber: 'ADM-2026-0042',
  ssn: '6789',

  // ── Demographics ──
  gender: 'Male',
  race: 'White',
  ethnicity: 'Not Hispanic or Latino',
  maritalStatus: 'Married',
  primaryLanguage: 'English',
  religion: 'Christian',

  // ── Admission Info ──
  admissionDate: daysAgo(30),
  startOfCare: daysAgo(30),
  electionDate: daysAgo(30),
  levelOfCare: 'Routine',
  disasterCode: '',

  // ── Benefit Period Tracking ──
  startingBenefitPeriod: 1,
  isReadmission: false,
  priorHospiceDays: 0,

  // ── Advance Directives ──
  isDnr: true,
  codeStatus: 'DNR',
  dpoaName: 'Smith, Mary Test',
  livingWillOnFile: true,
  polstOnFile: true,

  // ── F2F Tracking ──
  f2fRequired: false,
  f2fCompleted: false,
  f2fDate: null,
  f2fPhysician: '',
  f2fProviderRole: '',
  f2fProviderNpi: '',

  // ── HUV Tracking ──
  huv1Completed: true,
  huv1Date: daysAgo(20),
  huv2Completed: true,
  huv2Date: daysAgo(10),

  // ── Attending Physician ──
  attendingPhysician: {
    name: 'Dr. Anderson, Michael',
    npi: '1234567890',
    address: '123 Medical Center Dr, Columbus, OH 43215',
    phone: '(614) 555-0101',
    fax: '(614) 555-0102',
    email: 'dr.anderson@testmedical.com',
  },

  // ── Hospice Physician ──
  hospicePhysician: {
    name: 'Dr. Chen, Susan',
    npi: '0987654321',
  },

  // ── Primary Contact ──
  primaryContact: {
    name: 'Smith, Mary Test',
    relationship: 'Spouse',
    phone: '(614) 555-1234',
    address: '456 Oak Lane, Columbus, OH 43215',
  },

  // ── Primary Caregiver ──
  primaryCaregiver: {
    name: 'Smith, Mary Test',
    relationship: 'Spouse',
    address: '456 Oak Lane, Columbus, OH 43215',
    mobile: '(614) 555-5678',
    email: 'mary.smith.test@email.com',
  },

  // ── Secondary Caregiver ──
  secondaryCaregiver: {
    name: 'Smith, David Test',
    relationship: 'Son',
    address: '789 Maple Ave, Dublin, OH 43017',
    mobile: '(614) 555-9012',
  },

  // ── Pharmacy ──
  pharmacy: {
    name: 'Test Community Pharmacy',
    address: '321 Pharmacy Blvd, Columbus, OH 43215',
    phone: '(614) 555-3456',
    fax: '(614) 555-3457',
  },

  // ── Funeral Home ──
  funeralHome: {
    name: 'Test Memorial Chapel',
    address: '654 Memorial Dr, Columbus, OH 43215',
    phone: '(614) 555-7890',
  },

  // ── Referral ──
  referral: {
    source: 'Ohio State University Wexner Medical Center',
  },

  // ── Diagnoses ──
  diagnoses: [
    {
      name: 'Lung cancer, unspecified',
      icd10: 'C34.90',
      relationship: 'Terminal',
    },
    {
      name: 'Chronic obstructive pulmonary disease',
      icd10: 'J44.1',
      relationship: 'Related',
    },
    {
      name: 'Essential hypertension',
      icd10: 'I10',
      relationship: 'Unrelated',
    },
  ],

  // ── Medications ──
  medications: [
    {
      name: 'Morphine Sulfate',
      dose: '15mg',
      route: 'PO',
      frequency: 'Q4H PRN',
      indication: 'Pain management',
    },
    {
      name: 'Ondansetron',
      dose: '4mg',
      route: 'PO',
      frequency: 'Q8H PRN',
      indication: 'Nausea',
    },
    {
      name: 'Lisinopril',
      dose: '10mg',
      route: 'PO',
      frequency: 'Daily',
      indication: 'Hypertension',
    },
    {
      name: 'Albuterol',
      dose: '90mcg',
      route: 'Inhaled',
      frequency: 'Q4H PRN',
      indication: 'Dyspnea / COPD',
    },
  ],

  // ── Allergies ──
  allergies: [
    {
      allergen: 'Penicillin',
      reactionType: 'Drug',
      severity: 'Severe',
    },
    {
      allergen: 'Shellfish',
      reactionType: 'Food',
      severity: 'Moderate',
    },
  ],
  nkda: false,
  nfka: false,

  // ── Location ──
  address: '456 Oak Lane, Columbus, OH 43215',
  locationName: 'Patient Home',
  locationType: 'Home',
  institutionName: '',

  // ── Safety ──
  knownHazards: 'Oxygen in use. Two small dogs in home.',

  // ── Notes ──
  otherNotes: 'Test patient — complete profile seed. Patient prefers morning visits. Family is very involved in care.',

  // ── Status ──
  status: 'active',
  dischargeDate: null,
  dischargeReason: '',
};

async function seedJohnTestSmith() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SEEDING COMPLETE PATIENT: John Test Smith');
  console.log('═══════════════════════════════════════════════════════\n');

  const orgId = 'org_parrish';
  const userId = 'SYSTEM_SEED_DATA';

  try {
    const patientsRef = db.collection('organizations').doc(orgId).collection('patients');

    const patient = {
      ...johnTestSmith,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    };

    const docRef = await patientsRef.add(patient);

    console.log(`Patient ID:  ${docRef.id}`);
    console.log(`Name:        ${johnTestSmith.name}`);
    console.log(`MR#:         ${johnTestSmith.mrNumber}`);
    console.log(`Path:        organizations/${orgId}/patients/${docRef.id}`);
    console.log(`\nFields populated:`);
    console.log(`  Demographics:    gender, race, ethnicity, marital status, language, religion`);
    console.log(`  Identifiers:     MBI, Medicaid#, Admission#, SSN (last 4)`);
    console.log(`  Admission:       date, start of care, election date, level of care`);
    console.log(`  Directives:      DNR, code status, DPOA, living will, POLST`);
    console.log(`  Physicians:      attending (full), hospice`);
    console.log(`  Contacts:        primary contact, primary caregiver, secondary caregiver`);
    console.log(`  Services:        pharmacy, funeral home, referral source`);
    console.log(`  Clinical:        3 diagnoses, 4 medications, 2 allergies`);
    console.log(`  Location:        address, type (Home)`);
    console.log(`  Compliance:      HUV1 & HUV2 completed`);
    console.log(`\nDone!\n`);

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedJohnTestSmith()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
