const { onCall } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { google } = require('googleapis');

// Initialize if not already done
try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();
const storage = getStorage();

/**
 * Generate certification documents
 * 
 * @param {Object} data
 * @param {string} data.patientId - Patient document ID
 * @param {string} data.documentType - Template type (60DAY, 90DAY_INITIAL, etc.)
 * @param {Object} data.customData - Optional additional data to merge
 * 
 * @returns {Object} Generated document info with download URL
 */
exports.generateCertificationDocs = onCall(async (request) => {
  const { patientId, documentType, customData = {} } = request.data;
  const userId = request.auth?.uid;
  const orgId = request.auth?.token?.orgId;

  // Validate input
  if (!patientId || !documentType) {
    throw new Error('Missing required parameters: patientId and documentType');
  }

  if (!orgId) {
    throw new Error('User does not have organization access');
  }

  try {
    // 1. Fetch patient data
    const patientDoc = await db.collection('patients').doc(patientId).get();
    if (!patientDoc.exists) {
      throw new Error('Patient not found');
    }
    const patient = patientDoc.data();

    // Verify patient belongs to user's organization
    if (patient.organizationId !== orgId) {
      throw new Error('Unauthorized access to patient');
    }

    // 2. Get template ID from organization settings
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const templates = orgDoc.data()?.settings?.documentTemplates || {};
    const templateId = templates[documentType];

    if (!templateId) {
      throw new Error(`Template not configured for ${documentType}`);
    }

    // 3. Prepare merge data
    const mergeData = prepareMergeData(patient, documentType, customData);

    // 4. Generate document
    const auth = await getServiceAccountAuth();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Copy template
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `${documentType}_${patient.name}_${new Date().toISOString().split('T')[0]}`
      }
    });
    const newDocId = copyResponse.data.id;

    // Get document content
    const docResponse = await docs.documents.get({ documentId: newDocId });

    // Prepare batch update requests
    const requests = createReplaceRequests(docResponse.data, mergeData);

    // Apply replacements
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: newDocId,
        requestBody: { requests }
      });
    }

    // 5. Export as PDF
    const pdfResponse = await drive.files.export({
      fileId: newDocId,
      mimeType: 'application/pdf'
    }, {
      responseType: 'stream'
    });

    // 6. Upload to Cloud Storage
    const fileName = `documents/${orgId}/${patientId}/${documentType}_${Date.now()}.pdf`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await new Promise((resolve, reject) => {
      pdfResponse.data
        .pipe(file.createWriteStream({
          metadata: {
            contentType: 'application/pdf',
            metadata: {
              patientId,
              documentType,
              generatedBy: userId,
              generatedAt: new Date().toISOString()
            }
          }
        }))
        .on('error', reject)
        .on('finish', resolve);
    });

    // Get signed URL (valid for 7 days)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // 7. Log in Firestore history
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

    // Clean up temporary Google Doc (optional)
    // await drive.files.delete({ fileId: newDocId });

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
  }
});

/**
 * Get service account authentication for Google APIs
 */
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

/**
 * Create replace requests for Google Docs API
 */
function createReplaceRequests(document, mergeData) {
  const requests = [];

  // Find all merge fields in document
  const content = document.body.content;
  const textRuns = extractTextRuns(content);

  // Create replacement requests for each merge field
  Object.entries(mergeData).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    
    textRuns.forEach(textRun => {
      if (textRun.text.includes(placeholder)) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: placeholder,
              matchCase: true
            },
            replaceText: String(value || '')
          }
        });
      }
    });
  });

  return requests;
}

/**
 * Extract text runs from document content
 */
function extractTextRuns(content, runs = []) {
  if (!content) return runs;

  content.forEach(element => {
    if (element.paragraph?.elements) {
      element.paragraph.elements.forEach(el => {
        if (el.textRun?.content) {
          runs.push({ text: el.textRun.content });
        }
      });
    }
    if (element.table?.tableRows) {
      element.table.tableRows.forEach(row => {
        row.tableCells?.forEach(cell => {
          extractTextRuns(cell.content, runs);
        });
      });
    }
  });

  return runs;
}

/**
 * Format date helpers
 */
function formatDate(date) {
  if (!date) return '';
  if (date.toDate) date = date.toDate(); // Firestore Timestamp
  if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date)) return '';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  const dob = dateOfBirth.toDate ? dateOfBirth.toDate() : new Date(dateOfBirth);
  const ageDiff = Date.now() - dob.getTime();
  const ageDate = new Date(ageDiff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function calculateTreatmentDuration(admissionDate) {
  if (!admissionDate) return 'unknown duration';
  const admission = admissionDate.toDate ? admissionDate.toDate() : new Date(admissionDate);
  const months = Math.floor((Date.now() - admission.getTime()) / (30 * 24 * 60 * 60 * 1000));
  return months > 0 ? `${months} months` : 'less than 1 month';
}
