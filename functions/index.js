/**
 * Harmony Health Care Assistant
 * Cloud Functions v2 - Complete Backend
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { initializeApp, getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { defineSecret } = require('firebase-functions/params');
const { generateCertificationDocs } = require('./generateCertificationDocs');
// Initialize Firebase Admin (check if already initialized)
try {
  getApp();
} catch {
  initializeApp();
}

const db = getFirestore();
const admin = getAuth();
const storage = getStorage();

// Secrets for email
const emailUser = defineSecret('EMAIL_USER');
const emailPass = defineSecret('EMAIL_PASS');

// ============ YOUR EXISTING CALCULATION FUNCTIONS ============
// (Keep all your existing helper functions here)
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

// ============ EMAIL FUNCTIONS ============

async function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser.value(),
      pass: emailPass.value()
    }
  });
}

async function sendCertificationEmail(transporter, orgSettings, patients) {
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

async function sendF2FAlertEmail(transporter, orgSettings, patients) {
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

// ============ SCHEDULED FUNCTIONS ============

/**
 * Daily certification check - runs at 9am ET
 */
exports.dailyCertificationCheck = onSchedule({
  schedule: '0 9 * * *',
  timeZone: 'America/New_York',
  secrets: [emailUser, emailPass]
}, async (event) => {
  console.log('Starting daily certification check...');
  
  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgSettings = orgDoc.data();
      
      console.log(`Processing organization: ${orgId}`);
      
      // Get active patients
      const patientsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('patients')
        .where('status', '==', 'active')
        .get();
      
      const certificationAlerts = [];
      const f2fAlerts = [];
      
      patientsSnapshot.forEach(patientDoc => {
        const patient = { id: patientDoc.id, ...patientDoc.data() };
        
        if (!patient.admissionDate) return;
        
        const cti = calculatePatientCTI(patient);
        patient.cti = cti;
        
        // Check for certification alerts (due within 14 days or overdue)
        if (cti.daysUntilCertEnd <= 14) {
          certificationAlerts.push(patient);
        }
        
        // Check for F2F alerts
        if (cti.requiresF2F && !cti.f2fCompleted) {
          f2fAlerts.push(patient);
        }
      });
      
      // Send emails if needed
      if (certificationAlerts.length > 0 || f2fAlerts.length > 0) {
        const transporter = await createTransporter();
        
        if (certificationAlerts.length > 0) {
          await sendCertificationEmail(transporter, orgSettings, certificationAlerts);
          console.log(`Sent certification alert for ${certificationAlerts.length} patients`);
        }
        
        if (f2fAlerts.length > 0) {
          await sendF2FAlertEmail(transporter, orgSettings, f2fAlerts);
          console.log(`Sent F2F alert for ${f2fAlerts.length} patients`);
        }
      }
    }
    
    console.log('Daily certification check complete');
  } catch (error) {
    console.error('Error in daily certification check:', error);
    throw error;
  }
});

/**
 * Weekly summary - runs Monday at 8am ET
 */
exports.weeklySummary = onSchedule({
  schedule: '0 8 * * 1',
  timeZone: 'America/New_York',
  secrets: [emailUser, emailPass]
}, async (event) => {
  console.log('Starting weekly summary...');
  
  try {
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgSettings = orgDoc.data();
      const emailList = orgSettings.emailList || [];
      
      if (emailList.length === 0) continue;
      
      const patientsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('patients')
        .where('status', '==', 'active')
        .get();
      
      // Calculate stats
      const stats = {
        total: 0, in90Day: 0, in60Day: 0, upcomingCerts: 0, overdueCerts: 0,
        f2fNeeded: 0, f2fOverdue: 0, readmissions: 0
      };
      
      const upcomingPatients = [];
      
      patientsSnapshot.forEach(doc => {
        const patient = { id: doc.id, ...doc.data() };
        if (!patient.admissionDate) return;
        
        const cti = calculatePatientCTI(patient);
        stats.total++;
        
        if (cti.isInSixtyDayPeriod) stats.in60Day++;
        else stats.in90Day++;
        
        if (cti.isOverdue) stats.overdueCerts++;
        else if (cti.daysUntilCertEnd <= 30) {
          stats.upcomingCerts++;
          upcomingPatients.push({ ...patient, cti });
        }
        
        if (cti.requiresF2F && !cti.f2fCompleted) {
          stats.f2fNeeded++;
          if (cti.f2fOverdue) stats.f2fOverdue++;
        }
        
        if (cti.isReadmission) stats.readmissions++;
      });
      
      // Sort upcoming by days remaining
      upcomingPatients.sort((a, b) => a.cti.daysUntilCertEnd - b.cti.daysUntilCertEnd);
      
      const transporter = await createTransporter();
      
      // Build summary email
      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:800px;margin:0 auto;">
          <div style="background:#2c5282;color:white;padding:20px;text-align:center;">
            <h1 style="margin:0;">Weekly Certification Summary</h1>
            <p style="margin:5px 0 0 0;">Parrish Health Systems - ${formatDate(new Date())}</p>
          </div>
          
          <div style="padding:20px;">
            <h2>📊 Weekly Statistics</h2>
            <table style="width:100%;border-collapse:collapse;margin:15px 0;">
              <tr><td style="padding:8px;border:1px solid #eee;"><strong>Total Active Patients</strong></td><td style="padding:8px;border:1px solid #eee;">${stats.total}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;">In 90-Day Periods</td><td style="padding:8px;border:1px solid #eee;">${stats.in90Day}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;">In 60-Day Periods</td><td style="padding:8px;border:1px solid #eee;">${stats.in60Day}</td></tr>
              <tr style="background:#fef3c7;"><td style="padding:8px;border:1px solid #eee;"><strong>Upcoming Certifications (30 days)</strong></td><td style="padding:8px;border:1px solid #eee;"><strong>${stats.upcomingCerts}</strong></td></tr>
              <tr style="background:#fee2e2;"><td style="padding:8px;border:1px solid #eee;"><strong>Overdue Certifications</strong></td><td style="padding:8px;border:1px solid #eee;"><strong>${stats.overdueCerts}</strong></td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;">F2F Encounters Needed</td><td style="padding:8px;border:1px solid #eee;">${stats.f2fNeeded} (${stats.f2fOverdue} overdue)</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;">Readmissions</td><td style="padding:8px;border:1px solid #eee;">${stats.readmissions}</td></tr>
            </table>
            
            ${upcomingPatients.length > 0 ? `
              <h2>📅 Upcoming Certifications</h2>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px;text-align:left;">Patient</th>
                    <th style="padding:10px;text-align:left;">Period</th>
                    <th style="padding:10px;text-align:left;">Cert End</th>
                    <th style="padding:10px;text-align:left;">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcomingPatients.slice(0, 10).map(p => `
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eee;">${p.name}</td>
                      <td style="padding:8px;border-bottom:1px solid #eee;">${p.cti.periodName}</td>
                      <td style="padding:8px;border-bottom:1px solid #eee;">${formatDate(p.cti.certEndDate)}</td>
                      <td style="padding:8px;border-bottom:1px solid #eee;">${p.cti.daysUntilCertEnd}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>No certifications due in the next 30 days.</p>'}
            
            <p style="color:#666;font-size:12px;margin-top:30px;">
              Automated weekly summary from Harmony HCA
            </p>
          </div>
        </body>
        </html>
      `;
      
      await transporter.sendMail({
        from: `"Harmony HCA" <${emailUser.value()}>`,
        to: emailList.join(','),
        subject: `📊 Weekly Summary - ${stats.upcomingCerts} Upcoming, ${stats.overdueCerts} Overdue`,
        html
      });
      
      console.log(`Weekly summary sent for ${orgId}`);
    }
    
    console.log('Weekly summary complete');
  } catch (error) {
    console.error('Error in weekly summary:', error);
    throw error;
  }
});

// ============ CALLABLE FUNCTIONS ============

/**
 * Manually trigger certification check (for testing)
 */
exports.triggerCertificationCheck = onCall({
  secrets: [emailUser, emailPass]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  // Reuse the scheduled function logic
  await exports.dailyCertificationCheck.run();
  
  return { success: true, message: 'Certification check triggered' };
});
// ============ USER MANAGEMENT FUNCTIONS ============

/**
 * Set custom claims for a new user
 * Called when creating new users in the system
 */
exports.setUserClaims = onCall(async (request) => {
  // Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { uid, orgId, role } = request.data;
  
  // Validate inputs
  if (!uid || !orgId || !role) {
    throw new HttpsError('invalid-argument', 'Missing required fields: uid, orgId, role');
  }
  
  // Validate role
  const validRoles = ['owner', 'admin', 'staff', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  try {
    // Set custom claims
    await admin.setCustomUserClaims(uid, { orgId, role });
    
    // Update user document in Firestore
    await db.collection('users').doc(uid).update({
      organizationId: orgId,
      role: role,
      customClaimsSet: true,
      updatedAt: Timestamp.now()
    });
    
    return { 
      success: true, 
      message: 'Custom claims set successfully',
      uid,
      orgId,
      role
    };
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw new HttpsError('internal', 'Failed to set custom claims');
  }
});

/**
 * Update user's organization or role
 * Called when changing user permissions
 */
exports.updateUserClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { uid, orgId, role } = request.data;
  
  if (!uid) {
    throw new HttpsError('invalid-argument', 'User ID required');
  }
  
  try {
    const updates = {};
    if (orgId) updates.orgId = orgId;
    if (role) updates.role = role;
    
    // Update custom claims
    await admin.setCustomUserClaims(uid, updates);
    
    // Update Firestore
    await db.collection('users').doc(uid).update({
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    return { success: true, message: 'Claims updated successfully' };
  } catch (error) {
    console.error('Error updating claims:', error);
    throw new HttpsError('internal', 'Failed to update claims');
  }
});

/**
 * Force refresh of user's authentication token
 * Called after updating claims to ensure frontend gets new permissions
 */
exports.refreshUserClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { uid } = request.data;
  
  try {
    // Revoke all existing tokens to force refresh
    await admin.revokeRefreshTokens(uid || request.auth.uid);
    
    return { 
      success: true, 
      message: 'Token refresh initiated. Please sign in again.' 
    };
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    throw new HttpsError('internal', 'Failed to refresh tokens');
  }
});

// ============ EMAIL TESTING FUNCTION ============

/**
 * Send test email to verify configuration
 * Called from NotificationsPage
 */
exports.testEmail = onCall({
  secrets: [emailUser, emailPass]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { orgId } = request.data;
  
  try {
    // Get organization settings
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      throw new HttpsError('not-found', 'Organization not found');
    }
    
    const orgData = orgDoc.data();
    const emailList = orgData.emailList || [];
    
    if (emailList.length === 0) {
      throw new HttpsError('failed-precondition', 'No email recipients configured');
    }
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser.value(),
        pass: emailPass.value()
      }
    });
    
    // Send test email
    const mailOptions = {
      from: `"Harmony HCA" <${emailUser.value()}>`,
      to: emailList.join(','),
      subject: '✅ Test Email - Harmony System',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h2 style="color: #2563eb;">✅ Email System Test Successful</h2>
            <p>This is a test email from your Harmony Health Care Assistant.</p>
            <p>If you're seeing this, your email configuration is working correctly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              Sent: ${new Date().toLocaleString()}<br>
              Organization: ${orgData.name || orgId}<br>
              Recipients: ${emailList.length}
            </p>
          </div>
        </body>
        </html>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    // Log to notification history
    await db.collection('organizations').doc(orgId)
      .collection('notificationHistory').add({
        type: 'test_email',
        subject: 'Test Email - Harmony System',
        recipients: emailList,
        sentAt: Timestamp.now(),
        status: 'sent',
        sentBy: request.auth.uid
      });
    
    return { 
      success: true, 
      message: `Test email sent successfully to ${emailList.length} recipient(s)` 
    };
    
  } catch (error) {
    console.error('Test email error:', error);
    throw new HttpsError('internal', error.message || 'Failed to send test email');
  }
});

exports.generateCertificationDocs = generateCertificationDocs;