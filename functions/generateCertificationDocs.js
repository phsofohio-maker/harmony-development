/**
 * functions/generateCertificationDocs.js
 * Complete Document Generation Cloud Function
 */
const { onCall } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { google } = require('googleapis');

exports.generateCertificationDocs = onCall(async (request) => {
  console.log('=== generateCertificationDocs called ===');

  const db = getFirestore();
  const storage = getStorage();

  const { patientId, documentType, customData = {} } = request.data;
  const userId = request.auth?.uid;
  const orgId = request.auth?.token?.orgId;

  // Validate input
  if (!patientId || !documentType) throw new Error('Missing required parameters');
  if (!orgId) throw new Error('User does not have organization access');

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
    const patient = { id: patientDoc.id, ...patientDoc.data() };

    // 2. Get template ID from organization settings
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const templates = orgDoc.data()?.settings?.documentTemplates || {};
    const templateId = templates[documentType];
    
    if (!templateId) {
      throw new Error(`Template not configured for ${documentType}. Please add template ID in Settings.`);
    }

    // 3. Authenticate Google APIs
    const auth = await getServiceAccountAuth();
    const docs = google.docs({ version: 'v1', auth });
    drive = google.drive({ version: 'v3', auth });

    // 4. Copy Template
    const timestamp = new Date().toISOString().split('T')[0];
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `${documentType}_${patient.name}_${timestamp}`
      }
    });
    newDocId = copyResponse.data.id;
    console.log(`Created temporary doc: ${newDocId}`);

    // 5. Replace merge fields with patient data
    const mergeData = prepareMergeData(patient, documentType, customData);
    const docResponse = await docs.documents.get({ documentId: newDocId });
    const requests = createReplaceRequests(docResponse.data, mergeData);

    if (requests.length > 0) {
      console.log(`Applying ${requests.length} replacements...`);
      await docs.documents.batchUpdate({
        documentId: newDocId,
        requestBody: { requests }
      });
    }

    // 6. Export as PDF
    console.log('Exporting to PDF...');
    const pdfResponse = await drive.files.export({
      fileId: newDocId,
      mimeType: 'application/pdf'
    }, {
      responseType: 'stream'
    });

    // 7. Upload to Firebase Storage
    const bucket = storage.bucket();
    const fileName = `documents/${orgId}/${patientId}/${documentType}_${Date.now()}.pdf`;
    const file = bucket.file(fileName);

    await new Promise((resolve, reject) => {
      pdfResponse.data
        .pipe(file.createWriteStream({
          metadata: {
            contentType: 'application/pdf',
            metadata: {
              patientId,
              patientName: patient.name,
              documentType,
              generatedBy: userId,
              generatedAt: new Date().toISOString()
            }
          }
        }))
        .on('error', reject)
        .on('finish', resolve);
    });

    console.log(`PDF uploaded: ${fileName}`);

    // 8. Get signed URL for download
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // 9. Log in Firestore
    const historyRef = await db.collection('organizations')
      .doc(orgId)
      .collection('generatedDocuments')
      .add({
        patientId,
        patientName: patient.name,
        templateType: documentType,
        fileName,
        documentLink: url,
        pdfLink: url,
        downloadUrl: url,
        generatedBy: userId,
        generatedAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

    console.log('✅ Document generation complete');

    return {
      success: true,
      documentId: historyRef.id,
      fileName,
      downloadUrl: url,
      documentLink: url,
      pdfLink: url,
      message: `${documentType} generated successfully`
    };

  } catch (error) {
    console.error('❌ Document generation error:', error);
    throw new Error(`Failed to generate document: ${error.message}`);
    
  } finally {
    // Cleanup temporary Google Doc
    if (newDocId && drive) {
      try {
        console.log(`Cleaning up temporary file: ${newDocId}`);
        await drive.files.delete({ fileId: newDocId });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary file:', cleanupError.message);
      }
    }
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Authenticate with Google APIs using service account
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
 * Prepare merge data for document template
 * Maps patient data to template placeholders
 */
function prepareMergeData(patient, documentType, customData) {
  const cti = patient.compliance?.cti || {};
  const huv = patient.compliance?.huv || {};
  
  // Base data available for all document types
  const baseData = {
    // Patient Info
    PATIENT_NAME: patient.name || '',
    DATE_OF_BIRTH: formatDate(patient.dateOfBirth) || '',
    MRN: patient.mrNumber || '',
    MEDICAL_RECORD_NUMBER: patient.mrNumber || '',
    AGE: calculateAge(patient.dateOfBirth),
    GENDER: patient.gender || '',
    
    // Dates
    SOC_DATE: formatDate(patient.startOfCare) || '',
    START_OF_CARE: formatDate(patient.startOfCare) || '',
    ADMISSION_DATE: formatDate(patient.admissionDate) || '',
    TODAY_DATE: formatDate(new Date()),
    CERTIFICATION_DATE: formatDate(new Date()),
    
    // Period Info
    BENEFIT_PERIOD: cti.periodShortName || `Period ${patient.startingBenefitPeriod || 1}`,
    PERIOD_NUMBER: String(patient.startingBenefitPeriod || 1),
    CERT_START: formatDate(cti.certificationStartDate) || '',
    CERT_END: formatDate(cti.certificationEndDate) || '',
    CERT_DURATION: cti.periodDays || '90',
    
    // Clinical
    PRIMARY_DIAGNOSIS: patient.primaryDiagnosis || '',
    ICD10_CODE: patient.icd10Code || '',
    ATTENDING_PHYSICIAN: patient.attendingPhysician || '',
    
    // Organization
    HOSPICE_NAME: 'Parrish Health Systems',
    HOSPICE_ADDRESS: '1260 S. Main St, Bowling Green, OH 43402',
    HOSPICE_PHONE: '(419) 352-2269',
    
    // Custom data from UI
    ...customData
  };

  // Document-specific fields
  switch (documentType) {
    case '60DAY':
      return {
        ...baseData,
        F2F_REQUIRED: 'Yes',
        F2F_COMPLETED: patient.f2fCompleted ? 'Yes' : 'No',
        F2F_DATE: formatDate(patient.f2fDate) || 'Pending',
        F2F_PHYSICIAN: patient.f2fPhysician || customData.f2fProvider || 'TBD',
        PRIOR_HOSPICE_DAYS: String(patient.priorHospiceDays || 180)
      };

    case '90DAY_INITIAL':
      return {
        ...baseData,
        PERIOD_TYPE: 'Initial',
        EXPECTED_END_DATE: formatDate(addDays(patient.startOfCare, 90)),
        REFERRAL_SOURCE: patient.referralSource || '',
        INITIAL_ASSESSMENT_DATE: formatDate(patient.startOfCare)
      };

    case '90DAY_SECOND':
      return {
        ...baseData,
        PERIOD_TYPE: 'Second',
        PRIOR_PERIOD_START: formatDate(patient.startOfCare),
        PRIOR_PERIOD_END: formatDate(addDays(patient.startOfCare, 90)),
        RECERT_PHYSICIAN: patient.attendingPhysician || ''
      };

    case 'ATTEND_CERT':
      return {
        ...baseData,
        PHYSICIAN_NAME: patient.attendingPhysician || '',
        PHYSICIAN_NPI: customData.physicianNPI || '',
        TREATMENT_DURATION: calculateTreatmentDuration(patient.admissionDate),
        LAST_SEEN_DATE: customData.lastSeenDate || formatDate(new Date())
      };

    case 'PROGRESS_NOTE':
      return {
        ...baseData,
        VISIT_DATE: formatDate(new Date()),
        PROVIDER_NAME: customData.providerName || '',
        PROVIDER_TITLE: customData.providerTitle || 'RN',
        VISIT_TYPE: customData.visitType || 'Routine Visit',
        CLINICAL_NOTES: customData.clinicalNotes || ''
      };

    case 'PATIENT_HISTORY':
      return {
        ...baseData,
        REFERRAL_SOURCE: patient.referralSource || '',
        INSURANCE: patient.insurance || 'Medicare Hospice Benefit',
        EMERGENCY_CONTACT: patient.emergencyContact || '',
        ADVANCE_DIRECTIVES: patient.advanceDirectives || 'On File'
      };

    case 'F2F_ENCOUNTER':
      return {
        ...baseData,
        ENCOUNTER_DATE: formatDate(patient.f2fDate) || formatDate(new Date()),
        ENCOUNTER_PROVIDER: patient.f2fPhysician || customData.encounterProvider || '',
        PROVIDER_TYPE: customData.providerType || 'Physician',
        RECERT_PERIOD: `${formatDate(cti.certificationStartDate)} - ${formatDate(cti.certificationEndDate)}`,
        CLINICAL_FINDINGS: customData.clinicalFindings || '',
        TERMINAL_PROGNOSIS: customData.terminalPrognosis || ''
      };

    default:
      return baseData;
  }
}

/**
 * Create batch replace requests for Google Docs API
 * Finds all {{PLACEHOLDERS}} and replaces them with actual data
 */
function createReplaceRequests(document, mergeData) {
  const requests = [];
  const content = document.body.content;

  // Find all text elements in the document
  const textElements = [];
  function extractText(elements) {
    if (!elements) return;
    for (const element of elements) {
      if (element.paragraph) {
        const para = element.paragraph;
        if (para.elements) {
          for (const elem of para.elements) {
            if (elem.textRun && elem.textRun.content) {
              textElements.push(elem.textRun.content);
            }
          }
        }
      }
      if (element.table) {
        for (const row of element.table.tableRows) {
          for (const cell of row.tableCells) {
            extractText(cell.content);
          }
        }
      }
    }
  }

  extractText(content);

  // Create replace requests for each placeholder found
  Object.entries(mergeData).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const replacement = String(value || '');

    requests.push({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: false
        },
        replaceText: replacement
      }
    });
  });

  return requests;
}

/**
 * Format date as MM/DD/YYYY
 */
function formatDate(date) {
  if (!date) return '';
  
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (date.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date._seconds) {
    d = new Date(date._seconds * 1000);
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '';
  
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${month}/${day}/${year}`;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  
  const dob = dateOfBirth instanceof Date ? dateOfBirth : 
              dateOfBirth.toDate ? dateOfBirth.toDate() : 
              new Date(dateOfBirth);
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return String(age);
}

/**
 * Calculate treatment duration in human-readable format
 */
function calculateTreatmentDuration(admissionDate) {
  if (!admissionDate) return '';
  
  const admission = admissionDate instanceof Date ? admissionDate :
                   admissionDate.toDate ? admissionDate.toDate() :
                   new Date(admissionDate);
  
  const today = new Date();
  const diffTime = Math.abs(today - admission);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    return `${years} year${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} month${months !== 1 ? 's' : ''}` : ''}`;
  }
}

/**
 * Add days to a date
 */
function addDays(date, days) {
  if (!date) return null;
  const d = date instanceof Date ? new Date(date) :
           date.toDate ? date.toDate() :
           new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}