/**
 * scripts/testDocumentGeneration.js
 * 
 * Test document generation by calling the DEPLOYED Cloud Function
 * This requires the function to be deployed first
 * 
 * USAGE:
 * 1. Make sure function is deployed: firebase deploy --only functions:generateCertificationDocs
 * 2. Make sure service-account-key.json is in project root
 * 3. Update PATIENT_ID below
 * 4. Run: node scripts/testDocumentGeneration.js
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin with service account
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'parrish-harmonyhca.firebasestorage.app'
});

const db = admin.firestore();
const auth = admin.auth();

// ============ TEST CONFIGURATION ============
const TEST_CONFIG = {
  orgId: 'org_parrish',
  patientId: '8uUbTbb5wFftzAIuxQqG',  // Your patient ID
  documentType: 'CTI',
  userEmail: 'kobet@parrishhealthsystems.org',  // Your email
  
  customData: {
    f2fProvider: 'Dr. Test Physician',
    clinicalNotes: 'Test clinical notes for generation'
  }
};

async function testDocumentGeneration() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  DOCUMENT GENERATION TEST');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Verify patient exists
    console.log('1️⃣ Checking patient exists...');
    const patientRef = db.collection('organizations')
      .doc(TEST_CONFIG.orgId)
      .collection('patients')
      .doc(TEST_CONFIG.patientId);
    
    const patientDoc = await patientRef.get();
    if (!patientDoc.exists) {
      console.error(`❌ Patient not found: ${TEST_CONFIG.patientId}`);
      process.exit(1);
    }
    console.log(`✅ Found patient: ${patientDoc.data().name}\n`);

    // 2. Verify template is configured
    console.log('2️⃣ Checking template configuration...');
    const orgDoc = await db.collection('organizations')
      .doc(TEST_CONFIG.orgId)
      .get();
    
    const templates = orgDoc.data()?.settings?.documentTemplates || {};
    const templateId = templates[TEST_CONFIG.documentType];
    
    if (!templateId) {
      console.error(`❌ Template not configured: ${TEST_CONFIG.documentType}`);
      console.error('   Available templates:', Object.keys(templates));
      console.error('\n   Run: node scripts/configureTemplates.js\n');
      process.exit(1);
    }
    console.log(`✅ Template ID found: ${templateId}\n`);

    // 3. Get user and create auth token
    console.log('3️⃣ Creating authentication token...');
    const userSnapshot = await db.collection('users')
      .where('email', '==', TEST_CONFIG.userEmail)
      .limit(1)
      .get();
    
    if (userSnapshot.empty) {
      console.error(`❌ User not found: ${TEST_CONFIG.userEmail}`);
      process.exit(1);
    }

    const userId = userSnapshot.docs[0].id;
    const userData = userSnapshot.docs[0].data();
    
    // Create a custom token with claims
    const customToken = await auth.createCustomToken(userId, {
      orgId: userData.organizationId,
      role: userData.role
    });
    
    console.log(`✅ Auth token created for user: ${TEST_CONFIG.userEmail}\n`);

    // 4. Get ID token by signing in with custom token
    console.log('4️⃣ Getting ID token...');
    
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBzGdm-l11apHUHkioaEQg8vuRA4vTrhis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true
        })
      }
    );

    const signInData = await signInResponse.json();
    if (!signInData.idToken) {
      console.error('❌ Failed to get ID token');
      console.error(signInData);
      process.exit(1);
    }

    const idToken = signInData.idToken;
    console.log('✅ ID token obtained\n');

    // 5. Call the Cloud Function
    console.log('5️⃣ Calling generateCertificationDocs Cloud Function...');
    console.log(`   Patient: ${TEST_CONFIG.patientId}`);
    console.log(`   Document Type: ${TEST_CONFIG.documentType}\n`);

    const functionUrl = `https://us-central1-parrish-harmonyhca.cloudfunctions.net/generateCertificationDocs`;
    
    console.log('   Calling:', functionUrl);
    console.log('');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        data: {
          patientId: TEST_CONFIG.patientId,
          documentType: TEST_CONFIG.documentType,
          customData: TEST_CONFIG.customData
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Function call failed with status ${response.status}`);
      console.error('Response:', errorText);
      
      if (response.status === 404) {
        console.error('\n💡 Function not deployed or URL incorrect');
        console.error('   Deploy with: firebase deploy --only functions:generateCertificationDocs');
        console.error('\n   Or check function name in Firebase Console\n');
      }
      
      if (response.status === 401 || response.status === 403) {
        console.error('\n💡 Authentication issue');
        console.error('   Make sure user custom claims are set');
        console.error('   Run: node scripts/fixUserClaims.js\n');
      }
      
      process.exit(1);
    }

    const result = await response.json();
    
    if (result.error) {
      console.error('❌ Function returned error:');
      console.error(JSON.stringify(result.error, null, 2));
      process.exit(1);
    }

    console.log('✅ Document generated successfully!\n');
    console.log('📄 Result:');
    console.log(JSON.stringify(result.result, null, 2));
    console.log('');
    
    // 6. Verify document was logged
    console.log('6️⃣ Verifying document in Firestore...');
    
    if (result.result.documentId) {
      const historyDoc = await db.collection('organizations')
        .doc(TEST_CONFIG.orgId)
        .collection('generatedDocuments')
        .doc(result.result.documentId)
        .get();
      
      if (historyDoc.exists) {
        console.log('✅ Document logged in Firestore\n');
        const data = historyDoc.data();
        console.log('📋 Document Details:');
        console.log(`   Patient: ${data.patientName}`);
        console.log(`   Template: ${data.templateType}`);
        console.log(`   Generated: ${data.generatedAt.toDate().toLocaleString()}`);
        console.log(`   Expires: ${data.expiresAt.toDate().toLocaleString()}\n`);
      } else {
        console.warn('⚠️  Document not found in Firestore history\n');
      }
    }

    // Success!
    console.log('═══════════════════════════════════════════════════════');
    console.log('  TEST PASSED!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('🎉 Document generation is working correctly!\n');
    
    if (result.result.downloadUrl) {
      console.log('📥 Download your generated PDF:');
      console.log(result.result.downloadUrl);
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Network issue - check your internet connection');
    } else if (error.message.includes('service-account-key.json')) {
      console.error('\n💡 Service account key not found');
      console.error('   Make sure service-account-key.json is in project root');
      console.error('   Download from: Firebase Console → Project Settings → Service Accounts\n');
    } else {
      console.error('\nFull error:', error);
    }
    
    console.error('\n🔍 Troubleshooting Steps:');
    console.error('   1. Make sure function is deployed:');
    console.error('      firebase deploy --only functions:generateCertificationDocs');
    console.error('   2. Check function exists in Firebase Console');
    console.error('   3. Verify service account key is in project root');
    console.error('   4. Check Cloud Function logs for errors');
    console.error('   5. Ensure user has custom claims set\n');
    
    process.exit(1);
  }
}

// Run the test
testDocumentGeneration()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFatal error:', error);
    console.log('═══════════════════════════════════════════════════════\n');
    process.exit(1);
  });