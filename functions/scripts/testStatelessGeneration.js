/**
 * scripts/testStatelessGeneration.js
 * Test the new stateless document generation
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'parrish-harmonyhca',
  storageBucket: 'parrish-harmonyhca.firebasestorage.app'
});

const TEST_CONFIG = {
  orgId: 'org_parrish',
  patientId: 'qyn8hdFlNnlt5JozoCt0', // Update with real patient ID
  documentType: '60DAY',
  userEmail: 'kobet@parrishhealthsystems.org'
};

async function test() {
  console.log('\n🧪 Testing Stateless Document Generation\n');
  
  const db = admin.firestore();
  const auth = admin.auth();
  
  // Get user and create custom token
  const user = await auth.getUserByEmail(TEST_CONFIG.userEmail);
  const customToken = await auth.createCustomToken(user.uid, {
    orgId: TEST_CONFIG.orgId
  });
  
  // Exchange for ID token (simplified - in real test use Firebase Auth REST API)
  console.log('✓ User authenticated');
  
  // Verify template exists
  const templateDoc = await db.collection('organizations')
    .doc(TEST_CONFIG.orgId)
    .collection('documentTemplates')
    .doc(TEST_CONFIG.documentType)
    .get();
  
  if (!templateDoc.exists) {
    console.error('❌ Template not found! Run: node scripts/initDocumentTemplates.js');
    process.exit(1);
  }
  console.log(`✓ Template found: ${templateDoc.data().name}`);
  
  // Verify patient exists
  const patientDoc = await db.collection('organizations')
    .doc(TEST_CONFIG.orgId)
    .collection('patients')
    .doc(TEST_CONFIG.patientId)
    .get();
  
  if (!patientDoc.exists) {
    console.error('❌ Patient not found!');
    process.exit(1);
  }
  console.log(`✓ Patient found: ${patientDoc.data().name}`);
  
  console.log('\n📋 Configuration verified. Test the function via:');
  console.log('   1. Firebase Console → Functions → generateDocument → Test');
  console.log('   2. Or call from frontend DocumentsPage component\n');
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});