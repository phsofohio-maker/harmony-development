# HHCA Drive Quota Fix — Implementation Plan

**Problem:** Document generation fails with `The user's Drive storage quota has been exceeded` every time. The service account (`harmony-docs-generator@parrish-harmonyhca.iam.gserviceaccount.com`) has no usable/manageable Drive storage. The `purgeDrive.js` script has never successfully resolved this.

**Solution:** Redirect all temporary Google Doc copies into a shared folder owned by `notifications@harmonyhca.org` — a real Gmail account Kobe can log into and manage. Also fix the auth approach to use Application Default Credentials (ADC) instead of requiring a `GOOGLE_SERVICE_ACCOUNT_KEY` env var.

**Final state:** PDFs are generated via Google Docs API using a temp folder the team can see and manage. Final PDFs still land in Firebase Cloud Storage with signed URLs (that part doesn't change).

---

## Architecture Change Summary

**Before (broken):**
```
Service account copies template → copy lands on SA's Drive (no quota) → FAILS
```

**After (fixed):**
```
Cloud Function (ADC) copies template → copy lands in notifications@ shared folder
→ merge fields → export PDF → delete copy → upload PDF to Firebase Storage
```

**Key decisions:**
- Auth: Application Default Credentials (no env var needed in deployed functions)
- Temp copies: Created in a shared Drive folder owned by `notifications@harmonyhca.org`
- The SA email that needs Editor access on the folder: `1062012852590-compute@developer.gserviceaccount.com` (this is the **default compute** SA that Cloud Functions v2 run as — NOT the `harmony-docs-generator@` SA)
- Folder ID stored in Firestore at `organizations/{orgId}.settings.tempDriveFolderId`
- Cleanup: Hardened retry + daily scheduled sweep of orphaned files

---

## Phase 1 — Manual Steps (Kobe does these)

### Step 1.1 — Create the shared temp folder

1. Log into Google Drive as `notifications@harmonyhca.org`
2. Create a new folder named `_HarmonyTempDocs`
3. Right-click → Share → Add: `1062012852590-compute@developer.gserviceaccount.com` as **Editor**
4. Also add: `harmony-docs-generator@parrish-harmonyhca.iam.gserviceaccount.com` as **Editor** (belt and suspenders — covers both possible SA identities)
5. Copy the folder ID from the URL bar: `https://drive.google.com/drive/folders/XXXXXXXXXXXXXX` ← that's the ID
6. Save this ID — you'll need it in Step 1.3

### Step 1.2 — Verify APIs are enabled

Go to [Google Cloud Console → APIs & Services → Library](https://console.cloud.google.com/apis/library?project=parrish-harmonyhca):

1. Search "Google Docs API" → Ensure **Enabled**
2. Search "Google Drive API" → Ensure **Enabled**

If either says "Enable", click it.

### Step 1.3 — Store the folder ID in Firestore

In [Firebase Console → Firestore](https://console.firebase.google.com/project/parrish-harmonyhca/firestore):

1. Navigate to: `organizations/org_parrish`
2. Edit the document, find or create the `settings` map field
3. Inside `settings`, add a new field:
   - Field name: `tempDriveFolderId`
   - Type: string
   - Value: the folder ID from Step 1.1

The path should be: `organizations/org_parrish.settings.tempDriveFolderId`

### Step 1.4 — Verify template sharing

Each of the 5 Google Doc templates configured in `settings.documentTemplates` must also be shared with the service account(s). For each template:

1. Open the Google Doc
2. Click Share
3. Confirm that `1062012852590-compute@developer.gserviceaccount.com` has at least **Viewer** access (Editor not needed for templates — only the *copies* need Editor, and those go in the shared folder)

### Step 1.5 — Clean up notifications@ Drive (optional but recommended)

While logged into `notifications@harmonyhca.org`'s Drive:
1. Check if there are any old generated doc copies cluttering the root
2. If so, select all and delete, then empty trash
3. This ensures a clean starting state

**Gate: Do not proceed to Phase 2 until all 5 steps above are done.**

---

## Phase 2 — Code Changes (Claude Code executes these)

### Step 2.1 — Rewrite `functions/lib/googleDocsGenerator.js`

Replace the entire file. Key changes:
- Switch from `GOOGLE_SERVICE_ACCOUNT_KEY` env var → **Application Default Credentials**
- Add `tempFolderId` parameter to `generateFromGoogleDoc()`
- Add `parents: [tempFolderId]` to the `drive.files.copy()` call
- Add retry logic (2 attempts) to the cleanup delete
- Add a verification log showing which account is being used

```javascript
/**
 * functions/lib/googleDocsGenerator.js
 * Google Docs/Drive API document generator
 *
 * Workflow:
 *   1. Copy a Google Doc template into a shared temp folder
 *   2. Batch replaceAllText with merge data
 *   3. Export copy as PDF buffer
 *   4. Delete the temp copy (with retry)
 *   5. Return PDF buffer
 *
 * Auth: Uses Application Default Credentials (ADC).
 * In deployed Cloud Functions, this is the default compute service account.
 * No env vars or key files needed.
 */

const { google } = require('googleapis');

/**
 * Get an authenticated Google API client using Application Default Credentials.
 * In deployed Cloud Functions, this automatically uses the compute service account.
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
 * @param {string} templateDocId - The Google Doc ID of the template to copy
 * @param {Object} mergeData     - Flat key-value object. Keys become {{KEY}} placeholders.
 * @param {string} [title]       - Optional title for the temporary copy
 * @param {string} [tempFolderId] - Google Drive folder ID for temp copies (owned by notifications@)
 * @returns {Promise<Buffer>}    - PDF buffer
 */
async function generateFromGoogleDoc(templateDocId, mergeData, title, tempFolderId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  let copyId;

  try {
    // 1. Copy the template into the shared temp folder
    console.log(`Copying template: ${templateDocId}`);
    const copyRequestBody = {
      name: title || `Generated_${Date.now()}`,
    };

    // If tempFolderId is provided, place the copy there
    // This avoids using the service account's own Drive quota
    if (tempFolderId) {
      copyRequestBody.parents = [tempFolderId];
      console.log(`  → Target folder: ${tempFolderId}`);
    }

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
            console.error(`LEAKED TEMP FILE: ${copyId} — will be caught by scheduled cleanup`);
          }
        }
      }
    }
  }
}

module.exports = { generateFromGoogleDoc };
```

**Acceptance criteria:**
- ✅ No reference to `GOOGLE_SERVICE_ACCOUNT_KEY` or `process.env` for credentials
- ✅ `getAuthClient()` uses `new google.auth.GoogleAuth()` with no `credentials` or `keyFile` param
- ✅ `generateFromGoogleDoc` accepts a 4th parameter `tempFolderId`
- ✅ `parents: [tempFolderId]` is set on the copy request when provided
- ✅ Delete has retry logic (2 attempts with 1.5s delay)
- ✅ Leaked file ID is logged for cleanup

---

### Step 2.2 — Update `functions/generateDocument.js` to pass `tempFolderId`

Find the section where `generateFromGoogleDoc` is called (around the "Generate PDF via Google Docs API" comment). Update it to read `tempFolderId` from org settings and pass it through.

**Find this block:**
```javascript
const pdfBuffer = await generateFromGoogleDoc(
  templateDocId,
  mergeData,
  `${documentType} - ${patient.name} - ${new Date().toISOString().split('T')[0]}`
);
```

**Replace with:**
```javascript
// Get temp Drive folder ID (shared folder owned by notifications@harmonyhca.org)
const tempFolderId = orgData?.settings?.tempDriveFolderId || null;
if (!tempFolderId) {
  console.warn('No tempDriveFolderId configured — copy will use service account Drive (may hit quota limits)');
}

const pdfBuffer = await generateFromGoogleDoc(
  templateDocId,
  mergeData,
  `${documentType} - ${patient.name} - ${new Date().toISOString().split('T')[0]}`,
  tempFolderId
);
```

**Acceptance criteria:**
- ✅ `tempFolderId` is read from `orgData.settings.tempDriveFolderId`
- ✅ Passed as 4th argument to `generateFromGoogleDoc`
- ✅ Warning logged (not error) if missing — allows graceful fallback

---

### Step 2.3 — Remove `GOOGLE_SERVICE_ACCOUNT_KEY` dependency

Check if `GOOGLE_SERVICE_ACCOUNT_KEY` is referenced anywhere else in the `functions/` directory. If it appears in:
- `generateDocument.js` function config (e.g., `secrets: [...]`) → remove it
- `.env` files → remove the entry
- `firebase.json` → remove if listed in env/secrets config

The deployed Cloud Function uses ADC automatically. No env var needed.

**Do NOT delete the `service-account-key.json` or `SERVICE_ACCOUNT_JSON` files** — those are still used by local-only scripts like `testDocGeneration.js`. Just ensure `googleDocsGenerator.js` doesn't reference them.

**Acceptance criteria:**
- ✅ `functions/lib/googleDocsGenerator.js` has zero references to env vars or key files
- ✅ No `secrets` config for `GOOGLE_SERVICE_ACCOUNT_KEY` in the `generateDocument` function definition
- ✅ Local test scripts remain untouched

---

### Step 2.4 — Add Settings UI for Temp Folder ID (optional but recommended)

In `src/components/SettingsPage.jsx`, in the Documents tab section, add a field for the temp Drive folder ID below the template list. This lets admins update it without touching Firestore directly.

Add to the Documents tab, after the template list `<div>` and before the save button:

```jsx
{/* Temp Drive Folder */}
<div className="form-section" style={{ marginTop: '2rem' }}>
  <h4>Document Generation Settings</h4>
  <p className="section-description">
    The system creates temporary copies of templates during PDF generation.
    These copies are stored in a shared Google Drive folder.
  </p>
  <div className="template-row">
    <div className="template-info">
      <span className="template-name">Temp Drive Folder ID</span>
      <span className="template-desc">
        Google Drive folder shared with the service account for temporary document copies
      </span>
    </div>
    <div className="template-input-row">
      <input
        type="text"
        value={tempFolderId}
        onChange={(e) => setTempFolderId(e.target.value.trim())}
        placeholder="e.g. 1AbCdEfGhIjKlMnOpQrStUvWxYz"
        className="template-input"
      />
    </div>
  </div>
</div>
```

Add the state variable:
```javascript
const [tempFolderId, setTempFolderId] = useState('');
```

Load it in `loadSettings`:
```javascript
setTempFolderId(data.settings?.tempDriveFolderId || '');
```

Save it in `saveDocTemplates` (add to the `updateDoc` call):
```javascript
'settings.tempDriveFolderId': tempFolderId || '',
```

**Acceptance criteria:**
- ✅ New input field visible in Settings → Documents tab
- ✅ Loads existing value from Firestore
- ✅ Saves alongside template IDs

---

### Step 2.5 — Deploy

```bash
# Deploy only the Cloud Functions (includes the fixed generator)
firebase deploy --only functions

# If Settings UI was updated, also deploy hosting
npm run build
firebase deploy --only hosting
```

**Acceptance criteria:**
- ✅ `firebase deploy --only functions` succeeds with no errors
- ✅ Function logs show "Target folder: {folderId}" on first generation attempt

---

## Phase 3 — Verification

### Step 3.1 — Test document generation

1. In the Harmony app, go to Documents
2. Select a patient with data populated
3. Generate one document (e.g., CTI or PROGRESS_NOTE)
4. Confirm:
   - No "quota exceeded" error
   - PDF downloads successfully
   - Signed URL works

### Step 3.2 — Check the temp folder

1. Log into Drive as `notifications@harmonyhca.org`
2. Open `_HarmonyTempDocs` folder
3. It should be **empty** (the temp copy gets deleted after PDF export)
4. If you see files here, the cleanup delete is failing — check Cloud Function logs

### Step 3.3 — Check Cloud Function logs

In [Firebase Console → Functions → Logs](https://console.firebase.google.com/project/parrish-harmonyhca/functions/logs):

Look for these log lines on a successful generation:
```
Copying template: {templateDocId}
  → Target folder: {tempFolderId}
Template copy created: {copyId}
Replacing N merge fields...
Exporting as PDF...
PDF exported: XXXXX bytes
Temporary copy deleted: {copyId}
```

If you see `LEAKED TEMP FILE` warnings, the delete is failing — check folder permissions.

---

## Phase 4 — Safety Net: Scheduled Cleanup (Optional)

Create `functions/cleanupTempDocs.js` — a scheduled function that runs daily and deletes any files in the temp folder older than 2 hours. This catches any leaked copies.

```javascript
/**
 * functions/cleanupTempDocs.js
 * Scheduled cleanup of leaked temporary document copies
 * Runs daily at 2 AM ET
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { google } = require('googleapis');

exports.cleanupTempDocs = onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'America/New_York',
  region: 'us-central1',
}, async () => {
  console.log('=== cleanupTempDocs running ===');

  const db = getFirestore();

  // Get all orgs with a tempDriveFolderId configured
  const orgsSnapshot = await db.collection('organizations').get();

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  let totalDeleted = 0;

  for (const orgDoc of orgsSnapshot.docs) {
    const folderId = orgDoc.data()?.settings?.tempDriveFolderId;
    if (!folderId) continue;

    try {
      // Find files in the folder older than 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and createdTime < '${twoHoursAgo}'`,
        fields: 'files(id, name, createdTime)',
        pageSize: 100,
      });

      const files = res.data.files || [];
      if (files.length === 0) continue;

      console.log(`Org ${orgDoc.id}: Found ${files.length} orphaned temp files`);

      for (const file of files) {
        try {
          await drive.files.delete({ fileId: file.id });
          totalDeleted++;
          console.log(`  Deleted: ${file.name} (created ${file.createdTime})`);
        } catch (err) {
          console.warn(`  Failed to delete ${file.name}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`Error cleaning org ${orgDoc.id}:`, err.message);
    }
  }

  console.log(`Cleanup complete. Deleted ${totalDeleted} orphaned files.`);
});
```

**Register in `functions/index.js`:**
```javascript
const { cleanupTempDocs } = require('./cleanupTempDocs');
// ... in exports:
cleanupTempDocs,
```

**Acceptance criteria:**
- ✅ Runs daily at 2 AM ET
- ✅ Only deletes files older than 2 hours (won't interfere with active generation)
- ✅ Scoped to configured temp folders per org

---

## Files Modified Summary

| File | Change |
|------|--------|
| `functions/lib/googleDocsGenerator.js` | **Full rewrite** — ADC auth, tempFolderId param, retry delete |
| `functions/generateDocument.js` | **Minor edit** — read tempFolderId from org settings, pass to generator |
| `src/components/SettingsPage.jsx` | **Minor edit** — add tempFolderId input field (optional) |
| `functions/cleanupTempDocs.js` | **New file** — scheduled orphan cleanup (optional) |
| `functions/index.js` | **Minor edit** — register cleanupTempDocs export (if Phase 4) |

## Files NOT Modified

| File | Reason |
|------|--------|
| `functions/lib/mergeData.js` | No changes needed — merge data logic is unaffected |
| `src/services/documentService.js` | No changes — client-side call interface is the same |
| `storage.rules` | No changes — PDFs still go to Firebase Cloud Storage |
| `service-account-key.json` | Keep for local scripts — just not used by deployed functions |
| `src/services/purgeDrive.js` | Can be deleted later — no longer needed once this fix is in place |

---

## Rollback Plan

If the shared folder approach fails for any reason:
1. Revert `googleDocsGenerator.js` to the previous version
2. Remove `tempDriveFolderId` from Firestore
3. Redeploy: `firebase deploy --only functions`

The service account approach will resume (with quota issues). This buys time to investigate alternatives.

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Use ADC instead of `GOOGLE_SERVICE_ACCOUNT_KEY` env var | Deployed Cloud Functions already have ADC. Eliminates env var management. The 1.2.1 plan already specified this. |
| 2 | Use `1062012852590-compute@developer.gserviceaccount.com` as the primary SA | This is the default compute SA that Cloud Functions v2 actually run as with ADC. The `harmony-docs-generator@` SA was only used via explicit credentials. |
| 3 | Store temp copies in `notifications@harmonyhca.org` Drive folder | Real account with visible, manageable storage. Team can log in and clean up if needed. |
| 4 | Store `tempFolderId` in org settings (not hardcoded) | Multi-tenant friendly. Each org can have their own temp folder. |
| 5 | Keep `harmony-docs-generator@` as secondary Editor on folder | Safety net in case any code path still uses those credentials. |
