/**
 * Run this with: node scripts/manualPurge.js
 * (Requires: npm install googleapis)
 */
import { google } from 'googleapis';

async function purgeDrive() {
  console.log('🧹 Starting Drive Cleanup...');

  // Use your local credentials (ADC)
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  const drive = google.drive({ version: 'v3', auth });
  let deletedCount = 0;
  let pageToken = null;

  try {
    do {
      // List files owned by the service account
      const res = await drive.files.list({
        q: "'me' in owners and trashed = false",
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive',
        pageToken: pageToken
      });

      const files = res.data.files;
      if (!files || files.length === 0) {
        console.log('✨ No files found. Drive is empty!');
        break;
      }

      // Delete them
      for (const file of files) {
        console.log(`Deleting: ${file.name} (${file.id})`);
        await drive.files.delete({ fileId: file.id });
        deletedCount++;
      }

      pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log(`✅ Cleanup complete. Deleted ${deletedCount} files.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('Tip: Ensure you have run "gcloud auth application-default login" if running locally.');
  }
}

purgeDrive();