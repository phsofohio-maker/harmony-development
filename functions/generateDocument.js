/**
 * functions/generateDocument.js
 * Document generation Cloud Function
 *
 * Primary pipeline: Google Docs API (template copy → merge → export PDF)
 * Fallback pipeline: PDFKit (for orgs that haven't configured Google Doc templates)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { generateFromGoogleDoc } = require('./lib/googleDocsGenerator');
const { generatePDF, prepareMergeData } = require('./lib/pdfGenerator');

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

    // 3. Build merge data (shared between Google Docs and PDFKit pipelines)
    const mergeData = prepareMergeData(patient, orgData, customData, assessmentData);

    // 4. Determine generation method: Google Docs template or PDFKit fallback
    const templateDocId = orgData?.settings?.documentTemplates?.[documentType];
    let pdfBuffer;
    let templateName;

    if (templateDocId) {
      // ── Google Docs pipeline ──────────────────────────────────
      console.log(`Using Google Docs template: ${templateDocId} for ${documentType}`);
      templateName = `${documentType.replace(/_/g, ' ')} (Google Docs)`;
      pdfBuffer = await generateFromGoogleDoc(
        templateDocId,
        mergeData,
        `${documentType} - ${patient.name} - ${new Date().toISOString().split('T')[0]}`
      );
    } else {
      // ── PDFKit fallback ───────────────────────────────────────
      console.log(`No Google Docs template for ${documentType} — using PDFKit fallback`);

      // Try Firestore-based template config
      const templateDoc = await db.collection('organizations')
        .doc(orgId)
        .collection('documentTemplates')
        .doc(documentType)
        .get();

      let templateConfig;
      if (templateDoc.exists) {
        templateConfig = templateDoc.data();
        templateName = templateConfig.name;
      } else {
        // Generic fallback template
        templateName = documentType.replace(/_/g, ' ');
        templateConfig = {
          name: templateName,
          documentType,
          layout: { pageSize: 'LETTER' },
          header: { includeOrgName: true, includeDate: true },
          sections: [
            { type: 'title', content: templateName, style: { fontSize: 16, bold: true } },
            { type: 'patientInfo', fields: ['name', 'dob', 'mrn', 'admissionDate', 'currentPeriod', 'diagnosis'] },
            { type: 'benefitPeriod' },
            { type: 'attendingPhysician', fields: ['attendingName', 'npi'] },
            { type: 'paragraph', content: customData.narrativeNotes || customData.interventions || '', style: { fontSize: 11 } },
            { type: 'signatureBlock', signers: ['clinician', 'physician'], style: { marginTop: 40 } },
          ],
          footer: { content: 'Generated by Harmony HCA' },
        };
      }

      pdfBuffer = await generatePDF(templateConfig, patient, orgData, customData, assessmentData);
    }

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
        templateName,
        storagePath,
        downloadUrl,
        urlExpiresAt: Timestamp.fromMillis(expiresAt),
        fileSize: pdfBuffer.length,
        generatedBy: userId,
        generatedAt: Timestamp.now(),
        assessmentId: assessmentId || null,
        usedGoogleDocs: !!templateDocId,
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
