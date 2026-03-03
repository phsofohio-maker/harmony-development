/**
 * Harmony HCA — Patient Migration Script
 *
 * One-time migration for the v1.2.0 schema expansion:
 *   1. Convert attendingPhysician from string → nested object
 *   2. Auto-parse firstName/lastName from existing name field
 *   3. Add empty defaults for all new fields on existing patient docs
 *
 * Usage: Deploy as a callable Cloud Function, then invoke once from the
 *        admin console or via the Firebase shell.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db } = require('./firebase');

// Default values for all new fields added in v1.2.0
const NEW_FIELD_DEFAULTS = {
  // Identifiers
  mbi: '',
  medicaidNumber: '',
  admissionNumber: '',
  ssn: '',

  // Demographics
  gender: '',
  race: '',
  ethnicity: '',
  maritalStatus: '',
  primaryLanguage: '',
  religion: '',

  // Admission additions
  electionDate: null,
  levelOfCare: '',
  disasterCode: '',

  // Advance Directives
  isDnr: false,
  codeStatus: '',
  dpoaName: '',
  livingWillOnFile: false,
  polstOnFile: false,

  // F2F additions
  f2fProviderRole: '',
  f2fProviderNpi: '',

  // Physicians
  hospicePhysician: { name: '', npi: '' },

  // Contacts & Caregivers
  primaryContact: { name: '', relationship: '', phone: '', address: '' },
  primaryCaregiver: { name: '', relationship: '', address: '', mobile: '', email: '' },
  secondaryCaregiver: { name: '', relationship: '', address: '', mobile: '' },

  // Services
  pharmacy: { name: '', address: '', phone: '', fax: '' },
  funeralHome: { name: '', address: '', phone: '' },
  referral: { source: '' },

  // Clinical Arrays
  diagnoses: [],
  medications: [],
  allergies: [],
  nkda: false,
  nfka: false,

  // Location
  address: '',
  locationName: '',
  locationType: '',
  institutionName: '',

  // Notes
  otherNotes: '',
};

/**
 * Migrate a single patient document.
 * Returns an update object with only the fields that need changing.
 */
function buildMigrationUpdates(data) {
  const updates = {};

  // --- Migration 1: attendingPhysician string → object ---
  if (typeof data.attendingPhysician === 'string') {
    updates.attendingPhysician = {
      name: data.attendingPhysician || '',
      npi: '',
      address: '',
      phone: '',
      fax: '',
      email: '',
    };
  } else if (!data.attendingPhysician || typeof data.attendingPhysician !== 'object') {
    // Missing entirely — set full default
    updates.attendingPhysician = {
      name: '',
      npi: '',
      address: '',
      phone: '',
      fax: '',
      email: '',
    };
  }

  // --- Migration 2: Auto-parse firstName/lastName from name ---
  if (data.name && !data.firstName && !data.lastName) {
    const parts = (data.name || '').trim().split(/\s+/);
    updates.firstName = parts[0] || '';
    updates.lastName = parts.slice(1).join(' ') || '';
  }

  // --- Migration 3: Add defaults for all new fields if missing ---
  for (const [field, defaultValue] of Object.entries(NEW_FIELD_DEFAULTS)) {
    if (data[field] === undefined || data[field] === null) {
      updates[field] = defaultValue;
    }
  }

  return updates;
}

/**
 * Callable Cloud Function: migratePatients
 * Iterates all organizations and their patients, applying v1.2.0 schema updates.
 * Requires admin role.
 */
const migratePatients = onCall(async (request) => {
  // Auth check — require admin or owner
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  const role = request.auth.token.role;
  if (role !== 'admin' && role !== 'owner') {
    throw new HttpsError('permission-denied', 'Must be an admin or owner');
  }

  const orgsSnapshot = await db.collection('organizations').get();
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errors = [];

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    const patientsRef = db.collection('organizations').doc(orgId).collection('patients');
    const patientsSnapshot = await patientsRef.get();

    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const patientDoc of patientsSnapshot.docs) {
      const data = patientDoc.data();
      const updates = buildMigrationUpdates(data);

      if (Object.keys(updates).length === 0) {
        totalSkipped++;
        continue;
      }

      try {
        batch.update(patientDoc.ref, updates);
        batchCount++;
        totalUpdated++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } catch (err) {
        totalErrors++;
        errors.push(`${orgId}/${patientDoc.id}: ${err.message}`);
      }
    }

    // Commit remaining updates for this org
    if (batchCount > 0) {
      await batch.commit();
    }
  }

  return {
    success: true,
    totalUpdated,
    totalSkipped,
    totalErrors,
    errors: errors.slice(0, 20), // Cap error list
  };
});

module.exports = { migratePatients };
