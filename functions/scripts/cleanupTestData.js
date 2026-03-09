/**
 * scripts/cleanupTestData.js
 * Remove test/dummy patient data from Firestore
 *
 * USAGE:
 *   Dry run:  node scripts/cleanupTestData.js
 *   Execute:  node scripts/cleanupTestData.js --confirm
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const DRY_RUN = !process.argv.includes('--confirm');
const ORG_ID = 'org_parrish';

async function cleanup() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(DRY_RUN
    ? '  DRY RUN — no data will be deleted'
    : '  LIVE RUN — deleting data');
  console.log('═══════════════════════════════════════════════════════\n');

  const patientsRef = db.collection(`organizations/${ORG_ID}/patients`);
  const patientsSnapshot = await patientsRef.get();

  const testPatients = [];
  const realPatients = [];

  patientsSnapshot.forEach((doc) => {
    const data = doc.data();
    const isTest =
      data.createdBy === 'SYSTEM_DUMMY_DATA' ||
      (data.name && data.name.includes('Test')) ||
      (data.firstName && data.firstName.includes('Test')) ||
      (data.lastName && data.lastName.includes('Test')) ||
      (data.mrNumber && data.mrNumber.startsWith('TS-')) ||
      (data.mrNumber && /^MR00\d{4}$/.test(data.mrNumber));

    if (isTest) {
      testPatients.push({ id: doc.id, name: data.name || `${data.firstName} ${data.lastName}`, mrNumber: data.mrNumber, createdBy: data.createdBy });
    } else {
      realPatients.push({ id: doc.id, name: data.name || `${data.firstName} ${data.lastName}` });
    }
  });

  console.log(`Found ${patientsSnapshot.size} total patients:`);
  console.log(`  ${testPatients.length} test patients (will be deleted)`);
  console.log(`  ${realPatients.length} real patients (will be kept)\n`);

  if (realPatients.length > 0) {
    console.log('Real patients (KEPT):');
    realPatients.forEach((p) => console.log(`  - ${p.name} (${p.id})`));
    console.log('');
  }

  if (testPatients.length === 0) {
    console.log('No test patients found. Nothing to clean up.');
    return;
  }

  console.log('Test patients (TO DELETE):');
  testPatients.forEach((p) => console.log(`  - ${p.name} [MRN: ${p.mrNumber}] (${p.id}) createdBy: ${p.createdBy || 'N/A'}`));
  console.log('');

  // Delete test patient visits and the patients themselves
  let deletedVisits = 0;
  let deletedPatients = 0;
  let deletedDocs = 0;

  for (const patient of testPatients) {
    // Delete visits subcollection
    const visitsRef = patientsRef.doc(patient.id).collection('visits');
    const visitsSnapshot = await visitsRef.get();

    if (!visitsSnapshot.empty) {
      for (const visitDoc of visitsSnapshot.docs) {
        console.log(`  Delete visit: ${patient.name} / ${visitDoc.id}`);
        if (!DRY_RUN) {
          await visitDoc.ref.delete();
        }
        deletedVisits++;
      }
    }

    // Delete patient document
    console.log(`  Delete patient: ${patient.name} (${patient.id})`);
    if (!DRY_RUN) {
      await patientsRef.doc(patient.id).delete();
    }
    deletedPatients++;
  }

  // Delete generated documents for test patients
  const genDocsRef = db.collection(`organizations/${ORG_ID}/generatedDocuments`);
  const genDocsSnapshot = await genDocsRef.get();
  const testPatientIds = new Set(testPatients.map((p) => p.id));

  genDocsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (testPatientIds.has(data.patientId)) {
      console.log(`  Delete generated doc: ${doc.id} (patient: ${data.patientId})`);
      if (!DRY_RUN) {
        doc.ref.delete();
      }
      deletedDocs++;
    }
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Summary${DRY_RUN ? ' (DRY RUN)' : ''}:`);
  console.log(`    Patients deleted: ${deletedPatients}`);
  console.log(`    Visits deleted: ${deletedVisits}`);
  console.log(`    Generated docs deleted: ${deletedDocs}`);
  console.log('═══════════════════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('\nTo execute deletions, run: node scripts/cleanupTestData.js --confirm');
  }
}

cleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
