/**
 * functions/lib/googleDocsGenerator.js
 * Google Docs/Drive API document generator
 *
 * Workflow:
 *   1. Copy a Google Doc template
 *   2. Batch replaceAllText with merge data
 *   3. Export copy as PDF
 *   4. Delete the copy
 *   5. Return PDF buffer
 *
 * Requires a service account with Google Docs & Drive API access.
 * The service account JSON key is stored in Firebase Functions config
 * or as a GOOGLE_SERVICE_ACCOUNT_KEY environment variable.
 */

const { google } = require('googleapis');

/**
 * Build an authenticated Google API client from service account credentials.
 * Looks for credentials in this order:
 *   1. GOOGLE_SERVICE_ACCOUNT_KEY env var (JSON string)
 *   2. functions.config().google.service_account_key (Firebase config)
 */
function getAuthClient() {
  let credentials;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } else {
    throw new Error(
      'Google service account credentials not found. ' +
      'Set GOOGLE_SERVICE_ACCOUNT_KEY env var with the service account JSON.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return auth;
}

/**
 * Generate a PDF from a Google Docs template using mail-merge style replacement.
 *
 * @param {string} templateDocId - The Google Doc ID of the template to copy
 * @param {Object} mergeData     - Flat key-value object. Keys become {{KEY}} placeholders.
 * @param {string} [title]       - Optional title for the temporary copy
 * @returns {Promise<Buffer>}    - PDF buffer
 */
async function generateFromGoogleDoc(templateDocId, mergeData, title) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  let copyId;

  try {
    // 1. Copy the template
    console.log(`Copying template: ${templateDocId}`);
    const copyResponse = await drive.files.copy({
      fileId: templateDocId,
      requestBody: {
        name: title || `Generated_${Date.now()}`,
      },
    });
    copyId = copyResponse.data.id;
    console.log(`Template copy created: ${copyId}`);

    // 2. Build batch replaceAllText requests
    const requests = [];
    for (const [key, value] of Object.entries(mergeData)) {
      // Skip null/undefined values — leave placeholder as-is
      if (value == null) continue;

      requests.push({
        replaceAllText: {
          containsText: {
            text: `{{${key}}}`,
            matchCase: true,
          },
          replaceText: String(value),
        },
      });
    }

    if (requests.length > 0) {
      console.log(`Replacing ${requests.length} merge fields...`);
      await docs.documents.batchUpdate({
        documentId: copyId,
        requestBody: { requests },
      });
    }

    // 3. Export as PDF
    console.log('Exporting as PDF...');
    const exportResponse = await drive.files.export(
      { fileId: copyId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );

    const pdfBuffer = Buffer.from(exportResponse.data);
    console.log(`PDF exported: ${pdfBuffer.length} bytes`);

    return pdfBuffer;
  } finally {
    // 4. Delete the temporary copy (best-effort)
    if (copyId) {
      try {
        await drive.files.delete({ fileId: copyId });
        console.log(`Temporary copy deleted: ${copyId}`);
      } catch (deleteErr) {
        console.warn(`Failed to delete temporary copy ${copyId}:`, deleteErr.message);
      }
    }
  }
}

module.exports = { generateFromGoogleDoc };
