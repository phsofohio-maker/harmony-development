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
async function generatePDF(templateConfig, patientData, orgData, customData = {}) {
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

      // Merge data context
      const mergeContext = {
        ...patientData,
        ...customData,
        orgName: orgData.name || 'Parrish Health Systems',
        generatedDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        }),
        patientName: patientData.name,
        patientDOB: formatDate(patientData.dob),
        patientMRN: patientData.mrn || patientData.mrNumber || 'N/A',
        currentPeriod: patientData.currentPeriod || patientData.compliance?.cti?.periodShortName || 'N/A',
        periodStart: formatDate(patientData.periodStart || patientData.compliance?.cti?.periodStart),
        periodEnd: formatDate(patientData.periodEnd || patientData.compliance?.cti?.periodEnd),
        certDueDate: formatDate(patientData.certDueDate || patientData.compliance?.cti?.certDueDate),
        admissionDate: formatDate(patientData.socDate || patientData.admissionDate),
        diagnosis: patientData.diagnosis || patientData.primaryDiagnosis || 'N/A',
        attendingPhysician: patientData.attendingPhysician || patientData.attendingName || 'N/A',
        attendingNPI: patientData.attendingNPI || patientData.npi || 'N/A',
        f2fDate: formatDate(customData.f2fDate || patientData.f2fDate),
        f2fProvider: customData.f2fProvider || patientData.f2fProvider || 'N/A',
        f2fProviderCredentials: customData.f2fProviderCredentials || 'MD/DO/NP/PA',
        visitDate: formatDate(customData.visitDate || new Date())
      };

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

module.exports = { generatePDF };