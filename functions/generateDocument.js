/**
 * functions/generateDocument.js
 * Document generation Cloud Function
 *
 * Pipeline: Google Docs API (template copy → merge → export PDF)
 * Requires Google Doc template IDs configured in org.settings.documentTemplates
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { generateFromGoogleDoc } = require('./lib/googleDocsGenerator');
const { prepareMergeData } = require('./lib/mergeData');

exports.generateDocument = onCall({
  timeoutSeconds: 120,
  memory: '512MiB',
  region: 'us-central1'
}, async (request) => {
  console.log('=== generateDocument called ===');

  const db = getFirestore();
  const storage = getStorage();

  // Extract request data
  const { patientId, documentType, assessmentId, customData = {} } = request.data;
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

    // 1b. Fetch assessment data (if assessmentId provided)
    let assessmentData = null;
    if (assessmentId) {
      console.log(`Fetching assessment: ${assessmentId}`);
      const assessmentDoc = await db.collection('organizations')
        .doc(orgId)
        .collection('patients')
        .doc(patientId)
        .collection('visits')
        .doc(assessmentId)
        .get();
      if (assessmentDoc.exists) {
        assessmentData = { id: assessmentDoc.id, ...assessmentDoc.data() };
        console.log(`Assessment loaded: ${assessmentData.visitDate || 'no date'}, type: ${assessmentData.visitType || 'unknown'}`);
      } else {
        console.warn(`Assessment ${assessmentId} not found — proceeding without assessment data`);
      }
    }

    // 2. Fetch organization data
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.exists ? orgDoc.data() : { name: 'Parrish Health Systems' };

    // 3. Build merge data
    const mergeData = prepareMergeData(patient, orgData, customData, assessmentData);

    // 4. Get Google Doc template ID
    const templateDocId = orgData?.settings?.documentTemplates?.[documentType];
    if (!templateDocId) {
      throw new HttpsError(
        'failed-precondition',
        `No Google Docs template configured for "${documentType}". ` +
        'Go to Settings → Documents to add your template URL.'
      );
    }

    // 5. Generate PDF via Google Docs API
    console.log(`Using Google Docs template: ${templateDocId} for ${documentType}`);
    const templateName = documentType.replace(/_/g, ' ');

    // Use temp Drive folder to avoid service account quota issues
    const tempFolderId = orgData?.settings?.tempDriveFolderId || null;
    if (!tempFolderId) {
      console.warn('No tempDriveFolderId configured — temp copies will land in service account root Drive');
    }

    const pdfBuffer = await generateFromGoogleDoc(
      templateDocId,
      mergeData,
      `${documentType} - ${patient.name} - ${new Date().toISOString().split('T')[0]}`,
      tempFolderId
    );

    console.log(`PDF generated: ${pdfBuffer.length} bytes`);

    // 6. Upload to Firebase Cloud Storage
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

    // 7. Generate signed URL (7-day expiry)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt
    });
    console.log('Signed URL generated');

    // 8. Log to Firestore
    const historyRef = await db.collection('organizations')
      .doc(orgId)
      .collection('generatedDocuments')
      .add({
        patientId,
        patientName: patient.name,
        documentType,
        templateName,
        storagePath,
        downloadUrl,
        urlExpiresAt: Timestamp.fromMillis(expiresAt),
        fileSize: pdfBuffer.length,
        generatedBy: userId,
        generatedAt: Timestamp.now(),
        assessmentId: assessmentId || null,
        metadata: customData
      });

    console.log(`Document logged: ${historyRef.id}`);

    return {
      success: true,
      documentId: historyRef.id,
      fileName,
      storagePath,
      downloadUrl,
      fileSize: pdfBuffer.length,
      expiresAt: new Date(expiresAt).toISOString(),
      message: `${templateName} generated successfully`
    };

  } catch (error) {
    console.error('Document generation error:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', `Failed to generate document: ${error.message}`);
  }
});
