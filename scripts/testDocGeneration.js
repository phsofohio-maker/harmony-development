/**
 * scripts/testDocGeneration.js
 * 
 * Test document generation without using the UI
 * Helpful for debugging and verification
 * 
 * USAGE:
 * 1. Make sure Cloud Function is deployed
 * 2. Get a patient ID from your Firestore
 * 3. Run: node scripts/testDocGeneration.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============ TEST CONFIGURATION ============
const TEST_CONFIG = {
  orgId: 'org_parrish',
  patientId: 'qyn8hdFlNnlt5JozoCt0',  // PASTE A PATIENT ID HERE
  documentType: '60DAY',  // Change this to test different templates
  
  // Optional custom data to pass to the template
  customData: {
    f2fProvider: 'Dr. Test Physician',
    clinicalNotes: 'Test clinical notes for generation'
  }
};

// Available document types:
// '60DAY', '90DAY_INITIAL', '90DAY_SECOND', 'ATTEND_CERT', 
// 'PROGRESS_NOTE', 'PATIENT_HISTORY', 'F2F_ENCOUNTER'

async function testDocumentGeneration() {
  console.log('🧪 Testing Document Generation\n');
  
  // Validate configuration
  if (!TEST_CONFIG.patientId) {
    console.error('❌ ERROR: Patient ID not set');
    console.error('   Please edit this script and set TEST_CONFIG.patientId\n');
    console.error('   To get a patient ID:');
    console.error('   1. Go to Firebase Console → Firestore');
    console.error('   2. Navigate to organizations/org_parrish/patients');
    console.error('   3. Copy any patient document ID\n');
    process.exit(1);
  }

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

    // 3. Call the Cloud Function locally
    console.log('3️⃣ Calling generateCertificationDocs function...');
    console.log(`   Patient: ${TEST_CONFIG.patientId}`);
    console.log(`   Document Type: ${TEST_CONFIG.documentType}\n`);

    // Import and call the function directly
    const { generateCertificationDocs } = require('../functions/generateCertificationDocs');
    
    // Create mock request object
    const mockRequest = {
      data: {
        patientId: TEST_CONFIG.patientId,
        documentType: TEST_CONFIG.documentType,
        customData: TEST_CONFIG.customData
      },
      auth: {
        uid: 'test-user-id',
        token: {
          orgId: TEST_CONFIG.orgId
        }
      }
    };

    // Call the function
    const result = await generateCertificationDocs(mockRequest);
    
    console.log('✅ Document generated successfully!\n');
    console.log('📄 Result:');
    console.log(`   Document ID: ${result.documentId}`);
    console.log(`   File Name: ${result.fileName}`);
    console.log(`   Download URL: ${result.downloadUrl}\n`);
    
    // 4. Verify document was logged
    console.log('4️⃣ Verifying document history...');
    const historyDoc = await db.collection('organizations')
      .doc(TEST_CONFIG.orgId)
      .collection('generatedDocuments')
      .doc(result.documentId)
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
      console.warn('⚠️  Document not found in history (but may still be in Storage)\n');
    }

    // 5. Check Firebase Storage
    console.log('5️⃣ Checking Firebase Storage...');
    const storage = admin.storage();
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({
      prefix: `documents/${TEST_CONFIG.orgId}/${TEST_CONFIG.patientId}/`
    });
    
    console.log(`✅ Found ${files.length} document(s) in Storage\n`);
    
    // Success!
    console.log('🎉 TEST PASSED!\n');
    console.log('📥 Download your generated PDF:');
    console.log(result.downloadUrl);
    console.log('\n✨ Document generation is working correctly!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    
    console.error('\n🔍 Troubleshooting Steps:');
    console.error('   1. Check Cloud Function logs in Firebase Console');
    console.error('   2. Verify service account has access to template');
    console.error('   3. Ensure template is shared with service account');
    console.error('   4. Check that Google Docs/Drive APIs are enabled');
    console.error('   5. Verify Firebase Storage rules allow writes\n');
    
    process.exit(1);
  }
}

// Run the test
console.log('═══════════════════════════════════════════════════════');
console.log('  DOCUMENT GENERATION TEST');
console.log('═══════════════════════════════════════════════════════\n');

testDocumentGeneration()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    console.log('═══════════════════════════════════════════════════════');
    process.exit(1);
  });