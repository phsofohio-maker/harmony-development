const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, emailUser, emailPass } = require('./firebase');
const { 
  calculatePatientCTI, 
  createTransporter, 
  formatDate 
} = require('./utils');

const weeklySummary = onSchedule({
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
      
      const transporter = await createTransporter(emailUser, emailPass);
      
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

module.exports = { weeklySummary };