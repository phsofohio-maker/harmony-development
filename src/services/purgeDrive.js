// scripts/purgeDrive.js
const { google } = require('googleapis');
const path = require('path');

async function purgeDrive() {
  console.log('🧹 Purging SERVICE ACCOUNT Drive storage...\n');
  
  const auth = new google.auth.GoogleAuth({
    keyFile: './functions/service-account-key.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  const authClient = await auth.getClient();
  
  // Verify which account we're using
  const credentials = await auth.getCredentials();
  console.log(`📧 Authenticated as: ${credentials.client_email}`);
  console.log('   (This should be harmony-docs-generator@...)\n');
  
  const drive = google.drive({ version: 'v3', auth: authClient });
  
  // Check current storage usage
  const about = await drive.about.get({ fields: 'storageQuota, user' });
  const quota = about.data.storageQuota;
  console.log('📊 Current Storage Usage:');
  console.log(`   Used: ${formatBytes(quota.usage)} / ${formatBytes(quota.limit)}`);
  console.log(`   In Drive: ${formatBytes(quota.usageInDrive)}`);
  console.log(`   In Trash: ${formatBytes(quota.usageInDriveTrash)}\n`);

  let deletedCount = 0;
  let pageToken = null;

  try {
    // IMPORTANT: 'me' in owners - only files OWNED by service account
    // This excludes templates that are shared with the service account
    do {
      const res = await drive.files.list({
        q: "'me' in owners and trashed = false",
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime)',
        spaces: 'drive',
        pageSize: 100,
        pageToken: pageToken
      });

      const files = res.data.files;
      if (!files || files.length === 0) {
        if (deletedCount === 0) {
          console.log('✨ No files owned by service account found.');
        }
        break;
      }

      console.log(`Found ${files.length} files owned by service account...`);
      
      for (const file of files) {
        try {
          console.log(`  🗑️  Deleting: ${file.name} (${formatBytes(file.size || 0)})`);
          await drive.files.delete({ fileId: file.id });
          deletedCount++;
        } catch (err) {
          console.log(`  ⚠️  Could not delete ${file.name}: ${err.message}`);
        }
      }

      pageToken = res.data.nextPageToken;
    } while (pageToken);

    // Also empty trash
    console.log('\n🗑️  Emptying trash...');
    try {
      await drive.files.emptyTrash();
      console.log('   Trash emptied.');
    } catch (err) {
      console.log(`   Could not empty trash: ${err.message}`);
    }

    // Check storage after cleanup
    const afterAbout = await drive.about.get({ fields: 'storageQuota' });
    const afterQuota = afterAbout.data.storageQuota;
    
    console.log('\n✅ Cleanup complete!');
    console.log(`   Deleted: ${deletedCount} files`);
    console.log(`   Storage now: ${formatBytes(afterQuota.usage)} / ${formatBytes(afterQuota.limit)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 The service account key may be invalid or expired.');
      console.log('   Generate a new key from Firebase Console → Project Settings → Service Accounts');
    }
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === '0') return '0 Bytes';
  const b = parseInt(bytes);
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

purgeDrive();