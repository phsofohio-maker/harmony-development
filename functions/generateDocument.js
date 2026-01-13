/**
 * functions/generateDocument.js
 * Stateless document generation - NO Google Drive dependency
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { generatePDF } = require('./lib/pdfGenerator');

exports.generateDocument = onCall({
  timeoutSeconds: 60,
  memory: '512MiB',
  region: 'us-central1'
}, async (request) => {
  console.log('=== generateDocument (Stateless) called ===');

  const db = getFirestore();
  const storage = getStorage();

  // Extract request data
  const { patientId, documentType, customData = {} } = request.data;
  const userId = request.auth?.uid;
  const orgId = request.auth?.token?.orgId;

  // Validate authentication
  if (!userId) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  if (!orgId) {
    throw new HttpsError('permission-denied', 'User does not have organization access');
  }

  // Validate input
  if (!patientId) {
    throw new HttpsError('invalid-argument', 'Patient ID is required');
  }
  if (!documentType) {
    throw new HttpsError('invalid-argument', 'Document type is required');
  }

  try {
    // 1. Fetch patient data
    console.log(`Fetching patient: ${patientId}`);
    const patientDoc = await db.collection('organizations')
      .doc(orgId)
      .collection('patients')
      .doc(patientId)
      .get();

    if (!patientDoc.exists) {
      throw new HttpsError('not-found', 'Patient not found');
    }
    const patient = { id: patientDoc.id, ...patientDoc.data() };
    console.log(`Patient: ${patient.name}`);

    // 2. Fetch template configuration
    console.log(`Fetching template: ${documentType}`);
    const templateDoc = await db.collection('organizations')
      .doc(orgId)
      .collection('documentTemplates')
      .doc(documentType)
      .get();

    if (!templateDoc.exists) {
      throw new HttpsError('not-found', `Template not found: ${documentType}. Run initDocumentTemplates.js first.`);
    }
    const templateConfig = templateDoc.data();
    console.log(`Template: ${templateConfig.name}`);

    // 3. Fetch organization data
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.exists ? orgDoc.data() : { name: 'Parrish Health Systems' };

    // 4. Generate PDF (stateless - no Drive!)
    console.log('Generating PDF...');
    const pdfBuffer = await generatePDF(templateConfig, patient, orgData, customData);
    console.log(`PDF generated: ${pdfBuffer.length} bytes`);

    // 5. Upload to Firebase Cloud Storage
    const bucket = storage.bucket();
    const timestamp = Date.now();
    const fileName = `${documentType}_${patient.name.replace(/\s+/g, '_')}_${timestamp}.pdf`;
    const storagePath = `organizations/${orgId}/documents/${patientId}/${fileName}`;
    
    console.log(`Uploading to: ${storagePath}`);
    const file = bucket.file(storagePath);
    
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          patientId,
          patientName: patient.name,
          documentType,
          generatedBy: userId,
          generatedAt: new Date().toISOString()
        }
      }
    });

    // 6. Generate signed URL (7-day expiry)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt
    });
    console.log('Signed URL generated');

    // 7. Log to Firestore
    const historyRef = await db.collection('organizations')
      .doc(orgId)
      .collection('generatedDocuments')
      .add({
        patientId,
        patientName: patient.name,
        documentType,
        templateName: templateConfig.name,
        storagePath,
        downloadUrl,
        urlExpiresAt: Timestamp.fromMillis(expiresAt),
        fileSize: pdfBuffer.length,
        generatedBy: userId,
        generatedAt: Timestamp.now(),
        metadata: customData
      });

    console.log(`✅ Document logged: ${historyRef.id}`);

    return {
      success: true,
      documentId: historyRef.id,
      fileName,
      storagePath,
      downloadUrl,
      fileSize: pdfBuffer.length,
      expiresAt: new Date(expiresAt).toISOString(),
      message: `${templateConfig.name} generated successfully`
    };

  } catch (error) {
    console.error('❌ Document generation error:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', `Failed to generate document: ${error.message}`);
  }
});