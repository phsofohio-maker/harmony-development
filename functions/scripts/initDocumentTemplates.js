/**
 * scripts/initDocumentTemplates.js
 * Initialize ALL document template configurations in Firestore
 * 
 * Templates: 60DAY, 90DAY_INITIAL, 90DAY_SECOND, ATTEND_CERT, 
 *            PROGRESS_NOTE, PATIENT_HISTORY, F2F_ENCOUNTER
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'parrish-harmonyhca.firebasestorage.app'
});

const db = admin.firestore();

const TEMPLATES = {
  // ============ 60-Day Certification (Period 3+) ============
  '60DAY': {
    name: '60-Day Certification',
    description: 'Subsequent 60-day benefit period certification',
    documentType: '60DAY',
    applicablePeriods: ['Period 3', 'Period 4', 'Period 5+'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'HOSPICE CERTIFICATION/RECERTIFICATION',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'currentPeriod'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'I certify that {{patientName}} is terminally ill with a prognosis of six months or less if the illness runs its normal course.',
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'benefitPeriod',
        fields: ['periodNumber', 'periodStart', 'periodEnd', 'certificationDue'],
        style: { fontSize: 11 }
      },
      {
        type: 'signatureBlock',
        signers: ['physician', 'medicalDirector'],
        style: { marginTop: 40 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ 90-Day Initial Certification (Period 1) ============
  '90DAY_INITIAL': {
    name: '90-Day Initial Certification',
    description: 'Initial 90-day benefit period certification',
    documentType: '90DAY_INITIAL',
    applicablePeriods: ['Period 1'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'INITIAL HOSPICE CERTIFICATION',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'admissionDate', 'diagnosis'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'I certify that {{patientName}} is terminally ill with a medical prognosis of six months or less if the terminal illness runs its normal course. This certification is for the initial 90-day benefit period.',
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'attendingPhysician',
        fields: ['attendingName', 'npi', 'specialty'],
        style: { fontSize: 11, marginTop: 15 }
      },
      {
        type: 'signatureBlock',
        signers: ['attendingPhysician', 'hospiceMedicalDirector'],
        style: { marginTop: 40 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ 90-Day Second Certification (Period 2) ============
  '90DAY_SECOND': {
    name: '90-Day Second Certification',
    description: 'Second 90-day benefit period certification',
    documentType: '90DAY_SECOND',
    applicablePeriods: ['Period 2'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'HOSPICE RECERTIFICATION - SECOND BENEFIT PERIOD',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'currentPeriod'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'I certify that {{patientName}} continues to be terminally ill with a prognosis of six months or less. This recertification is for the second 90-day benefit period.',
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'signatureBlock',
        signers: ['hospiceMedicalDirector'],
        style: { marginTop: 40 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ Attending Physician Certification (Period 1) ============
  'ATTEND_CERT': {
    name: 'Attending Physician Certification',
    description: 'Certification statement from attending physician',
    documentType: 'ATTEND_CERT',
    applicablePeriods: ['Period 1'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'ATTENDING PHYSICIAN CERTIFICATION STATEMENT',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'admissionDate'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'I, the undersigned attending physician, certify that {{patientName}} is my patient and is terminally ill with a medical prognosis of life expectancy of six months or less if the terminal illness runs its normal course.',
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'paragraph',
        content: 'I understand that the patient has elected hospice care and I agree to participate in the plan of care established by the hospice interdisciplinary team.',
        style: { fontSize: 11, marginTop: 15 }
      },
      {
        type: 'attendingPhysician',
        fields: ['attendingName', 'npi', 'phone', 'fax'],
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'paragraph',
        content: 'Primary Terminal Diagnosis:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'diagnosis',
        style: { fontSize: 11, marginTop: 5 }
      },
      {
        type: 'signatureBlock',
        signers: ['attendingPhysician'],
        style: { marginTop: 40 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ Progress Note (Period 2, Period 3+) ============
  'PROGRESS_NOTE': {
    name: 'Progress Note',
    description: 'Clinical progress documentation',
    documentType: 'PROGRESS_NOTE',
    applicablePeriods: ['Period 2', 'Period 3', 'Period 4', 'Period 5+'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'HOSPICE PROGRESS NOTE',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'currentPeriod'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'Visit Date: {{visitDate}}',
        style: { fontSize: 11, marginTop: 15 }
      },
      {
        type: 'paragraph',
        content: 'SUBJECTIVE:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'subjective',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'OBJECTIVE:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'objective',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'ASSESSMENT:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'assessment',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'PLAN:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'plan',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'signatureBlock',
        signers: ['clinician'],
        style: { marginTop: 30 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ Patient History (Period 1) ============
  'PATIENT_HISTORY': {
    name: 'Patient History',
    description: 'Patient history documentation',
    documentType: 'PATIENT_HISTORY',
    applicablePeriods: ['Period 1'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'PATIENT HISTORY AND PHYSICAL',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'admissionDate', 'diagnosis'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'CHIEF COMPLAINT / REASON FOR HOSPICE ADMISSION:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'chiefComplaint',
        style: { fontSize: 11, marginTop: 5, minHeight: 40 }
      },
      {
        type: 'paragraph',
        content: 'HISTORY OF PRESENT ILLNESS:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'historyPresentIllness',
        style: { fontSize: 11, marginTop: 5, minHeight: 80 }
      },
      {
        type: 'paragraph',
        content: 'PAST MEDICAL HISTORY:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'pastMedicalHistory',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'CURRENT MEDICATIONS:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'medications',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'ALLERGIES:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'allergies',
        style: { fontSize: 11, marginTop: 5 }
      },
      {
        type: 'paragraph',
        content: 'FUNCTIONAL STATUS:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'functionalStatus',
        style: { fontSize: 11, marginTop: 5, minHeight: 40 }
      },
      {
        type: 'signatureBlock',
        signers: ['admittingNurse', 'hospiceMedicalDirector'],
        style: { marginTop: 30 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ Face-to-Face Encounter (Period 3+, Readmissions) ============
  'F2F_ENCOUNTER': {
    name: 'Face-to-Face Encounter',
    description: 'F2F encounter documentation for Period 3+ and readmissions',
    documentType: 'F2F_ENCOUNTER',
    applicablePeriods: ['Period 3', 'Period 4', 'Period 5+', 'Readmission'],
    layout: {
      pageSize: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      orientation: 'portrait'
    },
    header: {
      includeOrgName: true,
      includeDate: true,
      height: 80
    },
    sections: [
      {
        type: 'title',
        content: 'FACE-TO-FACE ENCOUNTER ATTESTATION',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'In accordance with Medicare regulations (42 CFR §418.22), a face-to-face encounter is required prior to recertification for the third benefit period and every subsequent benefit period.',
        style: { fontSize: 10, marginTop: 15, italic: true }
      },
      {
        type: 'paragraph',
        content: 'ENCOUNTER INFORMATION:',
        style: { fontSize: 11, marginTop: 20, bold: true }
      },
      {
        type: 'paragraph',
        content: 'A face-to-face encounter was conducted with {{patientName}} on {{f2fDate}} by {{f2fProvider}}.',
        style: { fontSize: 11, marginTop: 10 }
      },
      {
        type: 'paragraph',
        content: 'Provider performing encounter: {{f2fProvider}}',
        style: { fontSize: 11, marginTop: 10 }
      },
      {
        type: 'paragraph',
        content: 'Provider credentials: {{f2fProviderCredentials}}',
        style: { fontSize: 11, marginTop: 5 }
      },
      {
        type: 'paragraph',
        content: 'CLINICAL FINDINGS SUPPORTING TERMINAL PROGNOSIS:',
        style: { fontSize: 11, marginTop: 20, bold: true }
      },
      {
        type: 'field',
        fieldName: 'clinicalFindings',
        style: { fontSize: 11, marginTop: 5, minHeight: 120 }
      },
      {
        type: 'paragraph',
        content: 'Based on the above clinical findings, I attest that {{patientName}} continues to have a terminal prognosis with a life expectancy of six months or less if the illness runs its normal course.',
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'signatureBlock',
        signers: ['f2fProvider', 'hospiceMedicalDirector'],
        style: { marginTop: 40 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  }
};

async function initTemplates() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  INITIALIZING DOCUMENT TEMPLATES');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const orgId = 'org_parrish';
  const batch = db.batch();
  
  const templateList = Object.entries(TEMPLATES);
  console.log(`Found ${templateList.length} templates to initialize:\n`);
  
  for (const [templateId, template] of templateList) {
    const ref = db.collection('organizations')
      .doc(orgId)
      .collection('documentTemplates')
      .doc(templateId);
    
    batch.set(ref, {
      ...template,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const periods = template.applicablePeriods.join(', ');
    console.log(`  ✓ ${templateId.padEnd(15)} ${template.name}`);
    console.log(`    └─ Periods: ${periods}\n`);
  }
  
  await batch.commit();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ ${templateList.length} TEMPLATES INITIALIZED SUCCESSFULLY`);
  console.log('═══════════════════════════════════════════════════════\n');
}

initTemplates()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });