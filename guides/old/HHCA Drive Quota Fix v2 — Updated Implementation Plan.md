# **HHCA Drive Quota Fix v2 — Updated Implementation Plan**

**Date:** March 12, 2026 **Problem:** Document generation fails with `The user's Drive storage quota has been exceeded.` **Root cause discovered:** Google changed their policy in **April 2025** — service accounts **no longer have ANY Drive storage quota**. They cannot create, copy, or upload files to regular Google Drive (even shared folders). This is a permanent Google platform change, not a quota issue we can fix by deleting files.

Google's official guidance states two supported paths:

1. Use a **Shared Drive** (Google Workspace feature)  
2. Use **domain-wide delegation** (service account impersonates a real user)

**Previous plan (v1) did NOT work** because setting `parents: [folderId]` on a shared-folder-in-My-Drive still uses the service account as the caller, and Google blocks it at the quota check.

---

## **Option A: Domain-Wide Delegation (RECOMMENDED)**

**What it does:** The service account *impersonates* `notifications@harmonyhca.org` when calling the Google Docs/Drive API. Google treats the API call as if `notifications@` made it, using their storage quota (15GB for free Gmail, or whatever your Workspace plan provides).

**Why this is best for Harmony:**

* No Google Workspace "Business" plan required (Shared Drives need Business Standard+)  
* Works with `harmonyhca.org` if it's a Google Workspace domain (which it is, since you have `notifications@harmonyhca.org`)  
* Temp copies count against `notifications@`'s quota, which you can manage  
* Minimal code change — just add one `subject` parameter to the auth setup

### **Prerequisites (Kobe verifies)**

Before Claude Code can make the code change, confirm these:

1. **`harmonyhca.org` is a Google Workspace domain** (not just a Gmail alias)

   * If you can log into `admin.google.com` with your `harmonyhca.org` admin account, it is  
2. **`notifications@harmonyhca.org` exists as a real Google Workspace user**

   * Must be an actual user account, not a group or alias  
3. **Google Workspace admin access** — you'll need to approve the delegation scope

---

### **Phase 1 — Manual Steps (Kobe)**

#### **Step 1.1 — Enable domain-wide delegation on the service account**

1. Go to [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=parrish-harmonyhca)  
2. Click on `1062012852590-compute@developer.gserviceaccount.com` (the default compute SA that Cloud Functions uses with ADC)  
3. Click **"Show advanced settings"** or look for **"Domain-wide Delegation"**  
4. Check **"Enable G Suite Domain-wide Delegation"**  
5. Save. Note the **Client ID** shown (it's the numeric ID, e.g., `1062012852590`)

**Note:** If you don't see the delegation option on the default compute SA, you may need to use the dedicated `harmony-docs-generator@parrish-harmonyhca.iam.gserviceaccount.com` service account instead. In that case, enable delegation on that one and we'll use explicit credentials in the code.

#### **Step 1.2 — Authorize the scopes in Google Workspace Admin**

1. Go to [admin.google.com](https://admin.google.com) → **Security** → **API Controls** → **Domain-wide Delegation** → **Manage Domain Wide Delegation**  
2. Click **"Add new"**  
3. Enter:  
   * **Client ID:** The numeric client ID from Step 1.1 (e.g., `1062012852590`)  
   * **OAuth Scopes:**

```
https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/drive
```

4. Click **Authorize**

#### **Step 1.3 — Store the impersonation email in Firestore**

In [Firebase Console → Firestore](https://console.firebase.google.com/project/parrish-harmonyhca/firestore):

1. Navigate to: `organizations/org_parrish`  
2. In the `settings` map, add (or update):  
   * `driveImpersonateEmail` \= `notifications@harmonyhca.org` (string)  
   * `tempDriveFolderId` \= keep the folder ID you already set (still useful for organization)

#### **Step 1.4 — Create the temp folder (if not already done)**

1. Log into Google Drive as `notifications@harmonyhca.org`  
2. Create folder `_HarmonyTempDocs` (or confirm it exists)  
3. Copy the folder ID from the URL  
4. This folder ID should be in `settings.tempDriveFolderId` in Firestore

#### **Step 1.5 — Verify template access**

The templates need to be accessible to `notifications@harmonyhca.org` (since that's who the API will act as):

1. Open each Google Doc template  
2. Share with `notifications@harmonyhca.org` as **Editor**

**Gate: Complete all steps before proceeding to Phase 2\.**

---

### **Phase 2 — Code Changes (Claude Code)**

#### **Step 2.1 — Rewrite `functions/lib/googleDocsGenerator.js`**

Replace the entire file with this version that supports domain-wide delegation:

```javascript
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
```

**Key difference from v1:** The `getAuthClient()` function now accepts an `impersonateEmail` parameter and passes it as `clientOptions.subject` to `GoogleAuth`. This triggers domain-wide delegation.

---

#### **Step 2.2 — Update `functions/generateDocument.js`**

Find the section where `generateFromGoogleDoc` is called and update it to pass the impersonation email:

**Find this block (approximately):**

```javascript
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
```

**Replace with:**

```javascript
// Drive delegation settings
const tempFolderId = orgData?.settings?.tempDriveFolderId || null;
const impersonateEmail = orgData?.settings?.driveImpersonateEmail || null;

if (!impersonateEmail) {
  console.error('WARNING: No driveImpersonateEmail configured — Drive operations WILL fail (SA has zero quota since April 2025)');
}
if (!tempFolderId) {
  console.warn('No tempDriveFolderId configured — temp copies will land in impersonated user root Drive');
}

const pdfBuffer = await generateFromGoogleDoc(
  templateDocId,
  mergeData,
  `${documentType} - ${patient.name} - ${new Date().toISOString().split('T')[0]}`,
  tempFolderId,
  impersonateEmail
);
```

---

#### **Step 2.3 — Deploy**

```shell
cd functions
firebase deploy --only functions:generateDocument
```

Watch the deployment logs. Then test from the app.

---

### **Phase 3 — Verification**

1. **Generate a document** from the Harmony Documents page  
2. **Check Cloud Function logs** for:

```
Auth: Impersonating notifications@harmonyhca.org via domain-wide delegationCopying template: {id}Target folder: {folderId}Template copy created: {copyId}PDF exported: XXXXX bytesTemporary copy deleted: {copyId}
```

3. **Check `notifications@`'s Drive** — the `_HarmonyTempDocs` folder should be empty after generation  
4. **Download the PDF** — verify the signed URL works

---

## **Option B: Shared Drive (Alternative)**

If domain-wide delegation doesn't work (e.g., `harmonyhca.org` isn't a full Google Workspace domain), the other Google-approved path is to use a **Shared Drive**.

**Requirements:**

* Google Workspace **Business Standard** plan or higher (Shared Drives are not available on free/basic plans)  
* Create a Shared Drive in Google Workspace admin  
* Add the service account as a **Content Manager** on the Shared Drive  
* Use `supportsAllDrives: true` on all API calls

**Code change for Shared Drive approach:**

```javascript
// In the files.copy call, add supportsAllDrives
const copyResponse = await drive.files.copy({
  fileId: templateDocId,
  requestBody: copyRequestBody,
  supportsAllDrives: true,
});

// In the files.delete call
await drive.files.delete({ fileId: copyId, supportsAllDrives: true });

// In the files.export call — export doesn't need supportsAllDrives
```

The templates would also need to live in or be accessible from the Shared Drive.

**This is a bigger infrastructure change**, which is why Option A (delegation) is recommended first.

---

## **Option C: Skip Google Drive Entirely (Nuclear Option)**

If neither delegation nor Shared Drives are feasible, the third path is to **eliminate the Google Docs API dependency entirely** and generate PDFs in-memory using a template engine like `docxtemplater` or `carbone`:

1. Convert Google Doc templates to `.docx` format (File → Download as .docx)  
2. Store the `.docx` templates in Firebase Cloud Storage  
3. Use `docxtemplater` in the Cloud Function to do mail-merge in memory  
4. Use `libreoffice` or `pdf-lib` to convert to PDF  
5. No Google Drive involved at all

**Pros:** Zero Drive dependency, no quota issues ever, fully self-contained **Cons:** Significant rewrite, templates must be maintained as .docx instead of Google Docs, PDF conversion in Cloud Functions requires more memory/time

This is a longer-term option if A and B don't pan out.

---

## **Decision Tree**

```
Is harmonyhca.org a Google Workspace domain?
├── YES → Can you access admin.google.com?
│   ├── YES → Go with Option A (Domain-Wide Delegation) ← RECOMMENDED
│   └── NO → Who is the Workspace admin? Get them to do Step 1.1-1.2
├── NO (it's a regular Gmail/domain) → 
│   ├── Do you have Google Workspace Business Standard+?
│   │   ├── YES → Go with Option B (Shared Drive)
│   │   └── NO → Go with Option C (Skip Drive entirely)
```

---

## **Files Modified (Option A)**

| File | Change |
| ----- | ----- |
| `functions/lib/googleDocsGenerator.js` | Add `impersonateEmail` param, pass as `subject` to GoogleAuth |
| `functions/generateDocument.js` | Read `driveImpersonateEmail` from org settings, pass to generator |

## **Firestore Fields Added**

| Path | Field | Value |
| ----- | ----- | ----- |
| `organizations/org_parrish.settings` | `driveImpersonateEmail` | `notifications@harmonyhca.org` |
| `organizations/org_parrish.settings` | `tempDriveFolderId` | (folder ID from notifications@ Drive) |

---

## **Why the Previous Plan Failed**

The v1 plan assumed that placing a file in a folder owned by another user (`parents: [folderId]`) would make the file use that user's quota. This is **not how Google Drive works**. The file is always owned by the API caller (the service account), and Google checks the caller's quota. Since April 2025, service accounts have zero quota, so **any** file creation by a service account fails — regardless of where the file is placed.

The only ways to create files are:

1. Act *as* a real user (domain-wide delegation)  
2. Use a Shared Drive (organizational storage, no individual quota)  
3. Don't use Google Drive at all

