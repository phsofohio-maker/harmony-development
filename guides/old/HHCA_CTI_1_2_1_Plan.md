# **HHCA CTI 1.2.1 — Post-Review Implementation Plan**

## **How To Use This Plan**

This document is the implementation guide for the Harmony 1.2.1 patch — a set of tasks identified during Kobe's review of the 1.2.0 implementation. It follows the same workflow as the 1.2.0 plan: Claude Code reads each step, proposes changes, Kobe approves, then moves to the next.

**Workflow:**

1. Claude reads the current step  
2. Claude proposes the code changes for that step  
3. Kobe reviews and approves (or requests changes)  
4. Once approved, Claude marks the step `✅` and moves to the next  
5. At the end of each Phase, Claude runs the verification checklist before proceeding

**Approval Gates:** Each step marked with `⬜` requires explicit approval. Mark as `✅` when complete.

---

## **Decision Log**

These decisions were made during plan review and are **final** — Claude Code should not re-ask these questions.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | **Document Template Keys** — Old keys (`CTI`, `ATTEND_CTI`, `PROGRESS_NOTE`, `PHYSICIAN_HP`, `HOME_VISIT_ASSESSMENT`) vs. new keys (`60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`, `ATTEND_CERT`, etc.) | **Delete the old keys.** Replace entirely with the new key set. The org schema in `organizationService.js` already uses the new keys (`60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`, `ATTEND_CERT`, `PROGRESS_NOTE`, `F2F_ENCOUNTER`, `HOME_VISIT_ASSESSMENT`). Remove any references to the legacy keys (`CTI`, `ATTEND_CTI`, `PHYSICIAN_HP`) from the codebase. | The old keys were from the original Google Sheets-era logic. The new keys properly distinguish between 60-day and 90-day certification narratives and align with the 1.2.0 data architecture. |
| 2 | **PDF Generation Architecture** — Keep PDFKit (stateless Node.js) or switch to Google Docs API (copy template → find/replace → export as PDF)? | **Switch to Google Docs API.** The organization's document templates already exist as Google Docs. It makes more sense to use those directly (copy → merge → export) rather than trying to recreate their layout in PDFKit. | Templates are already built in Google Docs with proper formatting. Recreating them in PDFKit would be duplicating work and diverging from the source of truth. Google Docs API also gives orgs full control over template design without code changes. |
| 3 | **"[No content provided]" bug** — Fix before or after new features? | **Fix first.** Diagnose and fix the `[No content provided]` bug in Phase 1 before building any new document generation features. This gives us a working baseline. | Can't build on top of broken generation. Need to understand the root cause before layering on the Google Docs API switch. |
| 4 | **HomeVisitsPage scope** — Does `HomeVisitAssessment` keep its own standalone route? | **No standalone route.** The existing `HomeVisitAssessment.jsx` becomes a modal/slide-panel within the new `HomeVisitsPage.jsx`. The route `'visits'` renders `<HomeVisitsPage />`, and the assessment form opens as a modal when "Start New Assessment" is clicked. After save/complete, the modal closes and the visits page refreshes. | The Home Visits page becomes a full assessment toolkit/dashboard. The assessment form is one action within that toolkit, not a separate destination. |

---

## **Summary of Changes**

These changes address issues found during post-implementation review, organized into 4 phases by dependency order:

**Phase 1 — Bug Fixes & Baseline (do first)**
1. Diagnose and fix `[No content provided]` PDF generation bug
2. PatientModal overflow — Edit panel can't scroll, content clipped
3. Documents page emoji cleanup — Emojis used instead of Lucide icons
4. Delete legacy document template keys from codebase

**Phase 2 — Feature Additions**
5. Settings page "Documents" tab — Organizations configure their own Google Doc template links
6. Home Visits page expansion — Full assessment toolkit/dashboard with patient profile, previous assessments, and start-new-assessment flow

**Phase 3 — Document Generation Pipeline Overhaul**
7. Switch `generateDocument` from PDFKit to Google Docs API (copy → merge → export PDF)
8. Redesign Documents page for assessment-based generation flow
9. Wire Documents page to pass `assessmentId` to Cloud Function

**Phase 4 — Cleanup**
10. Remove PDFKit dependency and old generation code
11. End-to-end smoke test

---

## **Phase 1: Bug Fixes & Working Baseline**

**Goal:** Fix the broken PDF generation, fix the modal overflow, clean up emoji, and remove legacy template keys so we have a solid foundation before building new features.  
**Estimated effort:** 1–2 days  
**Dependencies:** None

---

### **Step 1.1 — Diagnose and Fix `[No content provided]` PDF Bug**

✅ **Status:** Complete

**Problem:** Generated Home Visit Assessment PDFs show `[No content provided]` for every section (Vital Signs, Functional Assessment, Symptom Assessment, Care Plan, Narrative Notes). This was observed on MRN 23578 / John Test Smith.

**Root cause investigation — check these in order:**

**A) Is the Cloud Function receiving the right data?**
1. Open `functions/generateDocument.js` — find where `customData` is used
2. Check: is the function reading patient data from Firestore? (It does: `patientDoc.data()`)
3. Check: is the function reading assessment/visit data? (Likely NOT — there's no `assessmentId` parameter yet)
4. Check: what does `prepareMergeData()` in `functions/lib/pdfGenerator.js` actually receive?

**B) Is `prepareMergeData` mapping fields correctly?**
1. Open `functions/lib/pdfGenerator.js` — find `prepareMergeData()`
2. Check: does it map clinical fields (vitals, symptoms, care plan, narratives) from the patient doc or from customData?
3. Most likely finding: `prepareMergeData` only maps patient demographics (Tier 1), and clinical fields (Tier 2+3) resolve to empty strings because no assessment data is passed

**C) Is the PDFKit template renderer using the merge data?**
1. In `pdfGenerator.js`, check the `renderSection()` function
2. Check: does it look up merge variables from the context, or does it output static placeholder text?
3. Most likely finding: sections reference variables that aren't in the merge context, so they render as `[No content provided]` or empty

**What to fix (minimum viable fix for now — full Google Docs switch is Phase 3):**

1. Add `assessmentId` as an optional parameter to `generateDocument`:
```javascript
// In functions/generateDocument.js
const { patientId, documentType, assessmentId, customData = {} } = request.data;
```

2. When `assessmentId` is provided, load the assessment data:
```javascript
let assessmentData = null;
if (assessmentId) {
  const assessmentDoc = await db
    .collection('organizations').doc(orgId)
    .collection('patients').doc(patientId)
    .collection('visits').doc(assessmentId)
    .get();
  if (assessmentDoc.exists) {
    assessmentData = assessmentDoc.data();
  }
}
```

3. Pass `assessmentData` to `prepareMergeData`:
```javascript
// Change: prepareMergeData(patientData, orgData, customData)
// To:     prepareMergeData(patientData, assessmentData, orgData, customData)
```

4. Expand `prepareMergeData` to map Tier 2+3 variables from assessment data (reference the 68-variable mapping from 1.2.0 Plan Step 3.4)

5. When `assessmentData` is null (no assessment selected), all Tier 2+3 fields resolve to `''` (backward compatible)

**This is a temporary fix.** Phase 3 replaces PDFKit with Google Docs API entirely. But this step ensures the data pipeline works before we switch renderers.

**Test procedure:**
1. Create a test patient with full demographics
2. Complete a Home Visit Assessment for that patient (saves to `visits` subcollection)
3. Call `generateDocument` with both `patientId` AND `assessmentId`
4. Verify the generated PDF has actual data in clinical sections (not `[No content provided]`)
5. Call `generateDocument` with only `patientId` (no assessmentId) — verify it still works with blank clinical sections

**Acceptance criteria:**

* ✅ Root cause of `[No content provided]` is identified and documented
* ✅ `generateDocument` accepts optional `assessmentId` parameter
* ✅ When `assessmentId` is provided, assessment data populates Tier 2+3 fields in the PDF
* ✅ When `assessmentId` is not provided, Tier 2+3 fields are blank (backward compatible)
* ✅ No regressions in existing document generation flow

---

### **Step 1.2 — Fix PatientModal Overflow / Scroll**

✅ **Status:** Complete

**Problem:** The Edit Patient panel overflows the viewport. Users cannot scroll to see all tab content. The footer may be clipped or unreachable.

**What to do:** Edit `src/components/PatientModal.jsx` — fix the CSS for `.modal-container.wide` and `.modal-body`:

**Root cause:** The modal uses `max-height: 90vh` and `display: flex; flex-direction: column` on the container, which is correct. But the `.modal-body` needs `min-height: 0` to allow flex shrinking, and `overflow-y: auto` must be explicitly set. The compliance summary bar, tab row, and footer consume fixed vertical space — the body must fill the remainder and scroll independently.

**CSS changes:**

```css
.modal-container.wide {
  /* existing styles stay */
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;  /* ADD — prevent container from scrolling */
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;  /* ADD — critical for flex children to shrink below content height */
}

.modal-header,
.modal-tabs,
.compliance-summary,
.modal-footer {
  flex-shrink: 0;  /* ADD — prevent these from shrinking */
}
```

**Test procedure:**

1. Open Edit Patient modal for any patient with data
2. Navigate to the tab with the most fields (Clinical or Compliance)
3. Verify the body scrolls independently
4. Verify the footer "Save Changes" / "Cancel" buttons are always visible and pinned to the bottom
5. Verify tab bar stays visible and clickable while scrolling body content
6. Test on a short viewport (resize browser to ~600px height)

**Acceptance criteria:**

* ✅ Modal body scrolls independently of header/tabs/footer
* ✅ Footer is always visible (pinned to bottom)
* ✅ Tab bar stays accessible while scrolling
* ✅ No content is clipped at any viewport height ≥ 500px
* ✅ Works on mobile viewport (375px width)

---

### **Step 1.3 — Replace Emoji with Lucide Icons on Documents Page**

✅ **Status:** Complete

**Problem:** `src/components/DocumentsPage.jsx` uses emoji characters (🕐, 📄, 📚, ⏳, ✅, ❌, etc.) for tab buttons, status indicators, and inline labels. All other pages in the app use Lucide React icons.

**What to do:** Edit `src/components/DocumentsPage.jsx`:

1. Add Lucide imports at the top:

```javascript
import {
  FileText,      // replaces 📄
  Clock,         // replaces 🕐
  Library,       // replaces 📚
  Loader2,       // replaces ⏳
  CheckCircle,   // replaces ✅
  XCircle,       // replaces ❌
  AlertCircle,   // replaces ⚠️
  Download,      // replaces 📥
  RefreshCw,     // replaces 🔄
  Info,          // replaces ℹ️
  ChevronRight,  // for navigation hints
  Search,        // for patient search
  Zap,           // for Quick Generate
} from 'lucide-react';
```

2. Find-and-replace every emoji with the corresponding `<IconName size={16} />` or `<IconName size={18} />` (match surrounding text size).

**Emoji → Icon mapping:**

| Current Emoji | Replace With | Context |
|---|---|---|
| `🕐` | `<Clock size={16} />` | History tab label |
| `📄` | `<FileText size={16} />` | Generate tab label, doc references |
| `📚` | `<Library size={18} />` | Template Library header |
| `⏳` | `<Loader2 size={16} className="spin" />` | Generating state |
| `✅` | `<CheckCircle size={16} style={{color: '#10b981'}} />` | Success status |
| `❌` | `<XCircle size={16} style={{color: '#ef4444'}} />` | Error status |
| `⚠️` | `<AlertCircle size={16} style={{color: '#f59e0b'}} />` | Warning status |
| `📥` | `<Download size={16} />` | Download links |
| `🔄` | `<RefreshCw size={16} />` | Refresh/retry |
| `ℹ️` | `<Info size={16} />` | Info messages |

3. Ensure no emoji remain in the file. Run a search for emoji unicode ranges or common emoji characters.

**Acceptance criteria:**

* ✅ Zero emoji characters in DocumentsPage.jsx
* ✅ All icons are Lucide React components
* ✅ Icon sizes are consistent (16px for inline, 18px for headers)
* ✅ Color coding matches the app's design tokens (green for success, red for error, amber for warning)
* ✅ Spinner animation works on `<Loader2>` with `className="spin"`

---

### **Step 1.4 — Delete Legacy Document Template Keys**

✅ **Status:** Complete

**Problem:** The codebase may still reference old template keys (`CTI`, `ATTEND_CTI`, `PROGRESS_NOTE`, `PHYSICIAN_HP`, `HOME_VISIT_ASSESSMENT`) from the pre-1.2.0 era. The canonical key set is now defined in `organizationService.js` under `ORG_DEFAULTS.settings.documentTemplates`:

```javascript
// CANONICAL keys (keep these):
'60DAY'                  // CTI 60-Day Narrative (Period 3+)
'90DAY_INITIAL'          // CTI 90-Day Initial (Period 1)
'90DAY_SECOND'           // CTI 90-Day Second (Period 2)
'ATTEND_CERT'            // Attending Physician Certification
'PROGRESS_NOTE'          // Clinical Progress Note
'F2F_ENCOUNTER'          // Face-to-Face Encounter
'HOME_VISIT_ASSESSMENT'  // Physician Home Visit Assessment
```

**What to do:**

1. **Search the entire codebase** for references to the old keys: `CTI`, `ATTEND_CTI`, `PHYSICIAN_HP`
   - Check: `DocumentsPage.jsx`, `documentService.js`, `generateDocument.js`, `pdfGenerator.js`, `initDocumentTemplates.js`, any scripts/
   - Also check for any hardcoded template arrays or objects that list document types

2. **Remove or replace** every old key reference:
   - If it's a dropdown/selector option → replace with the canonical key
   - If it's a template lookup → update to use canonical key
   - If it's a migration script or init script → update the key set

3. **Verify `organizationService.js`** `ORG_DEFAULTS.settings.documentTemplates` matches the canonical set above (it already should based on current code)

4. **Check Firestore** — if the live `organizations/org_parrish` doc still has old keys in `settings.documentTemplates`, note it for manual cleanup (don't auto-migrate in this step)

**Acceptance criteria:**

* ✅ Zero references to `CTI` (as a standalone template key), `ATTEND_CTI`, or `PHYSICIAN_HP` in the codebase
* ✅ `PROGRESS_NOTE` and `HOME_VISIT_ASSESSMENT` are kept (they exist in both old and new sets)
* ✅ All document type selectors/dropdowns use the canonical 7-key set
* ✅ No broken imports or references after cleanup

---

### **✋ Phase 1 — Verification Checklist**

⬜ Generate a document with assessmentId → PDF contains actual patient/assessment data (not `[No content provided]`)  
⬜ Generate a document without assessmentId → still works, clinical sections blank  
⬜ Open PatientModal in edit mode → body scrolls, footer pinned, tabs accessible  
⬜ Open PatientModal on mobile viewport → same behavior  
⬜ Navigate to Documents page → zero emoji visible  
⬜ All Lucide icons render with correct colors and sizes  
⬜ Search codebase for old template keys → zero matches  
⬜ No console errors from any change  

---

## **Phase 2: Feature Additions (Independent of Document Generation Overhaul)**

**Goal:** Add the Settings "Documents" tab and expand Home Visits page. These can be built in parallel.  
**Estimated effort:** 1–2 days  
**Dependencies:** Phase 1 complete (working baseline, clean foundation)

---

### **Step 2.1 — Add "Documents" Tab to Settings Page**

✅ **Status:** Complete

**Problem:** Organizations need to configure their own Google Doc template links. Currently, template IDs are set via the `setupOrg.js` script or manually in the Firebase console. There's no UI for admins to manage this.

**What to do:** Edit `src/components/SettingsPage.jsx`:

**A) Add the tab to the tabs array:**

```javascript
import { FileText } from 'lucide-react'; // add to existing imports

const tabs = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'physicians', label: 'Physicians', icon: Stethoscope },
  { id: 'documents', label: 'Documents', icon: FileText },      // NEW
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'data', label: 'Data', icon: Database },
];
```

**B) Add state for document templates:** Load from `organizations/{orgId}` field `settings.documentTemplates` (already exists in org schema per `organizationService.js` — `ORG_DEFAULTS.settings.documentTemplates`).

```javascript
const [docTemplates, setDocTemplates] = useState({
  '60DAY': '',
  '90DAY_INITIAL': '',
  '90DAY_SECOND': '',
  'ATTEND_CERT': '',
  'PROGRESS_NOTE': '',
  'F2F_ENCOUNTER': '',
  'HOME_VISIT_ASSESSMENT': '',
});
```

Load in the existing `loadSettings` function from `orgDoc.data().settings?.documentTemplates`.

**C) Build the tab content:**

Admin-only visibility — wrap in a role check:

```javascript
{activeTab === 'documents' && (
  <div className="settings-section">
    <div className="section-card">
      <h2>Document Templates</h2>
      <p className="section-desc">
        Link Google Docs templates for each document type. The system will copy these
        templates and replace placeholders with patient/assessment data during generation.
      </p>

      {/* Role gate */}
      {userRole !== 'admin' && userRole !== 'owner' ? (
        <div className="info-box">
          Only administrators can manage document templates.
        </div>
      ) : (
        <div className="template-list">
          {DOCUMENT_TYPES.map(docType => (
            <div key={docType.id} className="template-row">
              <div className="template-info">
                <span className="template-name">{docType.label}</span>
                <span className="template-desc">{docType.description}</span>
              </div>
              <div className="template-input-row">
                <input
                  type="url"
                  value={docTemplates[docType.id] || ''}
                  onChange={(e) => setDocTemplates(prev => ({
                    ...prev,
                    [docType.id]: e.target.value
                  }))}
                  placeholder="https://docs.google.com/document/d/..."
                  className={`template-input ${
                    docTemplates[docType.id] && !isValidGoogleDocUrl(docTemplates[docType.id])
                      ? 'invalid' : ''
                  }`}
                />
                {docTemplates[docType.id] && (
                  <a
                    href={docTemplates[docType.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon"
                    title="Open template in new tab"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
              {docTemplates[docType.id] && !isValidGoogleDocUrl(docTemplates[docType.id]) && (
                <span className="field-error">
                  <AlertCircle size={14} />
                  Enter a valid Google Docs URL
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Save button */}
    {(userRole === 'admin' || userRole === 'owner') && (
      <div className="save-bar">
        <button className="btn-primary" onClick={saveDocTemplates} disabled={saving}>
          {saving ? <><Loader2 className="spin" size={16} /> Saving...</> : <><Save size={16} /> Save Templates</>}
        </button>
      </div>
    )}
  </div>
)}
```

**D) Add constants and helpers:**

```javascript
const DOCUMENT_TYPES = [
  { id: '60DAY',                  label: 'CTI 60-Day Narrative',             description: 'Used for 3rd+ benefit period recertifications' },
  { id: '90DAY_INITIAL',         label: 'CTI 90-Day Initial',               description: 'Used for 1st benefit period initial certification' },
  { id: '90DAY_SECOND',          label: 'CTI 90-Day Second',                description: 'Used for 2nd benefit period recertification' },
  { id: 'ATTEND_CERT',           label: 'Attending Physician CTI',          description: 'Attending physician certification statement' },
  { id: 'PROGRESS_NOTE',         label: 'Progress Note',                    description: 'Standard clinical progress note' },
  { id: 'F2F_ENCOUNTER',         label: 'Face-to-Face Encounter',           description: 'F2F encounter documentation' },
  { id: 'HOME_VISIT_ASSESSMENT', label: 'Physician Home Visit Assessment',  description: 'Comprehensive home visit form' },
];

function isValidGoogleDocUrl(url) {
  if (!url) return true; // empty is OK (not configured yet)
  return /^https:\/\/docs\.google\.com\/document\/d\/[\w-]+/.test(url);
}
```

**E) Save function:**

```javascript
const saveDocTemplates = async () => {
  setSaving(true);
  try {
    // Extract just the Google Doc ID from URLs if full URL provided
    const templateIds = {};
    for (const [key, url] of Object.entries(docTemplates)) {
      if (url) {
        const match = url.match(/\/document\/d\/([\w-]+)/);
        templateIds[key] = match ? match[1] : url; // Store ID if extractable, else raw value
      } else {
        templateIds[key] = '';
      }
    }
    await updateDoc(doc(db, 'organizations', orgId), {
      'settings.documentTemplates': templateIds,
      updatedAt: serverTimestamp(),
    });
    setSaveMessage({ type: 'success', text: 'Document templates saved!' });
  } catch (err) {
    console.error('Error saving templates:', err);
    setSaveMessage({ type: 'error', text: 'Failed to save templates.' });
  } finally {
    setSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  }
};
```

**Firestore path:** `organizations/{orgId}.settings.documentTemplates`  
**Security:** Firestore rules already allow org admins to update org doc.

**Acceptance criteria:**

* ✅ "Documents" tab appears in Settings navigation between "Physicians" and "Notifications"
* ✅ Only admin/owner roles see the template inputs; others see an info message
* ✅ Each of the 7 document types has a labeled input row
* ✅ URL validation shows error state for non-Google-Docs URLs
* ✅ "Open in new tab" link works for configured templates
* ✅ Save extracts the Google Doc ID from full URLs and stores to `settings.documentTemplates`
* ✅ Loading settings pre-fills existing template IDs (converts back to full URLs for display if needed)
* ✅ Empty inputs are valid (template not yet configured)

---

### **Step 2.2 — Expand Home Visits Page to Assessment Toolkit**

✅ **Status:** Complete

**Problem:** The current Home Visits page (`src/components/HomeVisitAssessment.jsx`) is just the assessment form itself. It needs to become a full toolkit/dashboard with patient profile, previous assessments, and a "Start New Assessment" entry point.

**Architecture decision (from Decision Log #4):** `HomeVisitAssessment.jsx` loses its standalone route. It becomes a modal/slide-panel within the new `HomeVisitsPage.jsx`.

**What to do:**

**A) Rename the page:**

1. In `src/components/Sidebar.jsx`: Change the navigation item label from "Visits" to "Home Visits"
2. In `src/App.jsx`: The case for `'visits'` currently renders `<HomeVisitAssessment />` — change it to render `<HomeVisitsPage />`

**B) Create a new wrapper component** `src/components/HomeVisitsPage.jsx` that serves as the toolkit/dashboard:

```
┌─────────────────────────────────────────────────┐
│  Home Visits                    [Select Patient ▾]│
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─ Quick-Access Patient Profile ──────────────┐ │
│  │  Name: John Smith    Age: 72   Gender: M     │ │
│  │  Language: English                           │ │
│  │  ⚠ Known Hazards: Aggressive dog, Stairs    │ │
│  │                                              │ │
│  │  Contact: (555) 123-4567                     │ │
│  │  Address: 123 Main St  [📍 Open in Maps]     │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Previous Assessments ───────────────────────┐ │
│  │  Date        Provider      Type      Status  │ │
│  │  03/01/26    Dr. Adams     Routine   Complete│ │
│  │  02/15/26    Dr. Adams     Recert    Complete│ │
│  │  02/01/26    NP Jones      F2F       Complete│ │
│  │                                    [View All]│ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│        [ + Start New Assessment ]                 │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Section 1 — Quick-Access Patient Profile:**

After patient is selected from dropdown, display:
- **Name**, **Age** (calculated from DOB), **Gender**, **Primary Language**
- **Known Hazards** field — this is a NEW field. Add `knownHazards` (string) to the patient schema. Examples: "aggressive dog," "stairs only," "oxygen in use". Display with a warning icon (`AlertTriangle`) if populated.
- **Contact Information:**
  - Phone number (from `patient.primaryContact.phone` or dedicated patient phone)
  - Address (from `patient.address`)
  - **"Open in Maps" button** — renders as:

```javascript
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(patient.address)}`;
<a href={mapsUrl} target="_blank" rel="noopener noreferrer">
  <MapPin size={16} /> Open in Maps
</a>
```

**Section 2 — Previous Assessments:**

Query `organizations/{orgId}/patients/{patientId}/visits` ordered by `visitDate` descending, limit 10.

Display as a table with columns: Date, Provider, Visit Type, Status (draft/complete/paper), Actions (View button).

"View" opens a read-only detail panel/modal showing the assessment data.

If no assessments exist, show an empty state: "No previous assessments recorded."

**Section 3 — Start New Assessment Button:**

Prominent button at the bottom. When clicked:
- Opens the existing `HomeVisitAssessment` form as a **modal/slide-over panel** (not a full page navigation)
- Pre-selects the currently selected patient
- After "Save Draft" or "Complete Assessment" → closes the modal → refreshes the Previous Assessments list
- On "Complete Assessment" → optionally prompts: "Generate documents now?" → if yes, navigates to Documents page with this assessment pre-selected

**C) Update App.jsx routing:**

Change the `'visits'` case to render `<HomeVisitsPage />` instead of `<HomeVisitAssessment />`.

**D) Add `knownHazards` field to patient schema:**

1. In `src/services/patientService.js`: Add `knownHazards: ''` to `createPatientSchema` and `docToPatient`
2. In `src/components/PatientModal.jsx`: Add a text input for "Known Hazards" on the Demographics tab (with placeholder: "e.g., aggressive dog, stairs only, oxygen in use")
3. Add to `EMPTY_FORM`: `knownHazards: ''`

**Acceptance criteria:**

* ✅ Sidebar shows "Home Visits" (not "Visits")
* ✅ Page loads with patient selector at top
* ✅ Selecting a patient shows Quick-Access Profile with name, age, gender, language, hazards
* ✅ "Open in Maps" button opens Google Maps with the patient's address
* ✅ Known Hazards displays with warning icon when populated
* ✅ Previous Assessments table loads from `visits` subcollection
* ✅ "Start New Assessment" opens the assessment form as a modal/panel
* ✅ Completing an assessment refreshes the list and optionally navigates to Documents
* ✅ `knownHazards` field exists on patient schema, editable in PatientModal
* ✅ Empty state shown when no assessments exist for the patient
* ✅ `HomeVisitAssessment` no longer has its own standalone route

---

### **✋ Phase 2 — Verification Checklist**

⬜ Settings → Documents tab visible for admin users  
⬜ Settings → Documents tab shows info message for non-admin users  
⬜ Enter a Google Docs URL → validation passes, save works, reload shows saved value  
⬜ Enter a garbage URL → validation error displayed  
⬜ Home Visits page → select patient → profile displays correctly  
⬜ Home Visits page → "Open in Maps" opens Google Maps with correct address  
⬜ Home Visits page → previous assessments list loads (or empty state shows)  
⬜ Home Visits page → "Start New Assessment" → form opens as modal → save → list refreshes  
⬜ Patient Modal → "Known Hazards" field exists on Demographics tab  
⬜ Sidebar label reads "Home Visits"  

---

## **Phase 3: Document Generation Pipeline Overhaul**

**Goal:** Replace PDFKit with Google Docs API for document generation. Documents are generated by copying a Google Doc template, replacing `{{VARIABLE}}` placeholders with patient/assessment data, and exporting as PDF.  
**Estimated effort:** 2–3 days  
**Dependencies:** Phase 2 complete (Settings templates tab exists for template configuration, Home Visits page creates assessments)

---

### **Step 3.1 — Add Google Docs/Drive API to Cloud Functions**

✅ **Status:** Complete

**Problem:** The current `generateDocument` Cloud Function uses PDFKit to render PDFs from a code-defined template config. Per Decision Log #2, we're switching to Google Docs API because the templates already exist as Google Docs.

**What to do:**

**A) Add googleapis dependency:**

```bash
cd functions/
npm install googleapis
```

Update `functions/package.json` to include `"googleapis": "^131.0.0"` (or latest).

**B) Create `functions/lib/googleDocsGenerator.js`:**

```javascript
const { google } = require('googleapis');

/**
 * Generate a PDF by copying a Google Doc template,
 * replacing all {{VARIABLE}} placeholders, and exporting as PDF.
 *
 * @param {string} templateDocId - Google Doc ID of the template
 * @param {Object} mergeData - Key/value pairs: { 'PATIENT_NAME': 'John Smith', ... }
 * @returns {Buffer} - PDF file as a Buffer
 */
async function generateFromGoogleDoc(templateDocId, mergeData) {
  // Use Application Default Credentials (Firebase service account)
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  // 1. Copy the template
  const copyResponse = await drive.files.copy({
    fileId: templateDocId,
    requestBody: {
      name: `Generated_${Date.now()}`,
    },
  });
  const copyId = copyResponse.data.id;

  try {
    // 2. Build batch update requests for find/replace
    const requests = Object.entries(mergeData).map(([key, value]) => ({
      replaceAllText: {
        containsText: {
          text: `{{${key}}}`,
          matchCase: true,
        },
        replaceText: value || '',
      },
    }));

    // 3. Execute batch update
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: copyId,
        requestBody: { requests },
      });
    }

    // 4. Export as PDF
    const pdfResponse = await drive.files.export(
      { fileId: copyId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(pdfResponse.data);

  } finally {
    // 5. Delete the temporary copy (cleanup)
    try {
      await drive.files.delete({ fileId: copyId });
    } catch (cleanupErr) {
      console.warn('Failed to delete temp doc copy:', cleanupErr.message);
    }
  }
}

module.exports = { generateFromGoogleDoc };
```

**C) IAM / Permissions:**

The Firebase service account (`1062012852590-compute@developer.gserviceaccount.com`) needs:
- Google Docs API enabled on the project
- Google Drive API enabled on the project
- The Google Doc templates must be **shared with the service account email** (Viewer access minimum, but Editor needed for copy+delete workflow)

**Important:** Each organization's templates need to be shared with the service account. Document this requirement in the Settings → Documents tab UI (add a helper text or info box explaining they need to share templates with the service account email).

**D) Enable APIs in Google Cloud Console:**
1. Go to APIs & Services → Library
2. Enable "Google Docs API"
3. Enable "Google Drive API"

**Acceptance criteria:**

* ✅ `googleapis` is in `functions/package.json` dependencies
* ✅ `googleDocsGenerator.js` exports `generateFromGoogleDoc(templateDocId, mergeData)`
* ✅ Function copies template, replaces placeholders, exports PDF, deletes copy
* ✅ Google Docs API and Google Drive API are enabled on the Firebase project
* ✅ Service account permissions are documented

---

### **Step 3.2 — Rewrite `generateDocument` Cloud Function to Use Google Docs**

✅ **Status:** Complete

**Problem:** The current `generateDocument` function uses PDFKit via `lib/pdfGenerator.js`. It needs to switch to `lib/googleDocsGenerator.js`.

**What to do:** Edit `functions/generateDocument.js`:

**A) Replace the PDF generation call:**

```javascript
// OLD:
const pdfBuffer = await generatePDF(templateConfig, patient, orgData, customData);

// NEW:
const { generateFromGoogleDoc } = require('./lib/googleDocsGenerator');

// Get template ID from org settings
const orgTemplates = orgData.settings?.documentTemplates || {};
const templateDocId = orgTemplates[documentType];

if (!templateDocId) {
  throw new HttpsError('failed-precondition',
    `Template not configured for "${documentType}". Go to Settings → Documents to configure.`
  );
}

// Build merge data from patient + assessment + org
const mergeData = prepareMergeData(patient, assessmentData, orgData, customData);

// Generate PDF via Google Docs
const pdfBuffer = await generateFromGoogleDoc(templateDocId, mergeData);
```

**B) Update `prepareMergeData` to return a flat key-value object:**

The Google Docs API replaceAllText needs a flat `{ 'PATIENT_NAME': 'John Smith', 'DOB': '01/15/1954', ... }` object (no nesting, no `{{}}` wrappers — those are added in the generator).

```javascript
function prepareMergeData(patient, assessment, org, customData) {
  const data = {};

  // Tier 1: Patient Demographics
  data['PATIENT_NAME'] = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.name || '';
  data['DOB'] = formatDate(patient.dateOfBirth || patient.dob);
  data['MRN'] = patient.mrNumber || patient.mrn || '';
  data['MBI'] = patient.mbi || '';
  data['MPI'] = patient.medicaidNumber || '';
  data['ADMISSION_DATE'] = formatDate(patient.admissionDate);
  data['ELECTION_DATE'] = formatDate(patient.electionDate);
  data['CDATE_START'] = formatDate(patient.certStartDate);
  data['CDATE_END'] = formatDate(patient.certEndDate);
  data['BENEFIT_PERIOD_NUM'] = String(patient.currentBenefitPeriod || '');
  data['PATIENT_ADDRESS'] = patient.address || '';
  data['PATIENT_PHONE'] = formatPhone(patient.patientPhone || '');
  data['PATIENT_LOCATION'] = patient.locationName || '';

  // Diagnoses 1-6
  for (let i = 0; i < 6; i++) {
    const dx = patient.diagnoses?.[i];
    data[`DIAGNOSIS_${i + 1}`] = dx?.name || '';
    data[`DX_DATE_${i + 1}`] = formatDate(dx?.onsetDate);
  }

  // Attending physician
  const attending = patient.attendingPhysician || {};
  data['ATTENDING_PHYSICIAN_NAME'] = typeof attending === 'string' ? attending : attending.name || '';
  data['ATTENDING_PHYSICIAN_NPI'] = attending.npi || '';
  data['ATTENDING_PHYSICIAN_PHONE'] = formatPhone(attending.phone || '');

  // F2F fields
  data['F2F_DATE'] = formatDate(patient.f2fDate);
  data['F2F_PROVIDER_NAME'] = patient.f2fPhysician || '';
  data['F2F_PROVIDER_NPI'] = patient.f2fProviderNpi || '';

  // Checkbox fields (Tier 1)
  data['CBX_GENDER'] = resolveCheckbox(patient.gender, ['Male', 'Female', 'Other']);
  data['CBX_BENEFIT_PERIOD'] = resolveCheckbox(String(patient.currentBenefitPeriod), ['1', '2', '3', '4', '5', '6+']);
  data['CBX_F2F_STATUS'] = resolveCheckbox(patient.f2fRequired ? 'Required' : 'Not Required', ['Required', 'Not Required', 'Completed']);

  // Organization fields
  data['HOSPICE_NAME'] = org.name || org.agencyName || '';
  data['HOSPICE_NPI'] = org.npi || '';

  // Tier 2+3: Assessment data (if provided)
  if (assessment) {
    data['SELECT_DATE'] = formatDate(assessment.visitDate);
    data['TIME_IN'] = assessment.visitTime || assessment.timeIn || '';
    data['TIME_OUT'] = assessment.timeOut || '';
    data['PROVIDER_NAME'] = assessment.clinicianName || '';
    data['PROVIDER_NPI'] = assessment.clinicianNpi || '';

    // Checkbox fields (Tier 2)
    data['CBX_VISIT_TYPE'] = resolveCheckbox(assessment.visitType, ['Routine', 'PRN', 'Admission', 'Recertification', 'Discharge', 'Follow-Up']);
    data['CBX_PROVIDER_ROLE'] = resolveCheckbox(assessment.clinicianTitle, ['MD', 'DO', 'NP', 'PA']);

    // Tier 3: Clinical data
    data['VITALS_BP'] = assessment.bpSystolic && assessment.bpDiastolic
      ? `${assessment.bpSystolic}/${assessment.bpDiastolic}` : '';
    data['VITALS_HR'] = assessment.heartRate || '';
    data['VITALS_RESP'] = assessment.respiratoryRate || '';
    data['VITALS_O2'] = assessment.o2Saturation || '';
    data['WEIGHT_CURRENT'] = assessment.weight || '';
    data['PAIN_SCORE'] = assessment.painLevel || '';
    data['PAIN_GOAL'] = assessment.painGoal || '';
    data['PPS_CURRENT'] = assessment.performanceScore || '';
    data['ADL_SCORE_CURRENT'] = assessment.adlScoreCurrent || '';
    data['SYMPTOM_NOTES'] = assessment.symptomNotes || '';
    data['EXAM_FINDINGS_NARRATIVE'] = assessment.examFindingsNarrative || '';
    data['HPI_NARRATIVE'] = assessment.narrativeNotes || '';
    data['CLINICAL_NARRATIVE'] = assessment.narrativeNotes || '';
    data['MED_CHANGE_DETAILS'] = assessment.planChanges || '';
    data['ORDERS_DME'] = assessment.interventions || '';

    // Checkbox fields (Tier 3)
    data['CBX_PAIN_RELIEF'] = resolveCheckbox(assessment.painManaged ? 'Yes' : 'No', ['Yes', 'No']);
    data['CBX_MED_CHANGES'] = resolveCheckbox(assessment.medicationsReviewed ? 'Reviewed' : 'No Changes', ['Reviewed', 'No Changes', 'New Orders']);
  }

  // CustomData overrides (for manual fields)
  if (customData) {
    for (const [key, value] of Object.entries(customData)) {
      if (key !== 'useGenericTemplate') {
        data[key] = value;
      }
    }
  }

  return data;
}

// Helper: format Firestore timestamp or ISO string to MM/DD/YYYY
function formatDate(val) {
  if (!val) return '';
  const d = val.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

// Helper: format phone to (555) 123-4567
function formatPhone(val) {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return val; // return as-is if non-standard
}

// Helper: resolve checkbox fields
// Returns string like "☑ Male ☐ Female ☐ Other"
function resolveCheckbox(selected, options) {
  return options.map(opt =>
    opt === selected ? `☑ ${opt}` : `☐ ${opt}`
  ).join('  ');
}
```

**C) Remove the old `initDocumentTemplates` / template config lookup:**

The old flow looked up a template config object from an in-memory template registry. Replace that with the Google Doc ID lookup from org settings.

**Acceptance criteria:**

* ✅ `generateDocument` reads template ID from `org.settings.documentTemplates[documentType]`
* ✅ Missing template returns clear error: "Template not configured for X. Go to Settings → Documents to configure."
* ✅ `prepareMergeData` returns a flat key-value object with all 68 variables
* ✅ All `CBX_` fields render as ☑/☐
* ✅ Generated PDF contains actual patient/assessment data — no `[No content provided]`
* ✅ No orphaned `{{PLACEHOLDER}}` text in generated documents
* ✅ Backward compatible: no `assessmentId` → Tier 2+3 fields are empty strings

---

### **Step 3.3 — Redesign Documents Page for Assessment-Based Flow**

✅ **Status:** Complete

**Problem:** The current `DocumentsPage.jsx` uses the old flow: select patient → pick template from library → generate. It needs to support the assessment-based flow while keeping a manual fallback.

**What to do:** Rewrite `src/components/DocumentsPage.jsx` with this new structure:

**Primary Tab: "Generate" (assessment-based flow)**

```
Step 1: Select Patient  (existing patient dropdown — keep)
Step 2: Select Assessment  (NEW — dropdown/list of completed assessments)
Step 3: Smart Document Selection  (NEW — auto-selects docs based on visit type)
Step 4: Generate  (batch generate with assessment data)
```

**Step 2 — Assessment Selector:**

After patient is selected, query `organizations/{orgId}/patients/{patientId}/visits` where `status == 'complete'`, ordered by `visitDate` desc.

Display as selectable cards or dropdown:

```
[03/04/2026 — Routine — Dr. Adams]
[02/15/2026 — Recertification — Dr. Adams]
[Create New Assessment →]  ← navigates to Home Visits page
```

Only `status: 'complete'` assessments are selectable.

**Step 3 — Smart Document Selection:**

When an assessment is selected, auto-check documents based on `visitType`:

| Visit Type | Auto-Selected Documents |
|---|---|
| **Admission** | HOME_VISIT_ASSESSMENT, 90DAY_INITIAL, PROGRESS_NOTE |
| **Recertification** | HOME_VISIT_ASSESSMENT, 60DAY (or 90DAY_SECOND based on benefit period), ATTEND_CERT (if attending physician exists), PROGRESS_NOTE |
| **Routine** | PROGRESS_NOTE, HOME_VISIT_ASSESSMENT |
| **F2F** | HOME_VISIT_ASSESSMENT, F2F_ENCOUNTER, PROGRESS_NOTE |
| **PRN** | PROGRESS_NOTE |

Display as: "Based on this visit, we'll generate:" with checkboxes for each document. User can add/remove.

**Step 4 — Generate:**

- "Generate All" button → batch calls `generateDocument` for each selected template, passing `patientId`, `documentType`, AND `assessmentId`
- Show progress per document
- Show download links when complete

**Secondary: Collapsible "Manual Generation" section:**

Keep a collapsible section labeled "Manual Generation (Advanced)" below. This works without selecting an assessment — useful for edge cases.

**All icons:** Use Lucide React (from Step 1.3). Zero emoji.

**Wire the Cloud Function call:**

```javascript
const handleGenerateSingle = async (templateId) => {
  const generateDocFn = httpsCallable(functions, 'generateDocument');
  const result = await generateDocFn({
    patientId: selectedPatient.id,
    documentType: templateId,
    assessmentId: selectedAssessment?.id || null,
    customData: {}
  });
  // ... handle result
};

const handleGenerateAll = async () => {
  const selectedDocs = getSmartSelectedDocs();
  for (const docType of selectedDocs) {
    await handleGenerateSingle(docType);
  }
};
```

**Acceptance criteria:**

* ✅ Primary flow: Patient → Assessment → Smart Selection → Generate works end-to-end
* ✅ Smart selection auto-checks correct documents per visit type
* ✅ User can override smart selection (add/remove documents)
* ✅ "Create New Assessment" link navigates to Home Visits page
* ✅ Manual generation fallback still works (no assessment required)
* ✅ Assessment-based generation passes `assessmentId` to Cloud Function
* ✅ Each generated document shows download link upon completion
* ✅ Error states display clearly if template is missing or generation fails
* ✅ All icons are Lucide React, zero emoji
* ✅ History tab still shows recent generated documents

---

### **✋ Phase 3 — Verification Checklist**

⬜ Documents page → select patient → select a completed assessment → smart selection shows correct docs  
⬜ Generate a document with assessment data → PDF contains actual patient info (not `[No content provided]`)  
⬜ Generate all documents for an Admission visit → 3 docs generated (Assessment, 90DAY, Progress Note)  
⬜ Generate all documents for a Routine visit → 2 docs generated (Progress Note, Assessment)  
⬜ Manual generation (no assessment) → still works, Tier 2+3 fields are blank in output  
⬜ Unconfigured template → clear error: "Template not configured... go to Settings → Documents"  
⬜ Download link works for generated PDF  
⬜ History tab shows newly generated documents  
⬜ No orphaned `{{PLACEHOLDER}}` text in any generated document  
⬜ All checkbox fields show ☑/☐ correctly  

---

## **Phase 4: Cleanup & Smoke Test**

**Goal:** Remove old PDFKit code and run end-to-end verification.  
**Estimated effort:** 2–4 hours  
**Dependencies:** Phase 3 complete

---

### **Step 4.1 — Remove PDFKit and Old Template Code**

✅ **Status:** Complete

**What to do:**

1. Remove `pdfkit` from `functions/package.json` dependencies
2. Delete `functions/lib/pdfGenerator.js` (the old PDFKit renderer)
3. Delete `functions/initDocumentTemplates.js` if it exists (old template config initializer)
4. Remove any imports of `pdfGenerator` or `pdfkit` from `generateDocument.js`
5. Remove the `useGenericTemplate` fallback logic from `documentService.js` (frontend) — this was a PDFKit-era workaround
6. Run `cd functions && npm install` to clean up `node_modules`

**Acceptance criteria:**

* ✅ `pdfkit` is not in `functions/package.json`
* ✅ `pdfGenerator.js` is deleted
* ✅ No references to PDFKit anywhere in the codebase
* ✅ `npm install` in functions/ completes without errors
* ✅ Document generation still works after cleanup

---

### **Step 4.2 — End-to-End Smoke Test**

✅ **Status:** Complete

**Full walkthrough:**

⬜ Create a patient with full demographics, diagnoses, and known hazards  
⬜ Open Home Visits → select patient → profile displays correctly with hazards and Maps link  
⬜ Start New Assessment → fill out form → Complete Assessment  
⬜ Navigate to Documents → select patient → select completed assessment  
⬜ Smart selection shows correct document set for the visit type  
⬜ Generate All → PDFs download with actual data populated  
⬜ Verify generated PDF: patient name, DOB, MRN, vitals, narratives all filled in  
⬜ Verify checkbox fields: ☑/☐ render correctly  
⬜ Verify no orphaned `{{VARIABLE}}` placeholders remain  
⬜ Settings → Documents → all template URLs saved and loading correctly  
⬜ Edit Patient → panel scrolls correctly, footer pinned  
⬜ Documents page → zero emoji, all Lucide icons  
⬜ Generate without assessment (manual mode) → works, clinical fields blank  

---

## **Files Modified/Created (Summary)**

| File | Change | Phase | Step |
|---|---|---|---|
| `functions/generateDocument.js` | Fix data pipeline, add `assessmentId`, switch to Google Docs API | 1, 3 | 1.1, 3.2 |
| `functions/lib/pdfGenerator.js` | Temporary fix in Phase 1, then **deleted** in Phase 4 | 1, 4 | 1.1, 4.1 |
| `functions/lib/googleDocsGenerator.js` | **NEW** — Google Docs copy/merge/export | 3 | 3.1 |
| `functions/package.json` | Add `googleapis`, remove `pdfkit` | 3, 4 | 3.1, 4.1 |
| `src/components/PatientModal.jsx` | Fix overflow CSS + add `knownHazards` field | 1, 2 | 1.2, 2.2 |
| `src/components/DocumentsPage.jsx` | Replace emoji → Lucide + full redesign for assessment flow | 1, 3 | 1.3, 3.3 |
| `src/components/SettingsPage.jsx` | Add "Documents" tab for template management | 2 | 2.1 |
| `src/components/HomeVisitsPage.jsx` | **NEW** — Assessment toolkit/dashboard wrapper | 2 | 2.2 |
| `src/components/HomeVisitAssessment.jsx` | Refactor to work as modal within HomeVisitsPage | 2 | 2.2 |
| `src/components/Sidebar.jsx` | Rename "Visits" → "Home Visits" | 2 | 2.2 |
| `src/App.jsx` | Route `'visits'` → `<HomeVisitsPage />` | 2 | 2.2 |
| `src/services/patientService.js` | Add `knownHazards` to schema | 2 | 2.2 |
| `src/services/documentService.js` | Remove `useGenericTemplate` fallback | 4 | 4.1 |

---

## **Google Docs API Setup Checklist (for Kobe)**

Before Phase 3 can be tested, these manual steps are required:

⬜ Enable Google Docs API in Google Cloud Console (`parrish-harmonyhca` project)  
⬜ Enable Google Drive API in Google Cloud Console  
⬜ Share each Google Doc template with the service account email: `1062012852590-compute@developer.gserviceaccount.com` (Editor access)  
⬜ Configure template URLs in Settings → Documents tab (after Phase 2 is deployed)  
⬜ Deploy updated Cloud Functions: `firebase deploy --only functions`