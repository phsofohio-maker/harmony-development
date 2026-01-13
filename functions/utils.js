const nodemailer = require('nodemailer');

// ============ DATE & MATH HELPERS ============
function normalizeDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calculateDaysBetween(startDate, endDate) {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end) return 0;
  return Math.floor(Math.abs(end - start) / (1000 * 60 * 60 * 24));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function determineCertPeriodByBenefit(periodNum, isReadmission = false) {
  const requiresF2F = periodNum >= 3 || isReadmission;
  
  if (periodNum === 1) {
    return { name: 'Initial 90-Day', durationDays: 90, requiresF2F: isReadmission, notifyDaysBefore: 14 };
  } else if (periodNum === 2) {
    return { name: '2nd 90-Day', durationDays: 90, requiresF2F: isReadmission, notifyDaysBefore: 14 };
  } else {
    return { name: `${periodNum}${getOrdinalSuffix(periodNum)} 60-Day`, durationDays: 60, requiresF2F: true, notifyDaysBefore: 10 };
  }
}

function calculateCurrentBenefitPeriod(startingPeriod, daysSinceAdmission) {
  let currentPeriod = startingPeriod || 1;
  let daysRemaining = daysSinceAdmission;
  let periodStartDay = 0;
  
  while (true) {
    const periodDuration = (currentPeriod <= 2) ? 90 : 60;
    if (daysRemaining <= periodDuration) {
      return { currentPeriod, daysIntoPeriod: daysRemaining, periodDuration, periodEndDay: periodStartDay + periodDuration };
    }
    daysRemaining -= periodDuration;
    periodStartDay += periodDuration;
    currentPeriod++;
  }
}

function calculatePatientCTI(patient) {
  const admissionDate = patient.admissionDate?.toDate ? patient.admissionDate.toDate() : new Date(patient.admissionDate);
  const today = normalizeDate(new Date());
  const daysSinceAdmission = calculateDaysBetween(admissionDate, today);
  
  const periodTracking = calculateCurrentBenefitPeriod(patient.startingBenefitPeriod || 1, daysSinceAdmission);
  const certPeriod = determineCertPeriodByBenefit(periodTracking.currentPeriod, patient.isReadmission || false);
  
  const certEndDate = addDays(admissionDate, periodTracking.periodEndDay);
  const notifyDate = addDays(certEndDate, -certPeriod.notifyDaysBefore);
  const daysUntilCertEnd = calculateDaysBetween(today, certEndDate);
  
  return {
    currentBenefitPeriod: periodTracking.currentPeriod,
    periodName: certPeriod.name,
    periodDuration: certPeriod.durationDays,
    daysIntoPeriod: periodTracking.daysIntoPeriod,
    certEndDate,
    notifyDate,
    daysUntilCertEnd,
    isOverdue: daysUntilCertEnd < 0,
    requiresF2F: certPeriod.requiresF2F,
    f2fCompleted: patient.f2fCompleted || false,
    f2fOverdue: certPeriod.requiresF2F && !patient.f2fCompleted,
    isReadmission: patient.isReadmission || false,
    isInSixtyDayPeriod: periodTracking.currentPeriod >= 3
  };
}

// ============ EMAIL HELPERS ============

async function createTransporter(emailUser, emailPass) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser.value(),
      pass: emailPass.value()
    }
  });
}

async function sendCertificationEmail(transporter, orgSettings, patients, emailUser) {
  const emailList = orgSettings.emailList || [];
  if (emailList.length === 0) return;

  const subject = `🔔 Certification Alert - ${formatDate(new Date())} - ${patients.length} Patient(s)`;
  
  let patientRows = patients.map(p => {
    const periodBadge = p.cti.isInSixtyDayPeriod ? 
      '<span style="background:#f3e8ff;color:#6b21a8;padding:2px 8px;border-radius:4px;">60-day</span>' :
      '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;">90-day</span>';
    
    const statusBadge = p.cti.isOverdue ?
      '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;">OVERDUE</span>' :
      `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;">${p.cti.daysUntilCertEnd} days</span>`;
    
    const f2fBadge = p.cti.requiresF2F && !p.cti.f2fCompleted ?
      '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;">F2F NEEDED</span>' : '';
    
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;"><strong>${p.name}</strong>${p.cti.isReadmission ? ' <em>(Readmit)</em>' : ''}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">${p.mrNumber}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">Period ${p.cti.currentBenefitPeriod} ${periodBadge}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">${formatDate(p.cti.certEndDate)}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">${statusBadge} ${f2fBadge}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;color:#333;max-width:800px;margin:0 auto;">
      <div style="background:#2c5282;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">Parrish Health Systems</h1>
        <p style="margin:5px 0 0 0;">Certification Alert</p>
      </div>
      
      <div style="padding:20px;">
        <p>The following patients require certification attention:</p>
        
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:12px;text-align:left;border-bottom:2px solid #e5e7eb;">Patient</th>
              <th style="padding:12px;text-align:left;border-bottom:2px solid #e5e7eb;">MR#</th>
              <th style="padding:12px;text-align:left;border-bottom:2px solid #e5e7eb;">Period</th>
              <th style="padding:12px;text-align:left;border-bottom:2px solid #e5e7eb;">Cert End</th>
              <th style="padding:12px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>${patientRows}</tbody>
        </table>
        
        <div style="background:#e7f3ff;border:1px solid #2c5282;padding:15px;border-radius:4px;margin:20px 0;">
          <strong>Period Legend:</strong><br>
          90-day = Initial or 2nd period | 60-day = Period 3+ (F2F required)
        </div>
        
        <p style="color:#666;font-size:12px;margin-top:30px;">
          Automated notification from Harmony HCA<br>
          ${formatDate(new Date())}
        </p>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Harmony HCA" <${emailUser.value()}>`,
    to: emailList.join(','),
    subject,
    html
  });
}

async function sendF2FAlertEmail(transporter, orgSettings, patients, emailUser) {
  const emailList = orgSettings.emailList || [];
  if (emailList.length === 0) return;

  const overdueCount = patients.filter(p => p.cti.f2fOverdue).length;
  const subject = `⚠️ F2F Encounter Alert - ${overdueCount > 0 ? `${overdueCount} OVERDUE` : `${patients.length} Needed`}`;

  let patientRows = patients.map(p => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;"><strong>${p.name}</strong></td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${p.mrNumber}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">Period ${p.cti.currentBenefitPeriod}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${p.cti.isReadmission ? 'Readmission' : 'Period 3+'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">
        ${p.cti.f2fOverdue ? 
          '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;">OVERDUE</span>' :
          '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;">Needed</span>'}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;color:#333;max-width:800px;margin:0 auto;">
      <div style="background:#f59e0b;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">⚠️ Face-to-Face Encounter Alert</h1>
        <p style="margin:5px 0 0 0;">Parrish Health Systems</p>
      </div>
      
      <div style="padding:20px;">
        ${overdueCount > 0 ? `
          <div style="background:#fee2e2;border:1px solid #ef4444;padding:15px;border-radius:4px;margin-bottom:20px;">
            <strong>🚨 ${overdueCount} patient(s) have OVERDUE F2F requirements!</strong>
          </div>
        ` : ''}
        
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px;text-align:left;">Patient</th>
              <th style="padding:10px;text-align:left;">MR#</th>
              <th style="padding:10px;text-align:left;">Period</th>
              <th style="padding:10px;text-align:left;">Reason</th>
              <th style="padding:10px;text-align:left;">Status</th>
            </tr>
          </thead>
          <tbody>${patientRows}</tbody>
        </table>
        
        <div style="background:#e7f3ff;padding:15px;border-radius:4px;margin:20px 0;">
          <strong>F2F Requirements:</strong>
          <ul>
            <li>Required for all Period 3+ patients (60-day cycles)</li>
            <li>Required for all readmissions</li>
            <li>Must occur within 30 days before period start</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Harmony HCA" <${emailUser.value()}>`,
    to: emailList.join(','),
    subject,
    html
  });
}

module.exports = {
  calculatePatientCTI,
  createTransporter,
  sendCertificationEmail,
  sendF2FAlertEmail,
  formatDate
};