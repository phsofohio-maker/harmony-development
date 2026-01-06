/**
 * functions/purgeDrive.js
 * Run this ONCE to clean the Service Account's full drive
 */
const { onCall } = require('firebase-functions/v2/https');
const { google } = require('googleapis');

exports.purgeDrive = onCall(async (request) => {
  // Only allow admins to run this
  // if (request.auth.token.role !== 'owner') throw new HttpsError('permission-denied');

  console.log('🧹 Starting Drive Cleanup...');
  
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const drive = google.drive({ version: 'v3', auth });

  let deletedCount = 0;
  let pageToken = null;

  try {
    do {
      // 1. List files owned by the service account
      const res = await drive.files.list({
        q: "'me' in owners and trashed = false",
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive',
        pageToken: pageToken
      });

      const files = res.data.files;
      if (files.length === 0) {
        console.log('No files found.');
        break;
      }

      // 2. Delete them one by one
      for (const file of files) {
        console.log(`Deleting file: ${file.name} (${file.id})`);
        await drive.files.delete({ fileId: file.id });
        deletedCount++;
      }

      pageToken = res.data.nextPageToken;
    } while (pageToken);

    return {
      success: true,
      message: `Successfully deleted ${deletedCount} files. Drive should be empty.`
    };

  } catch (error) {
    console.error('Cleanup failed:', error);
    throw new Error(`Cleanup failed: ${error.message}`);
  }
});