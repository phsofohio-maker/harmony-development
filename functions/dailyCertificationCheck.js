const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, emailUser, emailPass, Timestamp } = require('./firebase');
const { 
  calculatePatientCTI, 
  createTransporter, 
  sendCertificationEmail, 
  sendF2FAlertEmail 
} = require('./utils');

const dailyCertificationCheck = onSchedule({
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
        const transporter = await createTransporter(emailUser, emailPass);
        
        if (certificationAlerts.length > 0) {
          const certInfo = await sendCertificationEmail(transporter, orgSettings, certificationAlerts, emailUser);
          console.log(`Sent certification alert for ${certificationAlerts.length} patients`);
          await db.collection('organizations').doc(orgId).collection('emailHistory').add({
            type: 'certification_alert',
            subject: `Certification Alert - ${certificationAlerts.length} Patient(s)`,
            recipients: orgSettings.emailList || [],
            success: true,
            sentAt: Timestamp.now(),
            triggeredBy: 'system',
            messageId: certInfo?.messageId || null,
          });
        }

        if (f2fAlerts.length > 0) {
          const f2fInfo = await sendF2FAlertEmail(transporter, orgSettings, f2fAlerts, emailUser);
          console.log(`Sent F2F alert for ${f2fAlerts.length} patients`);
          await db.collection('organizations').doc(orgId).collection('emailHistory').add({
            type: 'certification_alert',
            subject: `F2F Encounter Alert - ${f2fAlerts.length} Patient(s)`,
            recipients: orgSettings.emailList || [],
            success: true,
            sentAt: Timestamp.now(),
            triggeredBy: 'system',
            messageId: f2fInfo?.messageId || null,
          });
        }
      }
    }
    
    console.log('Daily certification check complete');
  } catch (error) {
    console.error('Error in daily certification check:', error);
    throw error;
  }
});

module.exports = { dailyCertificationCheck };