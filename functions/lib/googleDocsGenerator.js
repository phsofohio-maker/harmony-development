/**
 * functions/lib/googleDocsGenerator.js
 * Google Docs/Drive API document generator
 *
 * Workflow:
 *   1. Copy a Google Doc template (into temp folder if configured)
 *   2. Batch replaceAllText with merge data
 *   3. Export copy as PDF
 *   4. Delete the copy (with retry)
 *   5. Return PDF buffer
 *
 * Uses Application Default Credentials (ADC) — no service account key needed.
 * In Cloud Functions, ADC automatically uses the function's service account.
 */

const { google } = require('googleapis');

/**
 * Build an authenticated Google API client using Application Default Credentials.
 * In Cloud Functions this resolves to the function's service account automatically.
 */
function getAuthClient() {
  return new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

/**
 * Generate a PDF from a Google Docs template using mail-merge style replacement.
 *
 * @param {string} templateDocId  - The Google Doc ID of the template to copy
 * @param {Object} mergeData      - Flat key-value object. Keys become {{KEY}} placeholders.
 * @param {string} [title]        - Optional title for the temporary copy
 * @param {string} [tempFolderId] - Optional Drive folder ID to place the temp copy in
 * @returns {Promise<Buffer>}     - PDF buffer
 */
async function generateFromGoogleDoc(templateDocId, mergeData, title, tempFolderId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  let copyId;

  try {
    // 1. Copy the template (into temp folder if configured)
    const copyRequestBody = {
      name: title || `Generated_${Date.now()}`,
    };

    if (tempFolderId) {
      copyRequestBody.parents = [tempFolderId];
      console.log(`Target folder: ${tempFolderId}`);
    }

    console.log(`Copying template: ${templateDocId}`);
    const copyResponse = await drive.files.copy({
      fileId: templateDocId,
      requestBody: copyRequestBody,
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
    // 4. Delete the temporary copy (best-effort, with retry)
    if (copyId) {
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await drive.files.delete({ fileId: copyId });
          console.log(`Temporary copy deleted: ${copyId}`);
          break;
        } catch (deleteErr) {
          if (attempt < maxAttempts) {
            console.warn(`Delete attempt ${attempt} failed, retrying in 1.5s...`);
            await new Promise(r => setTimeout(r, 1500));
          } else {
            console.error(
              `LEAKED temp file — failed to delete after ${maxAttempts} attempts. ` +
              `File ID: ${copyId}, Folder: ${tempFolderId || 'default'}. ` +
              `Error: ${deleteErr.message}`
            );
          }
        }
      }
    }
  }
}

module.exports = { generateFromGoogleDoc };
