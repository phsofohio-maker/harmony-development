/**
 * scripts/initDocumentTemplates.js
 * Initialize ALL document template configurations in Firestore
 *
 * Templates: CTI, ATTEND_CTI, PROGRESS_NOTE, PHYSICIAN_HP, HOME_VISIT_ASSESSMENT
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'parrish-harmonyhca.firebasestorage.app'
});

const db = admin.firestore();

const TEMPLATES = {
  // ============ CTI Narrative (All Periods) ============
  'CTI': {
    name: 'CTI Narrative',
    description: 'Consolidated certification/recertification narrative for all benefit periods',
    documentType: 'CTI',
    applicablePeriods: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5+'],
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
        content: 'HOSPICE CERTIFICATION / RECERTIFICATION',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'admissionDate', 'currentPeriod', 'diagnosis'],
        style: { fontSize: 11 }
      },
      {
        type: 'benefitPeriod',
        fields: ['periodNumber', 'periodStart', 'periodEnd', 'certificationDue'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'I certify that {{PATIENT_NAME}} is terminally ill with a medical prognosis of six months or less if the terminal illness runs its normal course.',
        style: { fontSize: 11, marginTop: 20 }
      },
      {
        type: 'attendingPhysician',
        fields: ['attendingName', 'npi', 'phone'],
        style: { fontSize: 11, marginTop: 15 }
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

  // ============ Attending Physician CTI (Period 1) ============
  'ATTEND_CTI': {
    name: 'Attending Physician CTI',
    description: 'Attending physician certification statement',
    documentType: 'ATTEND_CTI',
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
        content: 'I, the undersigned attending physician, certify that {{PATIENT_NAME}} is my patient and is terminally ill with a medical prognosis of life expectancy of six months or less if the terminal illness runs its normal course.',
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

  // ============ Physician H&P (Period 1) ============
  'PHYSICIAN_HP': {
    name: 'Physician H&P',
    description: 'Physician history and physical examination',
    documentType: 'PHYSICIAN_HP',
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
        content: 'PHYSICIAN HISTORY AND PHYSICAL',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn', 'admissionDate', 'diagnosis'],
        style: { fontSize: 11 }
      },
      {
        type: 'attendingPhysician',
        fields: ['attendingName', 'npi'],
        style: { fontSize: 11, marginTop: 15 }
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
        fieldName: 'allMedications',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'ALLERGIES:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'allAllergies',
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
        signers: ['physician', 'hospiceMedicalDirector'],
        style: { marginTop: 30 }
      }
    ],
    footer: {
      includePageNumbers: true,
      content: 'Parrish Health Systems - Confidential'
    }
  },

  // ============ Home Visit Assessment (Any Visit) ============
  'HOME_VISIT_ASSESSMENT': {
    name: 'Home Visit Assessment',
    description: 'Clinical home visit assessment form',
    documentType: 'HOME_VISIT_ASSESSMENT',
    applicablePeriods: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5+'],
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
        content: 'HOME VISIT ASSESSMENT',
        style: { fontSize: 16, bold: true, alignment: 'center' }
      },
      {
        type: 'patientInfo',
        fields: ['name', 'dob', 'mrn'],
        style: { fontSize: 11 }
      },
      {
        type: 'paragraph',
        content: 'Visit Date: {{visitDate}}',
        style: { fontSize: 11, marginTop: 15 }
      },
      {
        type: 'paragraph',
        content: 'VITAL SIGNS:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'vitals',
        style: { fontSize: 11, marginTop: 5, minHeight: 40 }
      },
      {
        type: 'paragraph',
        content: 'FUNCTIONAL ASSESSMENT:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'functionalAssessment',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'SYMPTOM ASSESSMENT:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'symptomAssessment',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'CARE PLAN:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'carePlan',
        style: { fontSize: 11, marginTop: 5, minHeight: 60 }
      },
      {
        type: 'paragraph',
        content: 'NARRATIVE NOTES:',
        style: { fontSize: 11, marginTop: 15, bold: true }
      },
      {
        type: 'field',
        fieldName: 'narrativeNotes',
        style: { fontSize: 11, marginTop: 5, minHeight: 80 }
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