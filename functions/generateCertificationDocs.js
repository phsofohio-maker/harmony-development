/**
 * functions/generateCertificationDocs.js
 * FIXED: Deletes temporary Drive files to prevent quota errors
 */
const { onCall } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { google } = require('googleapis');

exports.generateCertificationDocs = onCall(async (request) => {
  console.log('=== generateCertificationDocs called ===');

  // Initialize services
  const db = getFirestore();
  const storage = getStorage();

  const { patientId, documentType, customData = {} } = request.data;
  const userId = request.auth?.uid;
  const orgId = request.auth?.token?.orgId;

  // Validate input
  if (!patientId || !documentType) throw new Error('Missing required parameters');
  if (!orgId) throw new Error('User does not have organization access');

  // Track the temporary Doc ID so we can delete it even if errors occur
  let newDocId = null;
  let drive = null;

  try {
    // 1. Fetch patient data
    const patientDoc = await db.collection('organizations')
      .doc(orgId)
      .collection('patients')
      .doc(patientId)
      .get();
      
    if (!patientDoc.exists) throw new Error('Patient not found');
    const patient = patientDoc.data();

    // 2. Get template ID
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const templates = orgDoc.data()?.settings?.documentTemplates || {};
    const templateId = templates[documentType];
    if (!templateId) throw new Error(`Template not configured for ${documentType}`);

    // 3. Authenticate Google APIs
    const auth = await getServiceAccountAuth();
    const docs = google.docs({ version: 'v1', auth });
    drive = google.drive({ version: 'v3', auth });

    // 4. Copy Template (Creates the temporary file)
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `${documentType}_${patient.name}_${new Date().toISOString().split('T')[0]}`
      }
    });
    newDocId = copyResponse.data.id; // Save ID for cleanup

    // 5. Replace Text
    const mergeData = prepareMergeData(patient, documentType, customData);
    const docResponse = await docs.documents.get({ documentId: newDocId });
    const requests = createReplaceRequests(docResponse.data, mergeData);

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: newDocId,
        requestBody: { requests }
      });
    }

    // 6. Export as PDF
    const pdfResponse = await drive.files.export({
      fileId: newDocId,
      mimeType: 'application/pdf'
    }, {
      responseType: 'stream'
    });

    // 7. Upload to Firebase Storage
    // We explicitly use your bucket here
    const bucket = storage.bucket('parrish-harmonyhca.firebasestorage.app');
    const fileName = `documents/${orgId}/${patientId}/${documentType}_${Date.now()}.pdf`;
    const file = bucket.file(fileName);

    await new Promise((resolve, reject) => {
      pdfResponse.data
        .pipe(file.createWriteStream({
          metadata: {
            contentType: 'application/pdf',
            metadata: {
              patientId,
              documentType,
              generatedBy: userId
            }
          }
        }))
        .on('error', reject)
        .on('finish', resolve);
    });

    // 8. Get Signed URL (for frontend)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // 9. Log in Firestore
    const historyRef = await db.collection('organizations')
      .doc(orgId)
      .collection('documentHistory')
      .add({
        patientId,
        patientName: patient.name,
        documentType,
        fileName,
        downloadUrl: url,
        generatedBy: userId,
        generatedAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

    return {
      success: true,
      documentId: historyRef.id,
      fileName,
      downloadUrl: url,
      message: `${documentType} generated successfully`
    };

  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(`Failed to generate document: ${error.message}`);
  } finally {
    // === CRITICAL FIX: CLEANUP ===
    // This runs whether the function succeeds OR fails, ensuring no junk files.
    if (newDocId && drive) {
      try {
        console.log(`Cleaning up temporary Drive file: ${newDocId}`);
        await drive.files.delete({ fileId: newDocId });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary file:', cleanupError.message);
      }
    }
  }
});

// ... [Keep your existing helper functions below: getServiceAccountAuth, prepareMergeData, etc.] ...
// (Do not remove the helper functions!)
async function getServiceAccountAuth() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
  return auth;
}
/**
 * Prepare merge data based on patient info and document type
 */
function prepareMergeData(patient, documentType, customData) {
  const cti = patient.compliance?.cti || {};
  
  // Base merge fields common to all documents
  const baseData = {
    patientName: patient.name || '',
    dateOfBirth: formatDate(patient.dateOfBirth) || '',
    mrn: patient.medicalRecordNumber || '',
    socDate: formatDate(patient.startOfCareDate) || '',
    admissionDate: formatDate(patient.admissionDate) || '',
    benefitPeriod: cti.periodShortName || '',
    primaryDiagnosis: patient.diagnosis || '',
    certStart: formatDate(cti.certStart) || '',
    certEnd: formatDate(cti.certEnd) || '',
    certificationDate: formatDate(new Date()),
    ...customData
  };

  // Document-specific fields
  switch (documentType) {
    case '60DAY':
      return {
        ...baseData,
        f2fCompleted: cti.f2fCompleted ? 'Yes' : 'No',
        f2fDate: formatDate(cti.f2fDate) || 'Pending',
        f2fProvider: customData.f2fProvider || 'TBD'
      };

    case '90DAY_INITIAL':
    case '90DAY_SECOND':
      return {
        ...baseData,
        priorPeriodDates: cti.priorPeriodDates || 'N/A',
        icd10Code: patient.icd10Code || ''
      };

    case 'ATTEND_CERT':
      return {
        ...baseData,
        attendingPhysicianName: patient.attendingPhysician || '',
        treatmentDuration: calculateTreatmentDuration(patient.admissionDate)
      };

    case 'PROGRESS_NOTE':
      return {
        ...baseData,
        visitDate: formatDate(new Date()),
        providerName: customData.providerName || ''
      };

    case 'PATIENT_HISTORY':
      return {
        ...baseData,
        age: calculateAge(patient.dateOfBirth),
        gender: patient.gender || '',
        referralSource: patient.referralSource || ''
      };

    case 'F2F_ENCOUNTER':
      return {
        ...baseData,
        encounterDate: formatDate(cti.f2fDate) || formatDate(new Date()),
        encounterProvider: customData.encounterProvider || '',
        providerType: customData.providerType || 'Nurse Practitioner',
        recertPeriodDates: `${formatDate(cti.certStart)} - ${formatDate(cti.certEnd)}`
      };

    default:
      return baseData;
  }
}