// Run this ONCE to add new fields to existing patients
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function migratePatients() {
  const orgId = 'org_parrish';
  const patientsRef = db.collection('organizations').doc(orgId).collection('patients');
  const snapshot = await patientsRef.get();
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Only update if new fields don't exist
    if (data.startingBenefitPeriod === undefined) {
      batch.update(doc.ref, {
        startingBenefitPeriod: 1,  // Default to Period 1
        isReadmission: false,
        priorHospiceDays: 0,
        f2fRequired: false,
        f2fCompleted: false,
        f2fDate: null,
        f2fPhysician: ''
      });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Migrated ${count} patients`);
  } else {
    console.log('No patients needed migration');
  }
}

migratePatients().then(() => process.exit(0));