/**
 * scripts/addDummyPatients.js
 * 
 * Add realistic test patients to your database
 * Covers various scenarios for testing compliance tracking
 * 
 * USAGE: node scripts/addDummyPatients.js
 */

const admin = require('firebase-admin');

// Initialize without service account - uses Firebase CLI credentials
admin.initializeApp({
  projectId: 'parrish-harmonyhca'
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Helper to create dates
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return admin.firestore.Timestamp.fromDate(date);
}

function yearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return admin.firestore.Timestamp.fromDate(date);
}

// Dummy patients with various scenarios
const dummyPatients = [
  // ============ CRITICAL SCENARIOS ============
  
  // Patient 1: Period 1, Certification ending in 3 days (CRITICAL)
  {
    name: 'Smith, John A.',
    mrNumber: 'MR001234',
    dateOfBirth: yearsAgo(68),
    admissionDate: daysAgo(87),
    startOfCare: daysAgo(87),
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: 0,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(72),
    huv2Completed: false,
    attendingPhysician: 'Dr. Anderson, Michael',
    status: 'active'
  },

  // Patient 2: Period 3 (60-day), F2F overdue (CRITICAL)
  {
    name: 'Johnson, Mary B.',
    mrNumber: 'MR005678',
    dateOfBirth: yearsAgo(78),
    admissionDate: daysAgo(245),
    startOfCare: daysAgo(245),
    startingBenefitPeriod: 3,
    isReadmission: false,
    priorHospiceDays: 180,
    f2fRequired: true,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(230),
    huv2Completed: true,
    huv2Date: daysAgo(215),
    attendingPhysician: 'Dr. Chen, Susan',
    status: 'active'
  },

  // Patient 3: Readmission, Period 1, F2F needed (HIGH)
  {
    name: 'Williams, Robert C.',
    mrNumber: 'MR009012',
    dateOfBirth: yearsAgo(72),
    admissionDate: daysAgo(45),
    startOfCare: daysAgo(45),
    startingBenefitPeriod: 1,
    isReadmission: true,
    priorHospiceDays: 120,
    f2fRequired: true,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(30),
    huv2Completed: false,
    attendingPhysician: 'Dr. Wilson, Sarah',
    status: 'active'
  },

  // Patient 4: Period 2, Cert in 10 days, HUV overdue (HIGH)
  {
    name: 'Davis, Patricia D.',
    mrNumber: 'MR003456',
    dateOfBirth: yearsAgo(81),
    admissionDate: daysAgo(170),
    startOfCare: daysAgo(170),
    startingBenefitPeriod: 2,
    isReadmission: false,
    priorHospiceDays: 90,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(155),
    huv2Completed: false,
    attendingPhysician: 'Dr. Martinez, Carlos',
    status: 'active'
  },

  // ============ NORMAL/CURRENT SCENARIOS ============

  // Patient 5: Just admitted (NORMAL)
  {
    name: 'Martinez, Thomas G.',
    mrNumber: 'MR008901',
    dateOfBirth: yearsAgo(70),
    admissionDate: daysAgo(5),
    startOfCare: daysAgo(5),
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: 0,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: false,
    huv2Completed: false,
    attendingPhysician: 'Dr. Lee, Jennifer',
    status: 'active'
  },

  // Patient 6: Period 3, everything current (NORMAL)
  {
    name: 'Rodriguez, Nancy H.',
    mrNumber: 'MR004567',
    dateOfBirth: yearsAgo(80),
    admissionDate: daysAgo(210),
    startOfCare: daysAgo(210),
    startingBenefitPeriod: 3,
    isReadmission: false,
    priorHospiceDays: 180,
    f2fRequired: true,
    f2fCompleted: true,
    f2fDate: daysAgo(35),
    f2fPhysician: 'Dr. Brown, David',
    huv1Completed: true,
    huv1Date: daysAgo(195),
    huv2Completed: true,
    huv2Date: daysAgo(180),
    attendingPhysician: 'Dr. Brown, David',
    status: 'active'
  },

  // Patient 7: Mid-Period 1, HUV1 window (NORMAL)
  {
    name: 'Garcia, Michael I.',
    mrNumber: 'MR007890',
    dateOfBirth: yearsAgo(65),
    admissionDate: daysAgo(10),
    startOfCare: daysAgo(10),
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: 0,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: false,
    huv2Completed: false,
    attendingPhysician: 'Dr. Patel, Raj',
    status: 'active'
  },

  // Patient 8: Period 2, mid-cycle (NORMAL)
  {
    name: 'Anderson, Barbara J.',
    mrNumber: 'MR009123',
    dateOfBirth: yearsAgo(88),
    admissionDate: daysAgo(135),
    startOfCare: daysAgo(135),
    startingBenefitPeriod: 2,
    isReadmission: false,
    priorHospiceDays: 90,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(120),
    huv2Completed: true,
    huv2Date: daysAgo(105),
    attendingPhysician: 'Dr. Thompson, Emily',
    status: 'active'
  },

  // Patient 9: Period 4 (60-day), F2F completed (NORMAL)
  {
    name: 'Taylor, James K.',
    mrNumber: 'MR002345',
    dateOfBirth: yearsAgo(76),
    admissionDate: daysAgo(285),
    startOfCare: daysAgo(285),
    startingBenefitPeriod: 4,
    isReadmission: false,
    priorHospiceDays: 240,
    f2fRequired: true,
    f2fCompleted: true,
    f2fDate: daysAgo(20),
    f2fPhysician: 'Dr. Wilson, Sarah',
    huv1Completed: true,
    huv1Date: daysAgo(270),
    huv2Completed: true,
    huv2Date: daysAgo(255),
    attendingPhysician: 'Dr. Wilson, Sarah',
    status: 'active'
  },

  // Patient 10: Readmission Period 2 (NORMAL)
  {
    name: 'White, Sarah L.',
    mrNumber: 'MR005432',
    dateOfBirth: yearsAgo(73),
    admissionDate: daysAgo(60),
    startOfCare: daysAgo(60),
    startingBenefitPeriod: 2,
    isReadmission: true,
    priorHospiceDays: 45,
    f2fRequired: true,
    f2fCompleted: true,
    f2fDate: daysAgo(55),
    f2fPhysician: 'Dr. Kim, Helen',
    huv1Completed: true,
    huv1Date: daysAgo(45),
    huv2Completed: false,
    attendingPhysician: 'Dr. Kim, Helen',
    status: 'active'
  },

  // ============ DISCHARGED PATIENTS (for testing filters) ============

  // Patient 11: Recently discharged - deceased
  {
    name: 'Brown, Edward M.',
    mrNumber: 'MR006789',
    dateOfBirth: yearsAgo(82),
    admissionDate: daysAgo(60),
    startOfCare: daysAgo(60),
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: 0,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(45),
    huv2Completed: false,
    dischargeDate: daysAgo(3),
    dischargeReason: 'Deceased',
    attendingPhysician: 'Dr. Anderson, Michael',
    status: 'discharged'
  },

  // Patient 12: Discharged - revoked
  {
    name: 'Miller, Linda N.',
    mrNumber: 'MR007654',
    dateOfBirth: yearsAgo(67),
    admissionDate: daysAgo(30),
    startOfCare: daysAgo(30),
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: 0,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: false,
    huv2Completed: false,
    dischargeDate: daysAgo(7),
    dischargeReason: 'Revoked - Patient Choice',
    attendingPhysician: 'Dr. Lee, Jennifer',
    status: 'discharged'
  },

  // ============ EDGE CASES ============

  // Patient 13: Very long stay - Period 6
  {
    name: 'Wilson, Charles O.',
    mrNumber: 'MR008765',
    dateOfBirth: yearsAgo(91),
    admissionDate: daysAgo(420),
    startOfCare: daysAgo(420),
    startingBenefitPeriod: 6,
    isReadmission: false,
    priorHospiceDays: 360,
    f2fRequired: true,
    f2fCompleted: true,
    f2fDate: daysAgo(25),
    f2fPhysician: 'Dr. Chen, Susan',
    huv1Completed: true,
    huv1Date: daysAgo(405),
    huv2Completed: true,
    huv2Date: daysAgo(390),
    attendingPhysician: 'Dr. Chen, Susan',
    status: 'active'
  },

  // Patient 14: Young patient
  {
    name: 'Young, Emily R.',
    mrNumber: 'MR009876',
    dateOfBirth: yearsAgo(42),
    admissionDate: daysAgo(15),
    startOfCare: daysAgo(15),
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: 0,
    f2fRequired: false,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(5),
    huv2Completed: false,
    attendingPhysician: 'Dr. Martinez, Carlos',
    status: 'active'
  },

  // Patient 15: Multiple readmission, high prior days
  {
    name: 'Thompson, George P.',
    mrNumber: 'MR001111',
    dateOfBirth: yearsAgo(85),
    admissionDate: daysAgo(20),
    startOfCare: daysAgo(20),
    startingBenefitPeriod: 1,
    isReadmission: true,
    priorHospiceDays: 275,
    f2fRequired: true,
    f2fCompleted: false,
    huv1Completed: true,
    huv1Date: daysAgo(8),
    huv2Completed: false,
    attendingPhysician: 'Dr. Patel, Raj',
    status: 'active'
  }
];

async function addDummyPatients() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ADDING DUMMY PATIENTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const orgId = 'org_parrish';
  const userId = 'SYSTEM_DUMMY_DATA';

  try {
    console.log(`Adding ${dummyPatients.length} test patients to organization: ${orgId}\n`);

    const batch = db.batch();
    const patientsRef = db.collection('organizations').doc(orgId).collection('patients');

    let addedCount = 0;

    for (const patientData of dummyPatients) {
      // Create patient document
      const patientRef = patientsRef.doc();
      
      const patient = {
        ...patientData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: userId,
        updatedBy: userId
      };

      batch.set(patientRef, patient);
      addedCount++;

      console.log(`✅ Queued: ${patientData.name} (${patientData.mrNumber})`);
      console.log(`   Period ${patientData.startingBenefitPeriod}, ${patientData.isReadmission ? 'Readmission' : 'New'}, ${patientData.status}`);
    }

    console.log('\n📝 Committing batch write...');
    await batch.commit();

    console.log(`\n✅ Successfully added ${addedCount} patients!\n`);

    // Show summary
    console.log('📊 Patient Summary:');
    const activeCount = dummyPatients.filter(p => p.status === 'active').length;
    const dischargedCount = dummyPatients.filter(p => p.status === 'discharged').length;
    const readmissionCount = dummyPatients.filter(p => p.isReadmission).length;
    const f2fRequiredCount = dummyPatients.filter(p => p.f2fRequired).length;

    console.log(`   Active: ${activeCount}`);
    console.log(`   Discharged: ${dischargedCount}`);
    console.log(`   Readmissions: ${readmissionCount}`);
    console.log(`   F2F Required: ${f2fRequiredCount}`);

    console.log('\n📋 Benefit Period Distribution:');
    const periodCounts = {};
    dummyPatients.forEach(p => {
      if (p.status === 'active') {
        periodCounts[p.startingBenefitPeriod] = (periodCounts[p.startingBenefitPeriod] || 0) + 1;
      }
    });
    Object.entries(periodCounts).sort(([a], [b]) => a - b).forEach(([period, count]) => {
      console.log(`   Period ${period}: ${count} patient(s)`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('   1. Login to your Harmony app');
    console.log('   2. Check the Dashboard for urgent attention items');
    console.log('   3. Navigate to Patients page to see all test data');
    console.log('   4. Test certifications, HUV, and F2F tracking\n');

    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR adding patients:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the script
addDummyPatients()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });