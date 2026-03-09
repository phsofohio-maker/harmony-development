/**
 * scripts/verifyDatabase.js
 * 
 * Comprehensive database verification script
 * Checks all collections and required fields
 * 
 * USAGE: node scripts/verifyDatabase.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function verifyDatabase() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  HARMONY DATABASE VERIFICATION REPORT');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const issues = [];
  const warnings = [];
  
  try {
    // ============ CHECK ORGANIZATION ============
    console.log('📁 ORGANIZATION STRUCTURE\n');
    
    const orgDoc = await db.collection('organizations').doc('org_parrish').get();
    
    if (!orgDoc.exists) {
      console.log('❌ Organization document missing!');
      issues.push('Organization document does not exist');
    } else {
      console.log('✅ Organization document exists');
      const orgData = orgDoc.data();
      
      // Check name
      if (orgData.name) {
        console.log(`   Name: ${orgData.name}`);
      } else {
        console.log('⚠️  Organization name missing');
        warnings.push('Organization name not set');
      }
      
      // Check emailList
      if (orgData.emailList && Array.isArray(orgData.emailList)) {
        console.log(`✅ Email list configured (${orgData.emailList.length} recipients)`);
        orgData.emailList.forEach(email => console.log(`   - ${email}`));
      } else {
        console.log('❌ Email list missing or empty');
        issues.push('Email list not configured - notifications will not send');
      }
      
      // Check notifications settings
      if (orgData.notifications) {
        console.log('✅ Notification settings configured');
        console.log(`   Daily Alerts: ${orgData.notifications.dailyAlerts ? 'ON' : 'OFF'}`);
        console.log(`   Weekly Summary: ${orgData.notifications.weeklySummary ? 'ON' : 'OFF'}`);
        console.log(`   HUV Reports: ${orgData.notifications.huvReports ? 'ON' : 'OFF'}`);
        console.log(`   F2F Alerts: ${orgData.notifications.f2fAlerts ? 'ON' : 'OFF'}`);
        console.log(`   Lead Days: ${orgData.notifications.leadDays || 14}`);
      } else {
        console.log('⚠️  Notification settings missing');
        warnings.push('Notification settings not configured');
      }
      
      // Check document templates
      if (orgData.settings?.documentTemplates) {
        const templates = orgData.settings.documentTemplates;
        const templateKeys = Object.keys(templates);
        const EXPECTED_KEYS = ['CTI', 'ATTEND_CTI', 'PROGRESS_NOTE', 'PHYSICIAN_HP', 'HOME_VISIT_ASSESSMENT'];
        const DEPRECATED_KEYS = ['60DAY', '90DAY_INITIAL', '90DAY_SECOND', 'ATTEND_CERT', 'PATIENT_HISTORY', 'F2F_ENCOUNTER'];

        if (templateKeys.length > 0) {
          console.log(`✅ Document templates configured (${templateKeys.length} templates)`);
          templateKeys.forEach(key => {
            const id = templates[key];
            if (DEPRECATED_KEYS.includes(key)) {
              console.log(`   ⚠️  ${key}: DEPRECATED KEY — should be migrated`);
              warnings.push(`Deprecated template key found: ${key}`);
            } else {
              console.log(`   ${key}: ${id || '❌ MISSING'}`);
              if (!id) {
                issues.push(`Template missing: ${key}`);
              }
            }
          });
          // Check for missing expected keys
          EXPECTED_KEYS.forEach(key => {
            if (!templates[key]) {
              console.log(`   ❌ Expected template key missing: ${key}`);
              issues.push(`Expected template key not configured: ${key}`);
            }
          });
        } else {
          console.log('⚠️  Document templates object exists but is empty');
          warnings.push('No document templates configured yet');
        }
      } else {
        console.log('⚠️  Document templates not configured');
        warnings.push('Document generation will not work until templates are configured');
      }
    }
    
    // ============ CHECK USERS ============
    console.log('\n👥 USERS COLLECTION\n');
    
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in database');
      issues.push('Users collection is empty');
    } else {
      console.log(`✅ Found ${usersSnapshot.size} user(s)`);
      
      let usersWithIssues = 0;
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        console.log(`\n   User: ${userData.email || userId}`);
        console.log(`   - Organization: ${userData.organizationId || '❌ MISSING'}`);
        console.log(`   - Role: ${userData.role || '❌ MISSING'}`);
        console.log(`   - Custom Claims Set: ${userData.customClaimsSet ? '✅' : '❌'}`);
        
        if (!userData.organizationId || !userData.role || !userData.customClaimsSet) {
          usersWithIssues++;
          issues.push(`User ${userData.email || userId} has configuration issues`);
        }
      });
      
      if (usersWithIssues > 0) {
        console.log(`\n⚠️  ${usersWithIssues} user(s) have configuration issues`);
      }
    }
    
    // ============ CHECK PATIENTS ============
    console.log('\n🏥 PATIENTS COLLECTION\n');
    
    const patientsSnapshot = await db.collection('organizations')
      .doc('org_parrish')
      .collection('patients')
      .get();
    
    if (patientsSnapshot.empty) {
      console.log('⚠️  No patients in database');
      warnings.push('Patients collection is empty - add test data or real patients');
    } else {
      console.log(`✅ Found ${patientsSnapshot.size} patient(s)`);
      
      // Check first patient for required fields
      const firstPatient = patientsSnapshot.docs[0];
      const patientData = firstPatient.data();
      
      console.log('\n   Checking patient field structure (sample patient):');
      
      const requiredFields = {
        'Basic Info': ['name', 'mrNumber', 'dateOfBirth'],
        'Admission': ['admissionDate', 'startOfCare'],
        'Benefit Period': ['startingBenefitPeriod', 'isReadmission', 'priorHospiceDays'],
        'F2F Tracking': ['f2fRequired', 'f2fCompleted', 'f2fDate', 'f2fPhysician'],
        'HUV Tracking': ['huv1Completed', 'huv1Date', 'huv2Completed', 'huv2Date'],
        'Clinical': ['attendingPhysician'],
        'Status': ['status'],
        'Metadata': ['createdAt', 'updatedAt']
      };
      
      let missingFields = [];
      
      Object.entries(requiredFields).forEach(([category, fields]) => {
        console.log(`\n   ${category}:`);
        fields.forEach(field => {
          const exists = patientData[field] !== undefined;
          console.log(`   ${exists ? '✅' : '❌'} ${field}`);
          if (!exists) {
            missingFields.push(field);
          }
        });
      });
      
      if (missingFields.length > 0) {
        issues.push(`Patients missing fields: ${missingFields.join(', ')}`);
        console.log('\n⚠️  Some patients may be missing new fields');
        console.log('   Run migration: node scripts/migratePatients.js');
      }
      
      // Count by status
      const statusCounts = {};
      patientsSnapshot.forEach(doc => {
        const status = doc.data().status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log('\n   Patient Status Distribution:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
    }
    
    // ============ CHECK GENERATED DOCUMENTS ============
    console.log('\n📄 GENERATED DOCUMENTS\n');
    
    const docsSnapshot = await db.collection('organizations')
      .doc('org_parrish')
      .collection('generatedDocuments')
      .limit(5)
      .get();
    
    if (docsSnapshot.empty) {
      console.log('⚠️  No generated documents yet');
      console.log('   This is normal if you haven\'t used document generation');
    } else {
      console.log(`✅ Found ${docsSnapshot.size} recent document(s)`);
      docsSnapshot.forEach(doc => {
        const docData = doc.data();
        console.log(`   - ${docData.templateType} for ${docData.patientName}`);
      });
    }
    
    // ============ CHECK NOTIFICATION HISTORY ============
    console.log('\n🔔 NOTIFICATION HISTORY\n');
    
    const notifsSnapshot = await db.collection('organizations')
      .doc('org_parrish')
      .collection('notificationHistory')
      .limit(5)
      .get();
    
    if (notifsSnapshot.empty) {
      console.log('⚠️  No notification history yet');
      console.log('   This is normal if automated emails haven\'t been sent');
    } else {
      console.log(`✅ Found ${notifsSnapshot.size} recent notification(s)`);
      notifsSnapshot.forEach(doc => {
        const notifData = doc.data();
        const sentDate = notifData.sentAt?.toDate().toLocaleString();
        console.log(`   - ${notifData.type} sent ${sentDate}`);
      });
    }
    
    // ============ FINAL REPORT ============
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('🎉 ALL CHECKS PASSED!');
      console.log('Your database is properly configured.\n');
    } else {
      if (issues.length > 0) {
        console.log(`❌ CRITICAL ISSUES (${issues.length}):\n`);
        issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
        console.log('');
      }
      
      if (warnings.length > 0) {
        console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
        warnings.forEach((warning, i) => console.log(`   ${i + 1}. ${warning}`));
        console.log('');
      }
      
      console.log('📋 RECOMMENDED ACTIONS:\n');
      
      if (issues.includes('Organization document does not exist')) {
        console.log('   1. Run: node scripts/initOrganization.js');
      }
      if (issues.find(i => i.includes('Email list'))) {
        console.log('   2. Configure email list in Settings page or Firestore Console');
      }
      if (warnings.find(w => w.includes('document templates'))) {
        console.log('   3. Run: node scripts/configureTemplates.js (after creating Google Docs)');
      }
      if (issues.find(i => i.includes('Patients missing fields'))) {
        console.log('   4. Run: node scripts/migratePatients.js');
      }
      if (issues.find(i => i.includes('User') && i.includes('configuration'))) {
        console.log('   5. Set user custom claims via Cloud Function or Firebase Console');
      }
      
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run verification
verifyDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });