/**
 * functions/addDummyPatients.js
 * 
 * Cloud Function to add dummy patients for testing
 * 
 * DEPLOYMENT:
 * Add this to your functions/index.js or create as separate file
 * 
 * USAGE:
 * firebase functions:call addDummyPatients --data='{"orgId":"org_parrish"}'
 * 
 * Or from your app:
 * const addDummyPatients = httpsCallable(functions, 'addDummyPatients');
 * await addDummyPatients({ orgId: 'org_parrish' });
 */

const { onCall } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();

exports.addDummyPatients = onCall(async (request) => {
  const { orgId } = request.data;
  const userId = request.auth?.uid || 'SYSTEM_DUMMY_DATA';
  
  // Validate organization access
  if (!orgId) {
    throw new Error('Organization ID required');
  }

  // Only allow admins/owners to add dummy data
  const role = request.auth?.token?.role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Insufficient permissions. Owner or Admin role required.');
  }

  // Helper to create dates
  const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return Timestamp.fromDate(date);
  };

  const dummyPatients = [
    // CRITICAL - Period 1, Cert ending in 3 days
    {
      name: 'Smith, John A.',
      mrNumber: 'MR001234',
      dateOfBirth: daysAgo(24820),
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

    // CRITICAL - Period 3 (60-day), F2F overdue
    {
      name: 'Johnson, Mary B.',
      mrNumber: 'MR005678',
      dateOfBirth: daysAgo(28470),
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

    // HIGH - Period 2, Cert in 10 days, HUV overdue
    {
      name: 'Williams, Robert C.',
      mrNumber: 'MR009012',
      dateOfBirth: daysAgo(26280),
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
      attendingPhysician: 'Dr. Patel, Rajesh',
      status: 'active'
    },

    // HIGH - Readmission, F2F pending
    {
      name: 'Brown, Patricia D.',
      mrNumber: 'MR003456',
      dateOfBirth: daysAgo(30660),
      admissionDate: daysAgo(15),
      startOfCare: daysAgo(15),
      startingBenefitPeriod: 2,
      isReadmission: true,
      priorHospiceDays: 45,
      f2fRequired: true,
      f2fCompleted: false,
      huv1Completed: false,
      huv2Completed: false,
      attendingPhysician: 'Dr. Martinez, Carlos',
      status: 'active'
    },

    // MEDIUM - Period 1, mid-cycle
    {
      name: 'Davis, Michael E.',
      mrNumber: 'MR007890',
      dateOfBirth: daysAgo(23360),
      admissionDate: daysAgo(45),
      startOfCare: daysAgo(45),
      startingBenefitPeriod: 1,
      isReadmission: false,
      priorHospiceDays: 0,
      f2fRequired: false,
      f2fCompleted: false,
      huv1Completed: true,
      huv1Date: daysAgo(31),
      huv2Completed: false,
      attendingPhysician: 'Dr. Thompson, James',
      status: 'active'
    },

    // MEDIUM - Period 4, F2F completed
    {
      name: 'Garcia, Linda F.',
      mrNumber: 'MR002345',
      dateOfBirth: daysAgo(27010),
      admissionDate: daysAgo(330),
      startOfCare: daysAgo(330),
      startingBenefitPeriod: 4,
      isReadmission: false,
      priorHospiceDays: 270,
      f2fRequired: true,
      f2fCompleted: true,
      f2fDate: daysAgo(50),
      f2fPhysician: 'Dr. Wilson, Sarah',
      huv1Completed: true,
      huv1Date: daysAgo(315),
      huv2Completed: true,
      huv2Date: daysAgo(300),
      attendingPhysician: 'Dr. Wilson, Sarah',
      status: 'active'
    },

    // NORMAL - Just admitted
    {
      name: 'Martinez, Thomas G.',
      mrNumber: 'MR008901',
      dateOfBirth: daysAgo(25550),
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

    // NORMAL - Period 3, everything current
    {
      name: 'Rodriguez, Nancy H.',
      mrNumber: 'MR004567',
      dateOfBirth: daysAgo(29200),
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

    // DISCHARGED - For testing filters
    {
      name: 'Taylor, James I.',
      mrNumber: 'MR006789',
      dateOfBirth: daysAgo(27740),
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
      attendingPhysician: 'Dr. Kim, Helen',
      status: 'discharged'
    },

    // CRITICAL - Period 5, multiple issues
    {
      name: 'Anderson, Barbara J.',
      mrNumber: 'MR009123',
      dateOfBirth: daysAgo(32120),
      admissionDate: daysAgo(354),
      startOfCare: daysAgo(354),
      startingBenefitPeriod: 5,
      isReadmission: false,
      priorHospiceDays: 300,
      f2fRequired: true,
      f2fCompleted: false,
      huv1Completed: true,
      huv1Date: daysAgo(339),
      huv2Completed: true,
      huv2Date: daysAgo(324),
      attendingPhysician: 'Dr. Singh, Amar',
      status: 'active'
    }
  ];

  const results = {
    success: [],
    failed: []
  };

  // Add each patient
  for (const patientData of dummyPatients) {
    try {
      const patientsRef = db.collection('organizations')
        .doc(orgId)
        .collection('patients');
      
      const fullPatientData = {
        ...patientData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId,
        updatedBy: userId
      };

      const docRef = await patientsRef.add(fullPatientData);
      
      results.success.push({
        id: docRef.id,
        name: patientData.name,
        mrNumber: patientData.mrNumber
      });
    } catch (error) {
      results.failed.push({
        name: patientData.name,
        error: error.message
      });
    }
  }

  return {
    message: `Added ${results.success.length} of ${dummyPatients.length} dummy patients`,
    summary: {
      total: dummyPatients.length,
      successful: results.success.length,
      failed: results.failed.length
    },
    results
  };
});