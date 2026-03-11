# HHCA Pre-Production Plan — Claude Code Execution Guide

**Date:** March 9, 2026
**Version:** 1.2.1 → Production
**Purpose:** Step-by-step instructions for Claude Code to execute all code-level pre-production tasks. Kobe handles manual/infrastructure tasks separately.

---

## How This Plan Works

This plan splits the pre-production checklist into two tracks:

- **Track A (Claude Code):** Code changes, file edits, lint/build, template migration code, Cloud Function rewrites, frontend fixes — all executable by Claude Code with Kobe's approval at each gate.
- **Track B (Kobe Manual):** Firebase Console actions, Google Cloud Console, secrets configuration, sharing permissions, deployment commands, manual testing in browser.

Claude Code follows Track A step-by-step. After each phase, Kobe executes the corresponding Track B items before the next phase begins.

**Workflow:** Claude reads step → proposes changes → Kobe approves → Claude executes → next step.
**Approval Gates:** Each step marked with `⬜` needs Kobe's approval. Mark `✅` when done.

---

## Pre-Production Checklist Breakdown

| # | Checklist Item | Track | Phase |
|---|---|---|---|
| 1 | Fix document generation `[No content provided]` bug | A (Claude) | 1 |
| 2 | Execute template migration (7→5 templates, update ~10 files) | A (Claude) | 1 |
| 3 | Resolve merge variable naming inconsistencies | A (Claude) | 1 |
| 4 | PatientModal overflow CSS fix | A (Claude) | 1 |
| 5 | DocumentsPage emoji → Lucide icons | A (Claude) | 1 |
| 6 | Delete legacy template keys from codebase | A (Claude) | 1 |
| 7 | Lint + build verification | A (Claude) | 1 |
| 8 | Settings → Documents tab (admin template config UI) | A (Claude) | 2 |
| 9 | Home Visits page expansion (toolkit/dashboard) | A (Claude) | 2 |
| 10 | Add `knownHazards` field to patient schema + UI | A (Claude) | 2 |
| 11 | Switch `generateDocument` from PDFKit → Google Docs API | A (Claude) | 3 |
| 12 | Redesign DocumentsPage for assessment-based generation | A (Claude) | 3 |
| 13 | Wire `assessmentId` through to Cloud Function | A (Claude) | 3 |
| 14 | Remove PDFKit dependency and old code | A (Claude) | 4 |
| 15 | Uncomment `sendInvite` secrets array | A (Claude) | 4 |
| 16 | Final lint + build + functions syntax check | A (Claude) | 4 |
| 17 | Enable Google Docs API in Cloud Console | **B (Kobe)** | After Phase 1 |
| 18 | Verify Google Drive API is enabled | **B (Kobe)** | After Phase 1 |
| 19 | Share all 5 Google Doc templates with service account (Editor) | **B (Kobe)** | After Phase 1 |
| 20 | Configure EMAIL_USER and EMAIL_PASS secrets | **B (Kobe)** | After Phase 4 |
| 21 | Add email recipients to org settings | **B (Kobe)** | After Phase 4 |
| 22 | Run `configureTemplates.js` to push template IDs to Firestore | **B (Kobe)** | After Phase 4 |
| 23 | Deploy Cloud Functions: `firebase deploy --only functions` | **B (Kobe)** | After Phase 4 |
| 24 | Build + deploy frontend: `npm run build && firebase deploy --only hosting` | **B (Kobe)** | After Phase 4 |
| 25 | Run `verifyDatabase.js` | **B (Kobe)** | After Phase 4 |
| 26 | End-to-end smoke test (create patient → assessment → generate docs → verify PDF) | **B (Kobe)** | After Phase 4 |
| 27 | Confirm IAM roles on service account | **B (Kobe)** | After Phase 4 |
| 28 | Create Firestore test data cleanup script | A (Claude) | 5 |
| 29 | Create Firebase Auth test user cleanup script | A (Claude) | 5 |
| 30 | Clean up / organize dev-only test scripts | A (Claude) | 5 |
| 31 | Back up Firestore, review + run cleanup scripts | **B (Kobe)** | After Phase 5 |
| 32 | Verify Auth + Firestore are clean, final verifyDatabase.js | **B (Kobe)** | After Phase 5 |

---

## TRACK A: Claude Code Execution

---

### Phase 1: Bug Fixes, Template Migration & Baseline

**Goal:** Fix all known bugs, migrate from 7 to 5 templates in code, resolve variable naming, clean up emoji, remove legacy keys, and verify it all compiles.
**Dependencies:** None — this is the starting point.

---

#### Step 1.1 — Template Migration: Update `organizationService.js`

⬜ **Status:** Not started

**What to do:** Update `ORG_DEFAULTS.settings.documentTemplates` to use the 5 canonical template keys with their Google Doc IDs.

**New template object:**
```javascript
documentTemplates: {
  CTI: '1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58',
  ATTEND_CTI: '1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI',
  PROGRESS_NOTE: '1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA',
  PHYSICIAN_HP: '1p7Qoik9VQq0AdHiEtiKOLLsyGV5Xldp9qqe-qOyRJB8',
  HOME_VISIT_ASSESSMENT: '15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s',
}
```

**Remove these deprecated keys if present:** `60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`, `ATTEND_CERT`, `PATIENT_HISTORY`, `F2F_ENCOUNTER`

**Acceptance criteria:**
- ✅ `ORG_DEFAULTS.settings.documentTemplates` has exactly 5 keys
- ✅ No deprecated keys remain in the file
- ✅ Google Doc IDs match the values above

---

#### Step 1.2 — Template Migration: Update `certificationCalculations.js`

⬜ **Status:** Not started

**What to do:** Update `determineCertPeriodByBenefit()` to return the new `documentTypes` arrays.

**New mappings:**
| Period | `documentTypes` |
|---|---|
| Period 1 (Initial 90-day) | `['CTI', 'ATTEND_CTI', 'PHYSICIAN_HP']` |
| Period 2 (2nd 90-day) | `['CTI', 'PROGRESS_NOTE']` |
| Period 3+ (60-day) | `['CTI', 'PROGRESS_NOTE']` |

**Important:** `HOME_VISIT_ASSESSMENT` is per-visit, NOT per-period — it should NOT appear in these arrays.

**Acceptance criteria:**
- ✅ Period 1 returns `['CTI', 'ATTEND_CTI', 'PHYSICIAN_HP']`
- ✅ Period 2 returns `['CTI', 'PROGRESS_NOTE']`
- ✅ Period 3+ returns `['CTI', 'PROGRESS_NOTE']`
- ✅ No references to `60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`, `ATTEND_CERT`, `PATIENT_HISTORY`, `F2F_ENCOUNTER`

---

#### Step 1.3 — Template Migration: Update `functions/utils.js`

⬜ **Status:** Not started

**What to do:** This file contains the backend mirror of `determineCertPeriodByBenefit()`. Apply the same changes as Step 1.2. Also check for any hardcoded template names in email templates and update them.

**Additionally:** Search for old template display names in email content (e.g., "60-Day Certification", "90-Day Initial") and update to the new names ("CTI Narrative", "Attending Physician CTI", "Physician H&P", "Progress Note").

**Acceptance criteria:**
- ✅ Backend `documentTypes` arrays match Step 1.2
- ✅ Email template text uses new document names
- ✅ No deprecated key references

---

#### Step 1.4 — Template Migration: Update Config Scripts

⬜ **Status:** Not started

**What to do:** Update these files to use the 5-template system:

1. **`functions/scripts/configureTemplates.js`** — Replace the `documentTemplates` object with the 5 new keys/IDs from Step 1.1
2. **`functions/scripts/setupOrg.js`** — Same replacement in `settings.documentTemplates`
3. **`functions/scripts/initDocumentTemplates.js`** — Replace the 7-template `TEMPLATES` object with 5 new templates (update names, descriptions, and keys)

**Acceptance criteria:**
- ✅ All three scripts reference exactly 5 template keys
- ✅ Google Doc IDs match Step 1.1
- ✅ No deprecated keys in any script

---

#### Step 1.5 — Template Migration: Update `verifyDatabase.js`

⬜ **Status:** Not started

**What to do:** Update the template key validation in `src/services/verifyDatabase.js` to check for the 5 canonical keys instead of the old 7.

**Acceptance criteria:**
- ✅ Validation expects: `CTI`, `ATTEND_CTI`, `PROGRESS_NOTE`, `PHYSICIAN_HP`, `HOME_VISIT_ASSESSMENT`
- ✅ Validation warns on deprecated keys if found

---

#### Step 1.6 — Template Migration: Update `DocumentsPage.jsx` Template Library

⬜ **Status:** Not started

**What to do:** Update the template library/list in `DocumentsPage.jsx` to display 5 templates instead of 7. Update template names, descriptions, and keys. (The full DocumentsPage redesign happens in Phase 3 — this step just fixes the template references.)

**Also:** Replace all emoji characters with Lucide React icons per the 1.2.1 plan (Step 1.3 mapping):

| Emoji | Lucide Component |
|---|---|
| 🕐 | `<Clock size={16} />` |
| 📄 | `<FileText size={16} />` |
| 📚 | `<Library size={18} />` |
| ⏳ | `<Loader2 size={16} className="spin" />` |
| ✅ | `<CheckCircle size={16} style={{color: '#10b981'}} />` |
| ❌ | `<XCircle size={16} style={{color: '#ef4444'}} />` |
| ⚠️ | `<AlertCircle size={16} style={{color: '#f59e0b'}} />` |
| 📥 | `<Download size={16} />` |
| 🔄 | `<RefreshCw size={16} />` |
| ℹ️ | `<Info size={16} />` |

**Acceptance criteria:**
- ✅ Template library shows exactly 5 templates
- ✅ Zero emoji characters remain in the file
- ✅ All icons are Lucide React components

---

#### Step 1.7 — Fix `[No content provided]` Bug in `generateDocument.js`

⬜ **Status:** Not started

**What to do:** The Cloud Function currently doesn't load assessment data from the `visits` subcollection. Fix the data pipeline:

1. Accept optional `assessmentId` parameter in the function input
2. If `assessmentId` is provided, load the assessment doc from `organizations/{orgId}/patients/{patientId}/visits/{assessmentId}`
3. Pass assessment data to `prepareMergeData` for Tier 2+3 variable resolution
4. When `assessmentId` is null, Tier 2+3 fields resolve to `''` (backward compatible)

**Note:** This is a temporary fix to get the data flowing. Phase 3 replaces the PDFKit renderer with Google Docs API, but the data pipeline fix carries forward.

**Acceptance criteria:**
- ✅ Function accepts `assessmentId` parameter
- ✅ Assessment data loads from visits subcollection when provided
- ✅ Tier 2+3 fields populate in generated output
- ✅ Without assessmentId, function still works (blank clinical sections)

---

#### Step 1.8 — Build `prepareMergeData` with All Variable Variants

⬜ **Status:** Not started

**What to do:** Update `prepareMergeData` in `functions/lib/pdfGenerator.js` (or wherever it lives) to resolve ALL merge variables from the template audit (Testing Plan A.3), including both naming variants for inconsistent fields.

**Populate both variants for these inconsistencies:**
- `DIAGNOSIS_1` through `DIAGNOSIS_6` AND `DIAGNOSIS1` through `DIAGNOSIS6` (same data)
- `CD_1`/`CD_2` AND `CDATE1`/`CDATE2` (same data)
- `PATIENT_PN` AND `PATIENT_PHONE` (same data)
- `PROVIDER` AND `PROVIDER_NAME` (same data)
- `F2F_PHYSICIAN` AND `F2F_PROVIDER_NAME` (same data)
- `BENEFIT_PERIOD` AND `BENEFIT_PERIOD_NUM` (same data)

**Add these fields that the templates use but may be missing:**
- `PHYS_ATT_NAME`, `PHYS_ATT_NPI`, `PHYS_ATT_PHONE` (from patient attending physician)
- `CALC_AGE` (computed: today minus DOB)
- `CALC_ICD` (from primary diagnosis ICD-10 code)
- `CBX_BP`, `CBX_CT`, `CBX_F2F`, `CBX_R`, `CBX_VT`, `CBX_ROLE`, `CBX_VP` (short checkbox keys from templates)
- `ADMISSION` (alias for `ADMISSION_DATE`)
- `NPI` (org-level hospice NPI for Attending CTI, OR provider NPI for Progress Note — context-dependent)
- `D1_DATE` through `D6_DATE` (diagnosis onset dates)
- `BENEFIT_PERIOD_1`, `BENEFIT_PERIOD_2` (period date range)
- `SUGGESTION` (set to `''` for now — future AI feature)

**Checkbox fields** should use Unicode: ☑ (U+2611) for selected, ☐ (U+2610) for unselected.

**Input:** `{ patient, assessment (nullable), organization }`
**Output:** Object with all variable keys resolving to strings (never `undefined` or `null`).

**Acceptance criteria:**
- ✅ All variables from Testing Plan A.3 are resolved
- ✅ Both naming variants populated for inconsistent fields
- ✅ Checkbox fields render as ☑/☐
- ✅ Date fields formatted as MM/DD/YYYY
- ✅ Missing data → `''` (empty string), never `undefined`/`null`
- ✅ Works with and without assessment data

---

#### Step 1.9 — Fix PatientModal Overflow

⬜ **Status:** Not started

**What to do:** Edit `src/components/PatientModal.jsx` CSS:

```css
.modal-container.wide {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;           /* ADD */
}
.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;              /* ADD */
}
.modal-header, .modal-tabs, .compliance-summary, .modal-footer {
  flex-shrink: 0;              /* ADD */
}
```

**Acceptance criteria:**
- ✅ Modal body scrolls independently
- ✅ Footer pinned to bottom
- ✅ Tab bar stays accessible
- ✅ No content clipped at viewport ≥ 500px

---

#### Step 1.10 — Codebase-Wide Legacy Key Sweep

⬜ **Status:** Not started

**What to do:** Run a grep across the entire repo for deprecated template keys and remove/update every reference:

```bash
grep -rn '60DAY\|90DAY_INITIAL\|90DAY_SECOND\|ATTEND_CERT\|PATIENT_HISTORY\|F2F_ENCOUNTER' --include='*.js' --include='*.jsx' --include='*.json'
```

Also search for the old short keys that got replaced:
```bash
grep -rn "'CTI'" --include='*.js' --include='*.jsx' | grep -v 'ATTEND_CTI'
```
(Be careful: `CTI` is now a valid canonical key. Only remove old-context references like `templateKey === 'CTI'` that mapped to the wrong thing.)

**Acceptance criteria:**
- ✅ Zero references to `60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`, `ATTEND_CERT`, `PATIENT_HISTORY`, `F2F_ENCOUNTER` anywhere in the codebase
- ✅ All `documentTypes` arrays use the 5 canonical keys

---

#### Step 1.11 — Lint & Build Verification

⬜ **Status:** Not started

**What to do:**
1. `npm run lint` — fix any errors
2. `npm run build` — confirm production build succeeds
3. `cd functions && node -c generateDocument.js && node -c lib/pdfGenerator.js && node -c index.js` — confirm functions parse

**Acceptance criteria:**
- ✅ Lint passes with zero errors
- ✅ Build succeeds
- ✅ Functions syntax check passes

---

### ✋ Phase 1 Gate — Kobe Approval Required

Before proceeding to Phase 2:
- [ ] Kobe reviews all Phase 1 changes
- [ ] Kobe runs `npm run dev` and does visual smoke test
- [ ] Kobe verifies PatientModal scrolls correctly
- [ ] Kobe verifies DocumentsPage has no emoji

**Kobe Manual Tasks (do now or after Phase 2):**
- [ ] Enable Google Docs API in Cloud Console
- [ ] Verify Google Drive API is enabled
- [ ] Share all 5 Google Doc templates with `harmony-docs-generator@parrish-harmonyhca.iam.gserviceaccount.com` (Editor access)

---

### Phase 2: Feature Additions

**Goal:** Add the Settings Documents tab, expand Home Visits to a full toolkit, add `knownHazards`.
**Dependencies:** Phase 1 complete.

---

#### Step 2.1 — Settings Page: Add "Documents" Tab

⬜ **Status:** Not started

**What to do:** Add a new "Documents" tab to `SettingsPage.jsx`:

1. Add tab to the tab list (between "Notifications" and "Data", or at end)
2. Use `FileText` Lucide icon for the tab
3. Tab content: form with 5 input fields, one for each template
4. Each field: label (template name), text input for Google Docs URL, help text showing expected format
5. On save: extract the Google Doc ID from the URL and write to `organizations/{orgId}/settings/documentTemplates`
6. URL format: `https://docs.google.com/document/d/{DOC_ID}/edit` — parse out `{DOC_ID}`
7. **Admin-only:** Only show this tab if `userProfile.role === 'owner' || userProfile.role === 'admin'`
8. Pre-populate fields from existing Firestore data on load

**Template fields:**
| Label | Key | Current Default ID |
|---|---|---|
| CTI Narrative | `CTI` | `1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58` |
| Attending Physician CTI | `ATTEND_CTI` | `1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI` |
| Progress Note | `PROGRESS_NOTE` | `1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA` |
| Physician H&P | `PHYSICIAN_HP` | `1p7Qoik9VQq0AdHiEtiKOLLsyGV5Xldp9qqe-qOyRJB8` |
| Home Visit Assessment | `HOME_VISIT_ASSESSMENT` | `15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s` |

**Acceptance criteria:**
- ✅ Documents tab visible to admin/owner, hidden from staff/viewer
- ✅ 5 template URL fields with labels
- ✅ Google Doc ID correctly extracted from URL on save
- ✅ Saved values persist to Firestore and load on page reload
- ✅ Validation: rejects non-Google-Docs URLs

---

#### Step 2.2 — Home Visits Page Expansion

⬜ **Status:** Not started

**What to do:** Create `src/components/HomeVisitsPage.jsx` as the full assessment toolkit:

**Layout sections:**
1. **Patient selector** — dropdown or search to pick a patient
2. **Quick-Access Patient Profile** (once patient selected):
   - Name, age, gender, primary language
   - `knownHazards` field (bold/highlighted — e.g., "aggressive dog", "stairs only", "oxygen in use")
   - Contact info with Google Maps button (opens patient address in Google Maps)
3. **Previous Assessments** — list of past visits from `visits` subcollection, showing date, visit type, status, provider
4. **"Start New Assessment" button** — opens `HomeVisitAssessment.jsx` as a modal/slide panel
5. After assessment save/complete, modal closes, assessment list refreshes

**Also:**
- Update `src/App.jsx`: route `'visits'` → `<HomeVisitsPage />`
- Update `src/components/Sidebar.jsx`: rename "Visits" → "Home Visits"
- `HomeVisitAssessment.jsx` loses its standalone route — it only renders within `HomeVisitsPage` as a modal

**Acceptance criteria:**
- ✅ Patient selector works
- ✅ Patient profile shows with hazards and Maps link
- ✅ Previous assessments list loads from Firestore
- ✅ "Start New Assessment" opens modal with assessment form
- ✅ After save, modal closes and list refreshes
- ✅ Sidebar says "Home Visits"

---

#### Step 2.3 — Add `knownHazards` to Patient Schema

⬜ **Status:** Not started

**What to do:**
1. **`src/services/patientService.js`** — Add `knownHazards: ''` to schema defaults and `docToPatient` converter
2. **`src/components/PatientModal.jsx`** — Add "Known Hazards" text input to the appropriate tab (Demographics or Clinical), with placeholder: "e.g., aggressive dog, stairs only, oxygen in use"
3. **HomeVisitsPage** — Display hazards prominently in the patient profile section (yellow/amber highlight if non-empty)

**Acceptance criteria:**
- ✅ `knownHazards` field saves to Firestore
- ✅ Field appears in PatientModal
- ✅ Field displays in HomeVisitsPage patient profile
- ✅ Empty hazards = no highlight; non-empty = amber warning styling

---

#### Step 2.4 — Phase 2 Lint & Build Check

⬜ **Status:** Not started

Same as Step 1.11 — lint, build, functions syntax.

---

### ✋ Phase 2 Gate — Kobe Approval Required

Before proceeding to Phase 3:
- [ ] Kobe reviews Phase 2 changes
- [ ] Kobe tests Settings → Documents tab (save/load template URLs)
- [ ] Kobe tests Home Visits page (patient select → profile → start assessment → save)
- [ ] Kobe confirms Google Docs API is enabled and templates are shared (Track B from Phase 1 gate)

---

### Phase 3: Document Generation Pipeline Overhaul

**Goal:** Replace PDFKit with Google Docs API, redesign DocumentsPage for assessment-based generation.
**Dependencies:** Phase 2 complete. Google Docs API enabled and templates shared (Kobe Track B).

---

#### Step 3.1 — Create `googleDocsGenerator.js`

⬜ **Status:** Not started

**What to do:** Create `functions/lib/googleDocsGenerator.js`:

**Core function: `generateFromTemplate(templateId, mergeData, outputFileName)`**

1. Authenticate using Application Default Credentials (no key file needed in deployed functions)
2. Copy the template: `drive.files.copy({ fileId: templateId })`
3. Merge fields: `docs.documents.batchUpdate()` with `replaceAllText` requests for each `{{VARIABLE}}` → resolved value
4. Export as PDF: `drive.files.export({ fileId: copyId, mimeType: 'application/pdf' })`
5. Return the PDF buffer
6. Clean up: delete the temporary copy from Drive

**Auth pattern:**
```javascript
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
  ],
});
```

**Error handling:**
- Template not found → clear error: "Template not configured. Go to Settings → Documents."
- Permission denied → clear error: "Template not shared with service account."
- Merge field not found in template → log warning but don't fail

**Acceptance criteria:**
- ✅ Copies template successfully
- ✅ All `{{VARIABLE}}` placeholders replaced with merge data
- ✅ Exports clean PDF
- ✅ Temporary copy deleted from Drive after export
- ✅ Works with Application Default Credentials (no key file)

---

#### Step 3.2 — Rewrite `generateDocument.js` to Use Google Docs API

⬜ **Status:** Not started

**What to do:** Rewrite `functions/generateDocument.js`:

1. Remove PDFKit imports and rendering code
2. Import `googleDocsGenerator.js`
3. Accept input: `{ patientId, templateKey, assessmentId (optional), orgId }`
4. Load patient data from `organizations/{orgId}/patients/{patientId}`
5. If `assessmentId` provided, load assessment from `...patients/{patientId}/visits/{assessmentId}`
6. Load org settings to get template IDs from `organizations/{orgId}`
7. Look up the Google Doc template ID: `org.settings.documentTemplates[templateKey]`
8. Call `prepareMergeData({ patient, assessment, organization })` to build the merge data object
9. Call `generateFromTemplate(templateDocId, mergeData, outputFileName)`
10. Upload PDF to Cloud Storage (or return buffer for download)
11. Log to `organizations/{orgId}/generatedDocuments/{docId}`

**Also add `googleapis` to functions dependencies:**
```bash
cd functions && npm install googleapis
```

**Acceptance criteria:**
- ✅ Uses Google Docs API instead of PDFKit
- ✅ Reads template ID from org settings (not hardcoded)
- ✅ Loads assessment data when assessmentId provided
- ✅ Generated PDF has all merge fields populated
- ✅ Temporary Drive copy cleaned up
- ✅ Generation logged to Firestore

---

#### Step 3.3 — Redesign DocumentsPage for Assessment-Based Flow

⬜ **Status:** Not started

**What to do:** Redesign `src/components/DocumentsPage.jsx` for the new workflow:

**New flow:**
1. **Select Patient** — search/dropdown
2. **Select Assessment** (optional) — list of assessments for that patient from `visits` subcollection. Show date, visit type, status. Option for "Manual (no assessment)" which generates with blank Tier 2+3 fields.
3. **Smart Document Selection** — based on patient's current benefit period, auto-select the correct document set per the Period → documentTypes mapping. Allow user to add/remove individual documents.
4. **Generate** — calls `generateDocument` Cloud Function for each selected template, passing `patientId`, `templateKey`, `assessmentId`, and `orgId`
5. **Results** — show download links for generated PDFs, generation history

**Tabs:**
- "Generate" — the main workflow above
- "History" — list of previously generated documents from `generatedDocuments` subcollection

**Acceptance criteria:**
- ✅ Patient selector works
- ✅ Assessment selector shows visits for selected patient
- ✅ "Manual" option works (no assessment)
- ✅ Smart document selection matches period → template mapping
- ✅ Can add/remove templates from selection
- ✅ Generate calls Cloud Function and shows results
- ✅ Download links work
- ✅ History tab shows past generations
- ✅ Zero emoji, all Lucide icons
- ✅ Unconfigured template → clear error message

---

#### Step 3.4 — Phase 3 Lint & Build Check

⬜ **Status:** Not started

Same as previous — lint, build, functions syntax. Also verify `googleapis` installed in functions.

---

### ✋ Phase 3 Gate — Kobe Approval Required

This is the critical gate. Before Phase 4:
- [ ] Kobe deploys functions: `cd functions && npm install && cd .. && firebase deploy --only functions`
- [ ] Kobe tests document generation end-to-end:
  - Create/select a patient with full demographics
  - Complete a Home Visit Assessment
  - Go to Documents → select patient → select assessment
  - Generate CTI → verify PDF has real data
  - Generate Attending CTI → verify CDATE1/CDATE2, D1_DATE–D6_DATE populate
  - Generate H&P → verify CALC_AGE, PHYS_ATT_NAME populate
  - Generate Progress Note → verify PROVIDER, CBX_VT, CBX_ROLE populate
  - Generate without assessment → verify clinical fields are blank
- [ ] Verify no orphaned `{{VARIABLE}}` placeholders in any generated PDF
- [ ] Verify checkbox fields show ☑/☐ correctly

---

### Phase 4: Cleanup & Final Checks

**Goal:** Remove old code, final verification, prepare for deployment.
**Dependencies:** Phase 3 complete and tested.

---

#### Step 4.1 — Remove PDFKit and Old Code

⬜ **Status:** Not started

**What to do:**
1. Remove `pdfkit` from `functions/package.json`
2. Delete `functions/lib/pdfGenerator.js`
3. Delete `functions/scripts/initDocumentTemplates.js` if it references the old system
4. Remove any imports of `pdfGenerator` or `pdfkit` from `generateDocument.js`
5. Remove `useGenericTemplate` fallback from `src/services/documentService.js`
6. Run `cd functions && npm install` to clean node_modules

**Acceptance criteria:**
- ✅ `pdfkit` not in `functions/package.json`
- ✅ `pdfGenerator.js` deleted
- ✅ No references to PDFKit anywhere in codebase
- ✅ `useGenericTemplate` removed from frontend

---

#### Step 4.2 — Uncomment `sendInvite` Secrets

⬜ **Status:** Not started

**What to do:** In `functions/sendInvite.js` (or wherever `sendInvite` is defined), uncomment the `secrets` array:

```javascript
secrets: [emailUser, emailPass]
```

**Acceptance criteria:**
- ✅ `sendInvite` function has `secrets` array uncommented
- ✅ References `emailUser` and `emailPass` correctly

---

#### Step 4.3 — Final Lint, Build & Functions Check

⬜ **Status:** Not started

**What to do:**
1. `npm run lint` — zero errors
2. `npm run build` — succeeds
3. `cd functions && npm install && node -c index.js && node -c generateDocument.js && node -c lib/googleDocsGenerator.js` — all pass
4. Grep for any remaining deprecated keys:
   ```bash
   grep -rn '60DAY\|90DAY_INITIAL\|90DAY_SECOND\|ATTEND_CERT\|PATIENT_HISTORY\|F2F_ENCOUNTER\|pdfkit\|pdfGenerator\|useGenericTemplate' --include='*.js' --include='*.jsx'
   ```
   Should return zero results.

**Acceptance criteria:**
- ✅ All checks pass
- ✅ Zero deprecated references
- ✅ Codebase is clean

---

### ✋ Phase 4 Gate — Final Kobe Manual Tasks

All code work is complete. Kobe executes these remaining manual items:

**Infrastructure:**
- [ ] `firebase functions:secrets:set EMAIL_USER` → enter Gmail address
- [ ] `firebase functions:secrets:set EMAIL_PASS` → enter app-specific password
- [ ] Add at least one email to org settings emailList
- [ ] Confirm IAM roles on service account (Firebase Auth Admin + Cloud Datastore User)

**Deployment:**
- [ ] `cd functions && npm install`
- [ ] `firebase deploy --only functions`
- [ ] `npm run build && firebase deploy --only hosting`
- [ ] Run `configureTemplates.js` to push template IDs to Firestore (if not already matching)

**Verification:**
- [ ] `verifyDatabase.js` passes with no warnings
- [ ] Verify all routes work on direct navigation (SPA rewrite configured)
- [ ] Full end-to-end smoke test:
  - [ ] Create patient with full demographics, diagnoses, known hazards
  - [ ] Open Home Visits → select patient → profile displays with hazards + Maps link
  - [ ] Start New Assessment → fill form → Complete
  - [ ] Navigate to Documents → select patient → select completed assessment
  - [ ] Smart selection shows correct doc set for visit type
  - [ ] Generate All → PDFs download with actual data
  - [ ] Verify no orphaned `{{VARIABLE}}` in PDFs
  - [ ] Verify checkboxes render ☑/☐
  - [ ] Settings → Documents → template URLs saved/loading
  - [ ] Edit Patient → panel scrolls correctly, footer pinned
  - [ ] Documents page → zero emoji, all Lucide icons
  - [ ] Generate without assessment (manual mode) → works, clinical fields blank
- [ ] Test email notification: use test email function or wait for scheduled check

---

### Phase 5: Test Data Cleanup

**Goal:** Remove all test accounts, dummy patients, test assessments, and test-generated documents so production Firestore and Firebase Auth are clean. Only real user accounts and real patient data should remain.
**Dependencies:** Phase 4 Gate complete. Full smoke test passed. Do this LAST — after everything works, before handing to clinical staff.

> **⚠️ DESTRUCTIVE OPERATIONS.** This phase permanently deletes data. Kobe must back up Firestore before executing. Claude Code writes the cleanup script; Kobe reviews and runs it.

---

#### Step 5.1 — Create Firestore Cleanup Script

⬜ **Status:** Not started

**What to do:** Create `functions/scripts/cleanupTestData.js` — a Node.js script that:

1. **Deletes all dummy patients** created by `addDummyPatients.js` (15 patients with `createdBy: 'SYSTEM_DUMMY_DATA'` under `organizations/org_parrish/patients/`)
2. **Deletes John Test Smith** and any other test patients (identified by MRN prefix `TS-` or name containing "Test")
3. **For each deleted patient:** also deletes all subcollection documents:
   - `visits/{visitId}` — all assessments/visits for that patient
4. **Deletes all test-generated documents** from `organizations/org_parrish/generatedDocuments/` (all docs, since only test data has been generated so far — OR filter by documents whose `patientId` matches a deleted test patient)
5. **Deletes stale Drive files** — run `purgeDrive.js` or equivalent to remove any PDF copies left in Google Drive from test generation runs

**Safety guards:**
- Script prints a summary of what it will delete BEFORE deleting anything
- Requires `--confirm` flag to actually execute deletions (dry run by default)
- Only targets `org_parrish` — never touches other orgs
- Logs every deletion with document path

**Script structure:**
```javascript
// functions/scripts/cleanupTestData.js
// USAGE:
//   Dry run:  node scripts/cleanupTestData.js
//   Execute:  node scripts/cleanupTestData.js --confirm

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'parrish-harmonyhca' });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes('--confirm');
const ORG_ID = 'org_parrish';

async function cleanup() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no data will be deleted' : '🗑️ LIVE RUN — deleting data');

  // 1. Find test patients
  //    - createdBy === 'SYSTEM_DUMMY_DATA' (from addDummyPatients.js)
  //    - name contains "Test" (e.g., "John Test Smith")
  //    - mrNumber starts with "TS-"
  //    - mrNumber matches MR00xxxx pattern from dummy script

  // 2. For each test patient:
  //    - Delete all docs in visits subcollection
  //    - Delete the patient document

  // 3. Find generated documents referencing deleted patients
  //    - Delete from generatedDocuments subcollection

  // 4. Summary
}
```

**Acceptance criteria:**
- ✅ Dry run prints full list of documents to be deleted with paths
- ✅ With `--confirm`, deletes all test patients + their visits + generated docs
- ✅ Does NOT delete real user accounts or real patients
- ✅ Script is idempotent (safe to run multiple times)

---

#### Step 5.2 — Create Firebase Auth Cleanup Script

⬜ **Status:** Not started

**What to do:** Create `functions/scripts/cleanupTestUsers.js` — a script to list and optionally delete test user accounts from Firebase Auth.

**Logic:**
1. List all Firebase Auth users
2. Cross-reference against `users/` Firestore collection
3. Identify test accounts — accounts that are NOT in this keep-list:
   - `kobet@parrishhealthsystems.org` (Kobe — developer/owner)
   - `reneesha@parrishhealthsystems.org` (stakeholder)
   - `tajuanna@parrishhealthsystems.org` (stakeholder)
   - Any other real staff accounts Kobe identifies
4. Print the list of accounts flagged for deletion
5. With `--confirm` flag: delete from Firebase Auth AND delete their `users/{uid}` Firestore document

**Safety guards:**
- Hardcoded keep-list of real accounts that are NEVER deleted
- Dry run by default
- Prints email, uid, role, and creation date for each flagged account
- Asks for confirmation even with `--confirm` flag (double-safety)

**Acceptance criteria:**
- ✅ Lists all accounts with clear keep/delete designation
- ✅ Real accounts are never flagged for deletion
- ✅ Test accounts removed from both Firebase Auth and Firestore `users/` collection
- ✅ Corresponding `pendingInvites` for deleted users also cleaned up

---

#### Step 5.3 — Clean Up Test Scripts (Optional)

⬜ **Status:** Not started

**What to do:** Decide whether to keep or remove the test/dummy data scripts from the codebase:

**Keep (for future dev tool reference):**
- `functions/scripts/addDummyPatients.js`
- `functions/testDocGeneration.js`
- `functions/scripts/testStatelessGeneration.js`

**Recommendation:** Keep them in the repo but add a `⚠️ DEV ONLY` comment header and a `.gitignore`-style note. They'll be useful when you build the testing interface later. Alternatively, move them to a `functions/scripts/dev/` subfolder to keep them out of the way.

**Acceptance criteria:**
- ✅ Test scripts clearly marked as dev-only
- ✅ No test scripts auto-run or get deployed as Cloud Functions

---

### ✋ Phase 5 Gate — Kobe Manual Tasks

- [ ] **Back up Firestore** before running any cleanup scripts (Firebase Console → Export, or use `gcloud firestore export`)
- [ ] Review dry run output of `cleanupTestData.js` — confirm every item listed is test data
- [ ] Run `node scripts/cleanupTestData.js --confirm`
- [ ] Review dry run output of `cleanupTestUsers.js` — confirm every flagged account is a test account
- [ ] Run `node scripts/cleanupTestUsers.js --confirm`
- [ ] Verify in Firebase Console: Auth → Users shows only real accounts
- [ ] Verify in Firestore: `organizations/org_parrish/patients/` contains zero test patients
- [ ] Verify in Firestore: `organizations/org_parrish/generatedDocuments/` is empty (or contains only real docs)
- [ ] Run `verifyDatabase.js` one final time — passes clean
- [ ] **Optional:** Run `purgeDrive.js` to clean up any orphaned PDFs in Google Drive from test runs

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Variable naming inconsistencies missed | `{{DIAGNOSIS1}}` shows literally in PDF | Step 1.8 populates both variants; grep for `{{` in test PDFs |
| Template not shared with service account | "Permission denied" on generate | Phase 1 Gate requires Kobe to share all 5 templates |
| `visits` vs `assessments` subcollection name mismatch | Data not found | Verify which name code actually uses and align everywhere |
| `CALC_ICD` and `CALC_AGE` computed fields missing | Shows blank in PDF | Step 1.8 explicitly adds computation logic |
| `SUGGESTION` field (AI narrative hint) | New feature, not implemented | Set to `''` — future feature |
| Google Docs API rate limits | Timeouts on batch generation | Unlikely at current scale; add retry logic if needed |
| Old Firestore data has deprecated template keys | configureTemplates.js doesn't update | Run the script after deploy to overwrite |
| Cleanup script deletes real patient data | Data loss | Dry run by default; hardcoded keep-list for users; `createdBy` filter for patients |
| Test user accounts not fully identified | Leftover orphan accounts | Script lists ALL accounts for review before deletion |

---

## Summary: What Claude Code Does vs. What Kobe Does

**Claude Code (Track A) — 22 steps across 5 phases:**
All code changes, file edits, new components, Cloud Function rewrites, dependency updates, lint/build checks, and cleanup script creation.

**Kobe (Track B) — 15 manual items:**
1. Enable Google Docs API in Cloud Console
2. Verify Google Drive API enabled
3. Share 5 templates with service account (Editor)
4. Set EMAIL_USER secret
5. Set EMAIL_PASS secret
6. Add email recipients to org settings
7. Confirm IAM roles
8. Deploy functions
9. Build + deploy hosting
10. Run configureTemplates.js
11. End-to-end smoke test
12. Back up Firestore before cleanup
13. Review + run test data cleanup script
14. Review + run test user cleanup script
15. Final verification: Auth clean, Firestore clean, verifyDatabase.js passes

---

*This document should be provided to Claude Code at the start of each session. Claude reads the current step, proposes changes, waits for approval, then proceeds.*
