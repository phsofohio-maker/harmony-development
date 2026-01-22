/**
 * patientImportExport.js - Patient Data Import/Export Functions
 * 
 * Export: Returns patient data as JSON (CSV conversion done client-side)
 * Import: Validates and batch imports patients from CSV/JSON
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Fields allowed for export/import
const PATIENT_FIELDS = [
  'name',
  'mrNumber', 
  'dateOfBirth',
  'admissionDate',
  'startOfCare',
  'attendingPhysician',
  'startingBenefitPeriod',
  'isReadmission',
  'priorHospiceDays',
  'f2fRequired',
  'f2fCompleted',
  'f2fDate',
  'f2fPhysician',
  'huv1Completed',
  'huv1Date',
  'huv2Completed',
  'huv2Date',
  'status',
  'notes',
];

/**
 * Export patients for the organization
 */
exports.exportPatients = onCall(
  { 
    region: 'us-central1',
    invoker: 'public',
    timeoutSeconds: 120,
  },
  async (request) => {
    const db = getFirestore();
    
    const userId = request.auth?.uid;
    const orgId = request.auth?.token?.orgId;
    const userRole = request.auth?.token?.role;

    // Validate authentication
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!orgId) {
      throw new HttpsError('permission-denied', 'No organization access');
    }

    // Only owners, admins, and staff can export
    if (!['owner', 'admin', 'staff'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions');
    }

    const { format = 'json', includeInactive = false } = request.data || {};

    try {
      // Build query
      let query = db.collection('organizations').doc(orgId).collection('patients');
      
      if (!includeInactive) {
        query = query.where('status', '==', 'active');
      }

      const snapshot = await query.get();

      const patients = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Build clean export object
        const patient = { id: doc.id };
        
        PATIENT_FIELDS.forEach(field => {
          if (data[field] !== undefined) {
            // Convert Timestamps to ISO strings
            if (data[field]?.toDate) {
              patient[field] = data[field].toDate().toISOString().split('T')[0];
            } else if (data[field] instanceof Date) {
              patient[field] = data[field].toISOString().split('T')[0];
            } else {
              patient[field] = data[field];
            }
          }
        });

        return patient;
      });

      console.log(`Exported ${patients.length} patients for org ${orgId}`);

      return {
        success: true,
        count: patients.length,
        exportedAt: new Date().toISOString(),
        patients: patients,
        fields: PATIENT_FIELDS,
      };

    } catch (error) {
      console.error('Error exporting patients:', error);
      throw new HttpsError('internal', 'Failed to export patients');
    }
  }
);

/**
 * Import patients from CSV/JSON data
 */
exports.importPatients = onCall(
  { 
    region: 'us-central1',
    invoker: 'public',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    const db = getFirestore();
    
    const userId = request.auth?.uid;
    const orgId = request.auth?.token?.orgId;
    const userRole = request.auth?.token?.role;

    // Validate authentication
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!orgId) {
      throw new HttpsError('permission-denied', 'No organization access');
    }

    // Only owners and admins can import
    if (userRole !== 'owner' && userRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Only owners and admins can import patients');
    }

    const { patients, mode = 'add' } = request.data;

    if (!patients || !Array.isArray(patients)) {
      throw new HttpsError('invalid-argument', 'Patients array is required');
    }

    if (patients.length === 0) {
      throw new HttpsError('invalid-argument', 'No patients to import');
    }

    if (patients.length > 500) {
      throw new HttpsError('invalid-argument', 'Maximum 500 patients per import');
    }

    if (!['add', 'update', 'replace'].includes(mode)) {
      throw new HttpsError('invalid-argument', 'Mode must be add, update, or replace');
    }

    console.log(`Importing ${patients.length} patients for org ${orgId} (mode: ${mode})`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const patientsRef = db.collection('organizations').doc(orgId).collection('patients');
      const batch = db.batch();
      let batchCount = 0;
      const maxBatchSize = 500;

      for (let i = 0; i < patients.length; i++) {
        const patient = patients[i];
        const rowNum = i + 1;

        try {
          // Validate required fields
          if (!patient.name || patient.name.trim() === '') {
            results.errors.push({ row: rowNum, error: 'Name is required' });
            results.failed++;
            continue;
          }

          // Clean and validate patient data
          const cleanedPatient = cleanPatientData(patient);

          // Check for existing patient by MR number (if provided)
          let docRef;
          let existingDoc = null;

          if (patient.mrNumber && mode !== 'add') {
            const existingQuery = await patientsRef
              .where('mrNumber', '==', patient.mrNumber)
              .limit(1)
              .get();
            
            if (!existingQuery.empty) {
              existingDoc = existingQuery.docs[0];
              docRef = existingDoc.ref;
            }
          }

          if (mode === 'add' && existingDoc) {
            results.errors.push({ 
              row: rowNum, 
              error: `Patient with MR# ${patient.mrNumber} already exists`,
              name: patient.name 
            });
            results.skipped++;
            continue;
          }

          if (mode === 'update' && !existingDoc) {
            results.errors.push({ 
              row: rowNum, 
              error: `Patient with MR# ${patient.mrNumber} not found`,
              name: patient.name 
            });
            results.skipped++;
            continue;
          }

          // Prepare document data
          const docData = {
            ...cleanedPatient,
            organizationId: orgId,
            updatedAt: Timestamp.now(),
            updatedBy: userId,
          };

          if (!existingDoc) {
            // New patient
            docData.createdAt = Timestamp.now();
            docData.createdBy = userId;
            docRef = patientsRef.doc();
          }

          batch.set(docRef, docData, { merge: mode === 'update' });
          batchCount++;
          results.success++;

          // Commit batch if at limit
          if (batchCount >= maxBatchSize) {
            await batch.commit();
            batchCount = 0;
          }

        } catch (rowError) {
          results.errors.push({ 
            row: rowNum, 
            error: rowError.message,
            name: patient.name 
          });
          results.failed++;
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`Import complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

      return {
        success: true,
        ...results,
      };

    } catch (error) {
      console.error('Error importing patients:', error);
      throw new HttpsError('internal', 'Failed to import patients: ' + error.message);
    }
  }
);

/**
 * Clean and validate patient data for import
 */
function cleanPatientData(patient) {
  const cleaned = {};

  // String fields
  if (patient.name) cleaned.name = patient.name.trim();
  if (patient.mrNumber) cleaned.mrNumber = patient.mrNumber.toString().trim();
  if (patient.attendingPhysician) cleaned.attendingPhysician = patient.attendingPhysician.trim();
  if (patient.f2fPhysician) cleaned.f2fPhysician = patient.f2fPhysician.trim();
  if (patient.notes) cleaned.notes = patient.notes.trim();

  // Date fields
  const dateFields = ['dateOfBirth', 'admissionDate', 'startOfCare', 'f2fDate', 'huv1Date', 'huv2Date'];
  dateFields.forEach(field => {
    if (patient[field]) {
      const date = parseDate(patient[field]);
      if (date) {
        cleaned[field] = Timestamp.fromDate(date);
      }
    }
  });

  // Number fields
  if (patient.startingBenefitPeriod !== undefined) {
    const period = parseInt(patient.startingBenefitPeriod);
    if (!isNaN(period) && period >= 1) {
      cleaned.startingBenefitPeriod = period;
    }
  }

  if (patient.priorHospiceDays !== undefined) {
    const days = parseInt(patient.priorHospiceDays);
    if (!isNaN(days) && days >= 0) {
      cleaned.priorHospiceDays = days;
    }
  }

  // Boolean fields
  const boolFields = ['isReadmission', 'f2fRequired', 'f2fCompleted', 'huv1Completed', 'huv2Completed'];
  boolFields.forEach(field => {
    if (patient[field] !== undefined) {
      cleaned[field] = parseBoolean(patient[field]);
    }
  });

  // Status field
  if (patient.status) {
    const status = patient.status.toLowerCase().trim();
    if (['active', 'discharged', 'deceased', 'revoked', 'transferred'].includes(status)) {
      cleaned.status = status;
    }
  }

  // Default status for new patients
  if (!cleaned.status) {
    cleaned.status = 'active';
  }

  return cleaned;
}

/**
 * Parse various date formats
 */
function parseDate(value) {
  if (!value) return null;
  
  // Already a Date
  if (value instanceof Date) return value;
  
  // Timestamp
  if (value?.toDate) return value.toDate();
  
  // String formats
  if (typeof value === 'string') {
    // ISO format: 2024-01-15
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date)) return date;
    }
    
    // US format: 01/15/2024 or 1/15/2024
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      const [month, day, year] = value.split('/');
      const date = new Date(year, month - 1, day);
      if (!isNaN(date)) return date;
    }
  }
  
  return null;
}

/**
 * Parse boolean values
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return ['true', 'yes', '1', 'y'].includes(lower);
  }
  if (typeof value === 'number') return value === 1;
  return false;
}