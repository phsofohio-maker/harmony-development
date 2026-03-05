/**
 * functions/lib/pdfGenerator.js
 * Stateless PDF generation using PDFKit
 * NO Google Drive dependency
 * 
 * FIXED: Removed switchToPage() which requires bufferPages mode
 */

const PDFDocument = require('pdfkit');

/**
 * Generate a PDF document from template config and patient data
 * Returns a Buffer containing the PDF
 */
async function generatePDF(templateConfig, patientData, orgData, customData = {}, assessmentData = null) {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      
      // Create PDF document
      const doc = new PDFDocument({
        size: templateConfig.layout?.pageSize || 'LETTER',
        margins: templateConfig.layout?.margins || {
          top: 72, bottom: 72, left: 72, right: 72
        },
        bufferPages: false, // Don't buffer - render sequentially
        autoFirstPage: true,
        info: {
          Title: `${templateConfig.name} - ${patientData.name}`,
          Author: orgData.name || 'Parrish Health Systems',
          Subject: templateConfig.documentType,
          CreationDate: new Date()
        }
      });

      // Collect PDF chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Build comprehensive merge context from all patient/org fields
      const mergeContext = prepareMergeData(patientData, orgData, customData, assessmentData);

      // Render header
      renderHeader(doc, templateConfig.header, mergeContext);

      // Render each section
      for (const section of templateConfig.sections || []) {
        renderSection(doc, section, mergeContext);
      }

      // Render footer at bottom of current page
      renderFooter(doc, templateConfig.footer);

      // Finalize PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render document header
 */
function renderHeader(doc, headerConfig, context) {
  if (!headerConfig) return;
  
  const startY = 40;
  
  doc.save();
  
  if (headerConfig.includeOrgName) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(context.orgName, doc.page.margins.left, startY);
  }
  
  if (headerConfig.includeDate) {
    doc.fontSize(10)
       .font('Helvetica')
       .text(context.generatedDate, doc.page.margins.left, startY, {
         align: 'right',
         width: doc.page.width - doc.page.margins.left - doc.page.margins.right
       });
  }
  
  // Horizontal line under header
  const lineY = startY + 20;
  doc.moveTo(doc.page.margins.left, lineY)
     .lineTo(doc.page.width - doc.page.margins.right, lineY)
     .strokeColor('#cccccc')
     .stroke();
  
  doc.restore();
  
  // Move cursor below header
  doc.y = lineY + 20;
}

/**
 * Render a content section
 */
function renderSection(doc, section, context) {
  const style = section.style || {};
  
  // Apply top margin
  if (style.marginTop) {
    doc.y += style.marginTop;
  }
  
  // Check if we need a new page (leave room for content)
  if (doc.y > doc.page.height - 150) {
    doc.addPage();
  }
  
  switch (section.type) {
    case 'title':
      renderTitle(doc, section, context);
      break;
    case 'paragraph':
      renderParagraph(doc, section, context);
      break;
    case 'patientInfo':
      renderPatientInfo(doc, section, context);
      break;
    case 'benefitPeriod':
      renderBenefitPeriod(doc, section, context);
      break;
    case 'attendingPhysician':
      renderAttendingPhysician(doc, section, context);
      break;
    case 'field':
      renderField(doc, section, context);
      break;
    case 'signatureBlock':
      renderSignatureBlock(doc, section, context);
      break;
    default:
      console.warn(`Unknown section type: ${section.type}`);
  }
}

function renderTitle(doc, section, context) {
  const style = section.style || {};
  doc.fontSize(style.fontSize || 16)
     .font(style.bold ? 'Helvetica-Bold' : 'Helvetica')
     .text(replaceMergeFields(section.content, context), {
       align: style.alignment || 'center'
     });
  doc.moveDown(1.5);
}

function renderParagraph(doc, section, context) {
  const style = section.style || {};
  
  let font = 'Helvetica';
  if (style.bold && style.italic) {
    font = 'Helvetica-BoldOblique';
  } else if (style.bold) {
    font = 'Helvetica-Bold';
  } else if (style.italic) {
    font = 'Helvetica-Oblique';
  }
  
  doc.fontSize(style.fontSize || 11)
     .font(font)
     .text(replaceMergeFields(section.content, context), {
       align: style.alignment || 'left',
       lineGap: 3
     });
  doc.moveDown(0.8);
}

function renderPatientInfo(doc, section, context) {
  const style = section.style || {};
  const fields = section.fields || ['name', 'dob', 'mrn'];
  
  const boxTop = doc.y;
  const boxLeft = doc.page.margins.left;
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxHeight = 20 + (Math.ceil(fields.length / 2) * 22);
  
  // Draw box
  doc.rect(boxLeft, boxTop, boxWidth, boxHeight)
     .strokeColor('#333333')
     .stroke();
  
  // Header
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#333333')
     .text('PATIENT INFORMATION', boxLeft + 10, boxTop + 8);
  
  // Field mappings
  const fieldLabels = {
    name: 'Patient Name',
    dob: 'Date of Birth',
    mrn: 'MRN',
    currentPeriod: 'Current Period',
    admissionDate: 'Admission Date',
    diagnosis: 'Primary Diagnosis'
  };
  
  const fieldValues = {
    name: context.patientName,
    dob: context.patientDOB,
    mrn: context.patientMRN,
    currentPeriod: context.currentPeriod,
    admissionDate: context.admissionDate,
    diagnosis: context.diagnosis
  };
  
  doc.fontSize(style.fontSize || 10).font('Helvetica').fillColor('#000000');
  
  let yPos = boxTop + 28;
  const colWidth = (boxWidth - 20) / 2;
  
  fields.forEach((field, idx) => {
    const label = fieldLabels[field] || field;
    const value = fieldValues[field] || context[field] || 'N/A';
    
    const col = idx % 2;
    const xPos = boxLeft + 10 + (col * colWidth);
    
    if (idx > 0 && col === 0) {
      yPos += 22;
    }
    
    doc.font('Helvetica-Bold').text(`${label}: `, xPos, yPos, { continued: true });
    doc.font('Helvetica').text(String(value).substring(0, 40));
  });
  
  doc.y = boxTop + boxHeight + 15;
}

function renderBenefitPeriod(doc, section, context) {
  const style = section.style || {};
  
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('BENEFIT PERIOD INFORMATION', { underline: true });
  doc.moveDown(0.5);
  
  const rows = [
    ['Benefit Period:', context.currentPeriod || 'N/A'],
    ['Period Start:', context.periodStart || 'N/A'],
    ['Period End:', context.periodEnd || 'N/A'],
    ['Certification Due:', context.certDueDate || 'N/A']
  ];
  
  doc.fontSize(style.fontSize || 11);
  
  rows.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').text(label, { continued: true, width: 120 });
    doc.font('Helvetica').text(` ${value}`);
  });
  
  doc.moveDown(1);
}

function renderAttendingPhysician(doc, section, context) {
  const style = section.style || {};
  const fields = section.fields || ['attendingName', 'npi'];
  
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('ATTENDING PHYSICIAN', { underline: true });
  doc.moveDown(0.5);
  
  doc.fontSize(style.fontSize || 11).font('Helvetica');
  
  const fieldLabels = {
    attendingName: 'Name',
    npi: 'NPI',
    phone: 'Phone',
    fax: 'Fax',
    specialty: 'Specialty'
  };
  
  fields.forEach(field => {
    const label = fieldLabels[field] || field;
    const value = context[field] || context.attendingPhysician || 'N/A';
    doc.text(`${label}: ${value}`);
  });
  
  doc.moveDown(1);
}

function renderField(doc, section, context) {
  const style = section.style || {};
  const value = context[section.fieldName] || '';
  const minHeight = style.minHeight || 20;
  
  // Draw a light box for the field
  const boxTop = doc.y;
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
  doc.rect(doc.page.margins.left, boxTop, boxWidth, minHeight)
     .fillColor('#f9f9f9')
     .fill()
     .strokeColor('#dddddd')
     .stroke();
  
  doc.fillColor('#000000')
     .fontSize(style.fontSize || 11)
     .font('Helvetica')
     .text(value || '[No content provided]', doc.page.margins.left + 5, boxTop + 5, {
       width: boxWidth - 10,
       align: 'left'
     });
  
  doc.y = boxTop + minHeight + 10;
}

function renderSignatureBlock(doc, section, context) {
  const style = section.style || {};
  const signers = section.signers || ['physician'];
  
  if (style.marginTop) doc.y += style.marginTop;
  
  // Check if we need a new page for signatures
  const spaceNeeded = signers.length * 70 + 20;
  if (doc.y > doc.page.height - spaceNeeded) {
    doc.addPage();
  }
  
  const signerLabels = {
    physician: 'Physician Signature',
    medicalDirector: 'Medical Director',
    hospiceMedicalDirector: 'Hospice Medical Director',
    attendingPhysician: 'Attending Physician',
    f2fProvider: 'Face-to-Face Provider',
    clinician: 'Clinician Signature',
    admittingNurse: 'Admitting Nurse'
  };
  
  const lineWidth = 250;
  const dateLineWidth = 100;
  const startX = doc.page.margins.left;
  
  signers.forEach((signer, idx) => {
    const yPos = doc.y + (idx * 70);
    
    // Signature line
    doc.moveTo(startX, yPos + 40)
       .lineTo(startX + lineWidth, yPos + 40)
       .strokeColor('#000000')
       .stroke();
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#333333')
       .text(signerLabels[signer] || signer, startX, yPos + 45);
    
    // Date line
    const dateX = startX + lineWidth + 30;
    doc.moveTo(dateX, yPos + 40)
       .lineTo(dateX + dateLineWidth, yPos + 40)
       .stroke();
    
    doc.text('Date', dateX, yPos + 45);
  });
  
  doc.y += signers.length * 70;
}

/**
 * Render page footer - simplified version without page switching
 */
function renderFooter(doc, footerConfig) {
  if (!footerConfig) return;
  
  // Position at bottom of page
  const bottomY = doc.page.height - 50;
  
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor('#666666');
  
  if (footerConfig.content) {
    doc.text(
      footerConfig.content, 
      doc.page.margins.left, 
      bottomY,
      { 
        align: 'center',
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right 
      }
    );
  }
}

/**
 * Replace {{fieldName}} merge fields with actual values
 */
function replaceMergeFields(text, context) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
    const value = context[fieldName];
    return value !== undefined && value !== null ? value : match;
  });
}

/**
 * Format date helper
 */
function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  
  let date;
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    date = dateValue.toDate();
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else {
    return 'N/A';
  }
  
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Prepare the full merge data context.
 * Combines patient data, org data, and visit customData into a flat
 * dictionary of ~107 keys for template merge field resolution.
 */
function prepareMergeData(patientData, orgData, customData = {}, assessmentData = null) {
  const p = patientData || {};
  const o = orgData || {};
  const c = customData || {};
  const a = assessmentData || {};

  // Helper: safely access nested physician object or legacy string
  const ap = typeof p.attendingPhysician === 'object' ? p.attendingPhysician : {};
  const apName = ap.name || (typeof p.attendingPhysician === 'string' ? p.attendingPhysician : 'N/A');
  const hp = typeof p.hospicePhysician === 'object' ? p.hospicePhysician : {};

  // Primary diagnosis from diagnoses array
  const primaryDx = Array.isArray(p.diagnoses) && p.diagnoses.length > 0 ? p.diagnoses[0] : {};
  const allDiagnoses = Array.isArray(p.diagnoses) ? p.diagnoses.map(d => `${d.name} (${d.icd10 || 'N/A'}) [${d.relationship || ''}]`).join('; ') : 'N/A';

  // Medications list
  const allMedications = Array.isArray(p.medications) ? p.medications.map(m => `${m.name} ${m.dose} ${m.route} ${m.frequency}`.trim()).join('; ') : 'N/A';

  // Allergies list
  const allAllergies = p.nkda ? 'NKDA' : (Array.isArray(p.allergies) ? p.allergies.map(a => `${a.allergen} (${a.severity || ''})`).join('; ') : 'N/A');

  const base = {
    // ── Spread raw data first (custom overrides below) ──────────
    ...p,
    ...c,

    // ── Generated / Meta ────────────────────────────────────────
    generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    visitDate: formatDate(c.visitDate || new Date()),

    // ── Organization ────────────────────────────────────────────
    orgName: o.name || 'N/A',
    agencyName: o.agencyName || o.name || 'N/A',
    orgNpi: o.npi || 'N/A',
    orgProviderNumber: o.providerNumber || 'N/A',
    orgPhone: o.phone || 'N/A',
    orgFax: o.fax || 'N/A',
    orgAddress: o.address || 'N/A',
    orgCity: o.city || '',
    orgState: o.state || '',
    orgZip: o.zip || '',

    // ── Patient Identity ────────────────────────────────────────
    patientName: p.name || 'N/A',
    patientFirstName: p.firstName || '',
    patientLastName: p.lastName || '',
    patientDOB: formatDate(p.dateOfBirth || p.dob),
    patientMRN: p.mrNumber || p.mrn || 'N/A',
    patientMBI: p.mbi || 'N/A',
    patientMedicaid: p.medicaidNumber || 'N/A',
    patientAdmissionNumber: p.admissionNumber || 'N/A',
    patientSSN: p.ssn || '',

    // ── Demographics ────────────────────────────────────────────
    patientGender: p.gender || 'N/A',
    patientRace: p.race || 'N/A',
    patientEthnicity: p.ethnicity || 'N/A',
    patientMaritalStatus: p.maritalStatus || 'N/A',
    patientLanguage: p.primaryLanguage || 'English',
    patientReligion: p.religion || '',

    // ── Location ────────────────────────────────────────────────
    patientAddress: p.address || 'N/A',
    patientLocationName: p.locationName || '',
    patientLocationType: p.locationType || '',
    patientInstitution: p.institutionName || '',

    // ── Admission ───────────────────────────────────────────────
    admissionDate: formatDate(p.admissionDate || p.socDate),
    startOfCare: formatDate(p.startOfCare),
    electionDate: formatDate(p.electionDate),
    levelOfCare: p.levelOfCare || 'Routine',
    disasterCode: p.disasterCode || '',

    // ── Benefit Period ──────────────────────────────────────────
    currentPeriod: p.compliance?.cti?.periodShortName || `Period ${p.startingBenefitPeriod || 1}`,
    periodStart: formatDate(p.compliance?.cti?.periodStart),
    periodEnd: formatDate(p.compliance?.cti?.periodEnd),
    certDueDate: formatDate(p.compliance?.cti?.certDueDate),
    certificationEndDate: formatDate(p.compliance?.cti?.certificationEndDate),
    daysUntilCertEnd: p.compliance?.cti?.daysUntilCertEnd ?? 'N/A',
    periodDuration: p.compliance?.cti?.periodDuration || 'N/A',
    startingBenefitPeriod: p.startingBenefitPeriod || 1,
    isReadmission: p.isReadmission ? 'Yes' : 'No',
    priorHospiceDays: p.priorHospiceDays || 0,

    // ── Attending Physician ─────────────────────────────────────
    attendingPhysician: apName,
    attendingPhysicianName: apName,
    attendingNPI: ap.npi || 'N/A',
    attendingPhone: ap.phone || 'N/A',
    attendingFax: ap.fax || 'N/A',
    attendingEmail: ap.email || '',
    attendingAddress: ap.address || '',

    // ── Hospice Physician ───────────────────────────────────────
    hospicePhysicianName: hp.name || 'N/A',
    hospicePhysicianNPI: hp.npi || 'N/A',

    // ── F2F ─────────────────────────────────────────────────────
    f2fRequired: p.f2fRequired || (p.startingBenefitPeriod >= 3 || p.isReadmission) ? 'Yes' : 'No',
    f2fCompleted: p.f2fCompleted ? 'Yes' : 'No',
    f2fDate: formatDate(c.f2fDate || p.f2fDate),
    f2fPhysician: p.f2fPhysician || 'N/A',
    f2fProvider: c.f2fProvider || p.f2fPhysician || 'N/A',
    f2fProviderRole: p.f2fProviderRole || 'N/A',
    f2fProviderNpi: p.f2fProviderNpi || 'N/A',
    f2fProviderCredentials: c.f2fProviderCredentials || 'MD/DO/NP/PA',

    // ── HUV ─────────────────────────────────────────────────────
    huv1Completed: p.huv1Completed ? 'Yes' : 'No',
    huv1Date: formatDate(p.huv1Date),
    huv2Completed: p.huv2Completed ? 'Yes' : 'No',
    huv2Date: formatDate(p.huv2Date),

    // ── Diagnoses ───────────────────────────────────────────────
    primaryDiagnosis: primaryDx.name || 'N/A',
    primaryDiagnosisICD10: primaryDx.icd10 || 'N/A',
    diagnosis: primaryDx.name || 'N/A',
    allDiagnoses,

    // ── Medications & Allergies ──────────────────────────────────
    allMedications,
    allAllergies,
    nkda: p.nkda ? 'NKDA' : 'No',

    // ── Advance Directives ──────────────────────────────────────
    codeStatus: p.codeStatus || 'N/A',
    isDnr: p.isDnr ? 'Yes' : 'No',
    dpoaName: p.dpoaName || 'N/A',
    livingWillOnFile: p.livingWillOnFile ? 'Yes' : 'No',
    polstOnFile: p.polstOnFile ? 'Yes' : 'No',

    // ── Contacts ────────────────────────────────────────────────
    primaryContactName: p.primaryContact?.name || 'N/A',
    primaryContactRelationship: p.primaryContact?.relationship || '',
    primaryContactPhone: p.primaryContact?.phone || 'N/A',
    primaryContactAddress: p.primaryContact?.address || '',

    primaryCaregiverName: p.primaryCaregiver?.name || 'N/A',
    primaryCaregiverRelationship: p.primaryCaregiver?.relationship || '',
    primaryCaregiverMobile: p.primaryCaregiver?.mobile || 'N/A',
    primaryCaregiverEmail: p.primaryCaregiver?.email || '',
    primaryCaregiverAddress: p.primaryCaregiver?.address || '',

    secondaryCaregiverName: p.secondaryCaregiver?.name || '',
    secondaryCaregiverRelationship: p.secondaryCaregiver?.relationship || '',
    secondaryCaregiverMobile: p.secondaryCaregiver?.mobile || '',

    // ── Services ────────────────────────────────────────────────
    pharmacyName: p.pharmacy?.name || 'N/A',
    pharmacyPhone: p.pharmacy?.phone || 'N/A',
    pharmacyFax: p.pharmacy?.fax || '',
    pharmacyAddress: p.pharmacy?.address || '',

    funeralHomeName: p.funeralHome?.name || 'N/A',
    funeralHomePhone: p.funeralHome?.phone || '',
    funeralHomeAddress: p.funeralHome?.address || '',

    referralSource: p.referral?.source || 'N/A',

    // ── Notes ───────────────────────────────────────────────────
    otherNotes: p.otherNotes || '',
  };

  // ── UPPER_CASE Template Merge Variable Aliases ──────────────
  // Google Doc templates use UPPER_CASE merge fields (e.g. {{PATIENT_NAME}}).
  // Map them from the camelCase values already computed above.

  const diagnoses = Array.isArray(p.diagnoses) ? p.diagnoses : [];
  const calcAge = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth?.toDate ? p.dateOfBirth.toDate() : p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '';

  Object.assign(base, {
    // Shared across most/all templates
    PATIENT_NAME: base.patientName,
    DOB: base.patientDOB,
    MRN: base.patientMRN,
    MBI: base.patientMBI,
    MPI: base.patientMedicaid,

    // Gender checkbox
    CBX_GENDER: base.patientGender || '',

    // Benefit period checkboxes / info
    CBX_BP: base.currentPeriod || '',
    BENEFIT_PERIOD: base.startingBenefitPeriod || '',
    BENEFIT_PERIOD_1: base.periodStart || '',
    BENEFIT_PERIOD_2: base.periodEnd || '',

    // Certification type / F2F / Related checkboxes (populated from customData or defaults)
    CBX_CT: c.CBX_CT || c.certType || '',
    CBX_F2F: base.f2fRequired || '',
    CBX_R: c.CBX_R || c.diagnosisRelationship || '',

    // Diagnoses — both underscore and no-underscore variants
    DIAGNOSIS_1: diagnoses[0]?.name || '',
    DIAGNOSIS_2: diagnoses[1]?.name || '',
    DIAGNOSIS_3: diagnoses[2]?.name || '',
    DIAGNOSIS_4: diagnoses[3]?.name || '',
    DIAGNOSIS_5: diagnoses[4]?.name || '',
    DIAGNOSIS_6: diagnoses[5]?.name || '',
    DIAGNOSIS1: diagnoses[0]?.name || '',
    DIAGNOSIS2: diagnoses[1]?.name || '',

    // Diagnosis onset dates (Attending CTI)
    D1_DATE: formatDate(diagnoses[0]?.onsetDate),
    D2_DATE: formatDate(diagnoses[1]?.onsetDate),
    D3_DATE: formatDate(diagnoses[2]?.onsetDate),
    D4_DATE: formatDate(diagnoses[3]?.onsetDate),
    D5_DATE: formatDate(diagnoses[4]?.onsetDate),
    D6_DATE: formatDate(diagnoses[5]?.onsetDate),

    // Computed ICD-10
    CALC_ICD: base.primaryDiagnosisICD10 || '',
    CALC_AGE: calcAge !== '' ? String(calcAge) : '',

    // Admission / Election
    ADMISSION: base.admissionDate,
    ELECTION_DATE: base.electionDate,

    // Cert period dates — CTI uses CD_1/CD_2, Attending CTI uses CDATE1/CDATE2
    CD_1: base.periodStart || '',
    CD_2: base.periodEnd || '',
    CDATE1: base.periodStart || '',
    CDATE2: base.periodEnd || '',

    // Attending physician
    PHYS_ATT_NAME: base.attendingPhysicianName,
    PHYS_ATT_NPI: base.attendingNPI,
    PHYS_ATT_PHONE: base.attendingPhone,

    // F2F fields
    F2F_DATE: base.f2fDate,
    F2F_PHYSICIAN: base.f2fProvider,
    F2F_NPI: base.f2fProviderNpi,
    CBX_F2F_ROLE: base.f2fProviderRole || '',

    // Visit date/time — assessment overrides customData
    SELECT_DATE: formatDate(a.visitDate) || base.visitDate || '',
    SELECT_TIME: a.visitTime || c.visitTime || c.SELECT_TIME || '',

    // Location
    PATIENT_LOCATION: base.patientLocationName || base.patientLocationType || '',
    PATIENT_ADDRESS: base.patientAddress,
    PATIENT_PN: c.patientPhone || p.phone || '',

    // Provider fields (Progress Note / Home Visit) — assessment overrides customData
    PROVIDER: a.clinicianName || c.clinicianName || c.PROVIDER || '',
    NPI: a.clinicianNpi || c.providerNpi || c.NPI || base.attendingNPI || '',
    CBX_VT: a.visitType || c.visitType || c.CBX_VT || '',
    CBX_ROLE: a.clinicianTitle || c.clinicianTitle || c.CBX_ROLE || '',
    CBX_VP: a.visitPurpose || c.visitPurpose || c.CBX_VP || '',

    // ── Tier 2: Visit-level fields from assessment ────────────────
    TIME_IN: a.visitTime || a.timeIn || c.visitTime || '',
    TIME_OUT: a.timeOut || c.timeOut || '',
    VISIT_TYPE: a.visitType || c.visitType || '',
    PROVIDER_NAME: a.clinicianName || c.clinicianName || '',
    PROVIDER_NPI: a.clinicianNpi || c.providerNpi || '',
    PROVIDER_TITLE: a.clinicianTitle || c.clinicianTitle || '',

    // ── Tier 3: Clinical data from assessment ─────────────────────
    // Vitals
    VITALS_BP: a.bpSystolic && a.bpDiastolic ? `${a.bpSystolic}/${a.bpDiastolic}` : (c.VITALS_BP || ''),
    VITALS_HR: a.heartRate || c.VITALS_HR || '',
    VITALS_RESP: a.respiratoryRate || c.VITALS_RESP || '',
    VITALS_TEMP: a.temperature || c.VITALS_TEMP || '',
    VITALS_O2: a.o2Saturation || c.VITALS_O2 || '',
    WEIGHT_CURRENT: a.weight || c.WEIGHT_CURRENT || '',

    // Pain
    PAIN_SCORE: a.painLevel || c.PAIN_SCORE || '',
    PAIN_GOAL: a.painGoal || c.PAIN_GOAL || '',
    CBX_PAIN_RELIEF: a.painManaged != null ? (a.painManaged ? '☑ Yes  ☐ No' : '☐ Yes  ☑ No') : '',

    // Functional status
    PPS_CURRENT: a.performanceScore || c.PPS_CURRENT || '',
    ADL_SCORE_CURRENT: a.adlScoreCurrent || c.ADL_SCORE_CURRENT || '',
    MOBILITY_STATUS: a.mobilityStatus || c.MOBILITY_STATUS || '',
    FALL_RISK: a.fallRisk || c.FALL_RISK || '',

    // ADL details
    ADL_BATHING: a.adlBathing || '',
    ADL_DRESSING: a.adlDressing || '',
    ADL_TOILETING: a.adlToileting || '',
    ADL_TRANSFERRING: a.adlTransferring || '',
    ADL_FEEDING: a.adlFeeding || '',

    // Symptoms
    SYMPTOM_PAIN: a.symptoms?.pain ? 'Yes' : 'No',
    SYMPTOM_NAUSEA: a.symptoms?.nausea ? 'Yes' : 'No',
    SYMPTOM_DYSPNEA: a.symptoms?.dyspnea ? 'Yes' : 'No',
    SYMPTOM_ANXIETY: a.symptoms?.anxiety ? 'Yes' : 'No',
    SYMPTOM_FATIGUE: a.symptoms?.fatigue ? 'Yes' : 'No',
    SYMPTOM_CONSTIPATION: a.symptoms?.constipation ? 'Yes' : 'No',
    SYMPTOM_EDEMA: a.symptoms?.edema ? 'Yes' : 'No',
    SYMPTOM_SKIN_ISSUES: a.symptoms?.skinIssues ? 'Yes' : 'No',
    SYMPTOM_NOTES: a.symptomNotes || c.SYMPTOM_NOTES || '',

    // Narratives / clinical notes
    EXAM_FINDINGS_NARRATIVE: a.examFindingsNarrative || c.EXAM_FINDINGS_NARRATIVE || '',
    HPI_NARRATIVE: a.narrativeNotes || c.HPI_NARRATIVE || '',
    CLINICAL_NARRATIVE: a.narrativeNotes || c.CLINICAL_NARRATIVE || '',

    // Care plan
    CBX_MED_CHANGES: a.medicationsReviewed != null ? (a.medicationsReviewed ? '☑ Reviewed  ☐ No Changes' : '☐ Reviewed  ☑ No Changes') : '',
    MED_CHANGE_DETAILS: a.planChanges || c.MED_CHANGE_DETAILS || '',
    ORDERS_DME: a.interventions || c.ORDERS_DME || '',
    GOALS_REVIEWED: a.goalsReviewed ? 'Yes' : 'No',
    EDUCATION_PROVIDED: a.educationProvided || '',
    NEXT_VISIT_DATE: formatDate(a.nextVisitDate),

    // AI suggestion placeholder
    SUGGESTION: c.SUGGESTION || c.suggestion || '',
  });

  return base;
}

module.exports = { generatePDF, prepareMergeData };