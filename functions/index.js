/**
 * Harmony Health Care Assistant
 * Cloud Functions v2 - Complete Backend
 */

const { testEmail } = require('./testEmail');
const { generateDocument } = require('./generateDocument');

// User Management
const { setUserClaims } = require('./setUserClaims');
const { updateUserClaims } = require('./updateUserClaims');
const { refreshUserClaims } = require('./refreshUserClaims');

// Notification functions
const { dailyCertificationCheck } = require('./dailyCertificationCheck');
const { weeklySummary } = require('./weeklySummary');

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { emailUser, emailPass } = require('./firebase');
// Invitation system
const { sendInvite } = require('./sendInvite');
const { acceptInvite } = require('./acceptInvite');
const { resendInvite, cancelInvite, createInvite } = require('./manageInvites');

// Patient import/export
const { exportPatients, importPatients } = require('./patientImportExport');
/**
 * Manually trigger certification check (for testing)
 * Note: Since this is just a test trigger, I kept it here. 
 * If you want it separate, create triggerCertificationCheck.js
 */
const triggerCertificationCheck = onCall({
  secrets: [emailUser, emailPass]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  // Reuse the scheduled function logic
  await dailyCertificationCheck.run();
  
  return { success: true, message: 'Certification check triggered' };
});
// Export all functions
module.exports = {
  // User management
  setUserClaims,
  updateUserClaims,
  refreshUserClaims,
  
  // Scheduled
  dailyCertificationCheck,
  weeklySummary,
  
  // Documents
  generateDocument,
  
  // Invitations
  sendInvite,
  acceptInvite,
  resendInvite,
  cancelInvite,
  createInvite,
  
  // Patient data
  exportPatients,
  importPatients,

  //Other
  testEmail,
  triggerCertificationCheck,
};