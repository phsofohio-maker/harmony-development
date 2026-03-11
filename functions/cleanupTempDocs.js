/**
 * functions/cleanupTempDocs.js
 * Scheduled Cloud Function — deletes stale temp document copies from shared Drive folders.
 *
 * Runs daily at 2:00 AM ET. For each org with a tempDriveFolderId configured,
 * lists files older than 2 hours and deletes them.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { google } = require('googleapis');

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

exports.cleanupTempDocs = onSchedule({
  schedule: '0 2 * * *',        // daily at 2:00 AM (UTC — adjust if needed)
  timeZone: 'America/New_York',
  timeoutSeconds: 120,
  memory: '256MiB',
  region: 'us-central1',
}, async () => {
  const db = getFirestore();
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Collect all orgs that have a tempDriveFolderId
  const orgsSnap = await db.collection('organizations').get();
  const folders = [];
  orgsSnap.forEach(doc => {
    const folderId = doc.data()?.settings?.tempDriveFolderId;
    if (folderId) {
      folders.push({ orgId: doc.id, folderId });
    }
  });

  if (folders.length === 0) {
    console.log('No organizations have tempDriveFolderId configured — nothing to clean.');
    return;
  }

  const cutoff = new Date(Date.now() - TWO_HOURS_MS).toISOString();
  let totalDeleted = 0;
  let totalErrors = 0;

  for (const { orgId, folderId } of folders) {
    try {
      console.log(`Cleaning folder ${folderId} for org ${orgId}...`);

      // List files in the temp folder older than cutoff
      const res = await drive.files.list({
        q: `'${folderId}' in parents and createdTime < '${cutoff}' and trashed = false`,
        fields: 'files(id, name, createdTime)',
        pageSize: 100,
      });

      const files = res.data.files || [];
      if (files.length === 0) {
        console.log(`  No stale files in folder ${folderId}.`);
        continue;
      }

      console.log(`  Found ${files.length} stale file(s) to delete.`);

      for (const file of files) {
        try {
          await drive.files.delete({ fileId: file.id });
          totalDeleted++;
          console.log(`  Deleted: ${file.name} (${file.id})`);
        } catch (err) {
          totalErrors++;
          console.error(`  Failed to delete ${file.id}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`Error processing org ${orgId} folder ${folderId}: ${err.message}`);
      totalErrors++;
    }
  }

  console.log(`Cleanup complete. Deleted: ${totalDeleted}, Errors: ${totalErrors}`);
});
