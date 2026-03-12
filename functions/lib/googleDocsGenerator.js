/**
 * functions/lib/googleDocsGenerator.js
 * Google Docs/Drive API document generator
 *
 * Workflow:
 *   1. Authenticate (with domain-wide delegation if configured)
 *   2. Copy a Google Doc template (into temp folder if configured)
 *   3. Batch replaceAllText with merge data
 *   4. Export copy as PDF buffer
 *   5. Delete the temp copy (with retry)
 *   6. Return PDF buffer
 *
 * Auth: Uses Application Default Credentials with domain-wide delegation.
 * The service account impersonates a real Google Workspace user so that
 * file operations use that user's Drive quota (service accounts have
 * zero Drive quota since April 2025).
 */

const { google } = require('googleapis');

/**
 * Build an authenticated Google API client.
 *
 * If impersonateEmail is provided, uses domain-wide delegation to act
 * as that user. Otherwise falls back to plain ADC (which will fail for
 * Drive file creation since April 2025).
 *
 * @param {string} [impersonateEmail] - Google Workspace user to impersonate
 * @returns {google.auth.GoogleAuth}
 */
function getAuthClient(impersonateEmail) {
  const authConfig = {
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  };

  // Domain-wide delegation: impersonate a real user
  if (impersonateEmail) {
    authConfig.clientOptions = {
      subject: impersonateEmail,
    };
    console.log(`Auth: Impersonating ${impersonateEmail} via domain-wide delegation`);
  } else {
    console.warn('Auth: No impersonation configured — Drive operations may fail (SA quota = 0)');
  }

  return new google.auth.GoogleAuth(authConfig);
}

/**
 * Generate a PDF from a Google Docs template using mail-merge style replacement.
 *
 * @param {string} templateDocId    - The Google Doc ID of the template to copy
 * @param {Object} mergeData        - Flat key-value object. Keys become {{KEY}} placeholders.
 * @param {string} [title]          - Optional title for the temporary copy
 * @param {string} [tempFolderId]   - Google Drive folder ID for temp copies
 * @param {string} [impersonateEmail] - Workspace user to impersonate for Drive quota
 * @returns {Promise<Buffer>}       - PDF buffer
 */
async function generateFromGoogleDoc(templateDocId, mergeData, title, tempFolderId, impersonateEmail) {
  const auth = getAuthClient(impersonateEmail);
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  let copyId;

  try {
    // 1. Copy the template
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
    // 4. Delete the temporary copy (retry once on failure)
    if (copyId) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await drive.files.delete({ fileId: copyId });
          console.log(`Temporary copy deleted: ${copyId}`);
          break;
        } catch (deleteErr) {
          console.warn(`Delete attempt ${attempt}/2 failed for ${copyId}: ${deleteErr.message}`);
          if (attempt === 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            console.error(`LEAKED TEMP FILE: ${copyId} — manual cleanup needed in _HarmonyTempDocs folder`);
          }
        }
      }
    }
  }
}

module.exports = { generateFromGoogleDoc };
