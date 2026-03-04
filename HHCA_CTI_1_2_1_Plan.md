---

# HHCA CTI 1.2.1 — Post-Review Implementation Plan

## How To Use This Plan

This document is the implementation guide for the Harmony 1.2.1 patch — a set of 6 tasks identified during Kobe's review of the 1.2.0 implementation. It follows the same workflow as the 1.2.0 plan: Claude Code reads each step, proposes changes, Kobe approves, then moves to the next.

**Workflow:**
1. Claude reads the current step
2. Claude proposes the code changes for that step
3. Kobe reviews and approves (or requests changes)
4. Once approved, Claude marks the step `✅` and moves to the next
5. At the end of each Phase, Claude runs the verification checklist before proceeding

**Approval Gates:** Each step marked with `⬜` requires explicit approval. Mark as `✅` when complete.

---

## Summary of Changes

These changes address 5 issues found during post-implementation review, organized into 3 phases by dependency order:

1. **PatientModal overflow** — Edit panel can't scroll, content clipped
2. **Documents page emoji cleanup** — Emojis used instead of Lucide icons
3. **Documents page logic overhaul** — Still uses old template-picker flow, needs assessment-based generation
4. **Settings page "Documents" tab** — Organizations need to configure their own Google Doc template links
5. **Home Visits page expansion** — Transform into a full assessment toolkit/dashboard with patient profile, previous assessments, and start-new-assessment flow
6. **Document generation fix** — Generated PDFs output blank `[No content provided]` instead of using actual templates and assessment data

---

## Known Bug: PDF Output

**Observed:** Generated Home Visit Assessment PDF shows `[No content provided]` for every section (Vital Signs, Functional Assessment, Symptom Assessment, Care Plan, Narrative Notes). See attached screenshot from MRN 23578 / John Test Smith.

**Root cause:** The `generateDocument` Cloud Function is not pulling data from an assessment record AND/OR the Google Doc template is not being used (the function may be generating a static placeholder PDF instead of copying+merging the template).

**Fix:** Task 6 (Phase 3) addresses this end-to-end.

---

## Phase 1: Quick Fixes (No Dependencies)

**Goal:** Resolve UI bugs that don't require architectural changes.
**Estimated effort:** 1-2 hours

---

### Step 1.1 — Fix PatientModal Overflow / Scroll

⬜ **Status:** Not started

**Problem:** The Edit Patient panel overflows the viewport. Users cannot scroll to see all 7 tabs' content. The footer may be clipped or unreachable.

**What to do:**
Edit `src/components/PatientModal.jsx` — fix the CSS for `.modal-container.wide` and `.modal-body`:

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
- ✅ Modal body scrolls independently of header/tabs/footer
- ✅ Footer is always visible (pinned to bottom)
- ✅ Tab bar stays accessible while scrolling
- ✅ No content is clipped at any viewport height ≥ 500px
- ✅ Works on mobile viewport (375px width)

---

### Step 1.2 — Replace Emoji with Lucide Icons on Documents Page

⬜ **Status:** Not started

**Problem:** `src/components/DocumentsPage.jsx` uses emoji characters (🕐, 📄, 📚, ⏳, ✅, ❌, etc.) for tab buttons, status indicators, and inline labels. All other pages in the app use Lucide React icons.

**What to do:**
Edit `src/components/DocumentsPage.jsx`:

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
|---------------|-------------|---------|
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
- ✅ Zero emoji characters in DocumentsPage.jsx
- ✅ All icons are Lucide React components
- ✅ Icon sizes are consistent (16px for inline, 18px for headers)
- ✅ Color coding matches the app's design tokens (green for success, red for error, amber for warning)
- ✅ Spinner animation works on `<Loader2>` with `className="spin"`

---

### ✋ Phase 1 — Verification Checklist

⬜ Open PatientModal in edit mode → body scrolls, footer pinned, tabs accessible
⬜ Open PatientModal on mobile viewport → same behavior
⬜ Navigate to Documents page → zero emoji visible
⬜ All Lucide icons render with correct colors and sizes
⬜ No console errors from either change

---

## Phase 2: Feature Additions (Independent of Document Generation)

**Goal:** Add the Settings "Documents" tab and expand Home Visits page. These can be built in parallel.
**Estimated effort:** 1-2 days
**Dependencies:** Phase 1 complete (clean foundation)

---

### Step 2.1 — Add "Documents" Tab to Settings Page

⬜ **Status:** Not started

**Problem:** Organizations need to configure their own Google Doc template links. Currently, template IDs are set via the `setupOrg.js` script or manually in the Firebase console. There's no UI for admins to manage this.

**What to do:**
Edit `src/components/SettingsPage.jsx`:

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

**B) Add state for document templates:**
Load from `organizations/{orgId}` field `settings.documentTemplates` (already exists in org schema per `organizationService.js` — `ORG_DEFAULTS.settings.documentTemplates`).

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
  { id: '60DAY',                 label: 'CTI 60-Day Narrative',           description: 'Used for 3rd+ benefit period recertifications' },
  { id: '90DAY_INITIAL',        label: 'CTI 90-Day Initial',             description: 'Used for 1st benefit period initial certification' },
  { id: '90DAY_SECOND',         label: 'CTI 90-Day Second',              description: 'Used for 2nd benefit period recertification' },
  { id: 'ATTEND_CERT',          label: 'Attending Physician CTI',        description: 'Attending physician certification statement' },
  { id: 'PROGRESS_NOTE',        label: 'Progress Note',                  description: 'Standard clinical progress note' },
  { id: 'F2F_ENCOUNTER',        label: 'Face-to-Face Encounter',         description: 'F2F encounter documentation' },
  { id: 'HOME_VISIT_ASSESSMENT', label: 'Physician Home Visit Assessment', description: 'Comprehensive home visit form' },
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
**Security:** Firestore rules already allow org admins to update org doc (confirmed in `firestore.rules`).

**Acceptance criteria:**
- ✅ "Documents" tab appears in Settings navigation between "Physicians" and "Notifications"
- ✅ Only admin/owner roles see the template inputs; others see an info message
- ✅ Each of the 7 document types has a labeled input row
- ✅ URL validation shows error state for non-Google-Docs URLs
- ✅ "Test Link" icon opens the URL in a new tab
- ✅ Save extracts the Google Doc ID from full URLs and stores to `settings.documentTemplates`
- ✅ Loading settings pre-fills existing template IDs (converts back to full URLs for display if needed)
- ✅ Empty inputs are valid (template not yet configured)

---

### Step 2.2 — Expand Home Visits Page to Assessment Toolkit

⬜ **Status:** Not started

**Problem:** The current Home Visits page (`src/components/HomeVisitAssessment.jsx`) is just the assessment form itself. It needs to become a full toolkit/dashboard with patient profile, previous assessments, and a "Start New Assessment" entry point.

**What to do:**

**A) Rename the page:**
1. In `src/components/Sidebar.jsx`: Change the navigation item label from "Visits" to "Home Visits"
2. In `src/App.jsx`: The case is already `'visits'` → `<HomeVisitAssessment />` — keep the routing key but update any display labels

**B) Create a new wrapper component** `src/components/HomeVisitsPage.jsx` that serves as the toolkit/dashboard. The existing `HomeVisitAssessment.jsx` becomes the form that opens as a modal/slide-panel from within this page.

**HomeVisitsPage.jsx structure:**

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
- **Known Hazards** field — this is a NEW field. Add `knownHazards` (string) to the patient schema. Examples: "aggressive dog," "stairs only," "oxygen in use". Display with a warning icon (AlertTriangle) if populated.
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
- ✅ Sidebar shows "Home Visits" (not "Visits")
- ✅ Page loads with patient selector at top
- ✅ Selecting a patient shows Quick-Access Profile with name, age, gender, language, hazards
- ✅ "Open in Maps" button opens Google Maps with the patient's address
- ✅ Known Hazards displays with warning icon when populated
- ✅ Previous Assessments table loads from `visits` subcollection
- ✅ "Start New Assessment" opens the assessment form as a modal/panel
- ✅ Completing an assessment refreshes the list and optionally navigates to Documents
- ✅ `knownHazards` field exists on patient schema, editable in PatientModal
- ✅ Empty state shown when no assessments exist for the patient

---

### ✋ Phase 2 — Verification Checklist

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

## Phase 3: Document Generation Pipeline Fix

**Goal:** Fix the end-to-end document generation flow so PDFs actually use Google Doc templates and populate with real data from assessments.
**Estimated effort:** 2-3 days
**Dependencies:** Phase 2 complete (Settings templates tab exists, Home Visits page creates assessments)

---

### Step 3.1 — Redesign Documents Page for Assessment-Based Flow

⬜ **Status:** Not started

**Problem:** The current `DocumentsPage.jsx` uses the old flow: select patient → pick template from library → generate. It needs to support the assessment-based flow from the 1.2.0 plan while keeping a manual fallback.

**What to do:**
Rewrite `src/components/DocumentsPage.jsx` with this new structure:

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
|------------|------------------------|
| **Admission** | HOME_VISIT_ASSESSMENT, 90DAY_INITIAL, PROGRESS_NOTE |
| **Recertification** | HOME_VISIT_ASSESSMENT, 60DAY (or 90DAY_SECOND based on period), ATTEND_CERT (if attending physician exists), PROGRESS_NOTE |
| **Routine** | PROGRESS_NOTE, HOME_VISIT_ASSESSMENT |
| **F2F** | HOME_VISIT_ASSESSMENT (with F2F attestation), F2F_ENCOUNTER, PROGRESS_NOTE |
| **PRN** | PROGRESS_NOTE |

Display as: "Based on this visit, we'll generate:" with checkboxes for each document. User can add/remove.

**Step 4 — Generate:**
- "Generate All" button → batch calls `generateDocument` for each selected template, passing `patientId`, `documentType`, AND `assessmentId`
- Show progress per document
- Show download links when complete

**Secondary: Collapsible "Manual Generation" section:**
Keep the existing template-picker flow below a collapsible section labeled "Manual Generation (Advanced)". This works without selecting an assessment — useful for edge cases.

**All icons:** Use Lucide React (from Step 1.2). Zero emoji.

**Acceptance criteria:**
- ✅ Primary flow: Patient → Assessment → Smart Selection → Generate works end-to-end
- ✅ Smart selection auto-checks correct documents per visit type
- ✅ User can override smart selection (add/remove documents)
- ✅ "Create New Assessment" link navigates to Home Visits page
- ✅ Manual generation fallback still works (no assessment required)
- ✅ All icons are Lucide React, zero emoji
- ✅ History tab still shows recent generated documents

---

### Step 3.2 — Fix `generateDocument` Cloud Function to Use Templates + Assessment Data

⬜ **Status:** Not started

**Problem:** The generated PDF output shows `[No content provided]` for every section. The Cloud Function is either not reading the Google Doc template or not replacing placeholders with actual data.

**What to do:**
Edit the `generateDocument` Cloud Function (in `functions/` directory):

**A) Accept `assessmentId` parameter:**
```javascript
// Current: { patientId, documentType, customData }
// New:     { patientId, documentType, assessmentId?, customData? }
```

**B) Load assessment data when `assessmentId` is provided:**
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

**C) Update `prepareMergeData` to accept assessment:**
```javascript
// Current: prepareMergeData(patient, org)
// New:     prepareMergeData(patient, assessment, org)
```

When `assessment` is null (manual mode), all Tier 2 + Tier 3 variables resolve to `''`.
When `assessment` is provided, map all variables per the 68-variable mapping from the 1.2.0 plan Step 3.4.

**D) Use actual Google Doc template:**
The function must:
1. Read the template ID from `org.settings.documentTemplates[documentType]`
2. Use the Google Docs API to copy the template: `drive.files.copy({ fileId: templateId })`
3. Use the Google Docs API to batch-replace all `{{VARIABLE}}` placeholders in the copy
4. Export the copy as PDF: `drive.files.export({ fileId: copyId, mimeType: 'application/pdf' })`
5. Upload the PDF to Firebase Storage
6. Return the download URL

If no template ID is configured for the requested document type, return an error: `"Template not configured for ${documentType}. Go to Settings → Documents to configure."`

**E) Checkbox handling:**
For all `CBX_` prefixed variables, use the checkbox handler from 1.2.0 Plan Step 1.6:
- `☑` (U+2611) for selected options
- `☐` (U+2610) for unselected options

**Key variable mappings (reference — full list in 1.2.0 Plan Step 3.4):**

**Tier 1 (from patient doc):**
- `{{PATIENT_NAME}}` → `patient.firstName + ' ' + patient.lastName`
- `{{DOB}}` → `patient.dateOfBirth` formatted as MM/DD/YYYY
- `{{MRN}}` → `patient.mrNumber`
- `{{ADMISSION_DATE}}` → `patient.admissionDate`
- `{{DIAGNOSIS_1}}` through `{{DIAGNOSIS_6}}` → `patient.diagnoses[n].name`
- (see 1.2.0 Plan Step 3.4 for complete Tier 1 mappings)

**Tier 2 (from assessment/visit doc):**
- `{{SELECT_DATE}}` → `assessment.visitDate`
- `{{TIME_IN}}` → `assessment.visitTime` or `assessment.timeIn`
- `{{PROVIDER_NAME}}` → `assessment.clinicianName`
- `{{CBX_VISIT_TYPE}}` → checkbox resolve on `assessment.visitType`
- (see 1.2.0 Plan Step 3.4 for complete Tier 2 mappings)

**Tier 3 (from assessment/visit doc):**
- `{{PAIN_SCORE}}` → `assessment.painLevel`
- `{{SYMPTOM_NOTES}}` → `assessment.symptomNotes`
- `{{HPI_NARRATIVE}}` → `assessment.narrativeNotes`
- (see 1.2.0 Plan Step 3.4 for complete Tier 3 mappings)

**Organization fields:**
- `{{HOSPICE_NAME}}` → `org.name` or `org.agencyName`
- `{{HOSPICE_NPI}}` → `org.npi`

**Acceptance criteria:**
- ✅ `generateDocument` accepts optional `assessmentId` parameter
- ✅ When `assessmentId` provided: loads assessment from `visits` subcollection, passes to `prepareMergeData`
- ✅ When `assessmentId` not provided: Tier 2+3 fields resolve to empty strings (backward compatible)
- ✅ Function reads template ID from `org.settings.documentTemplates[documentType]`
- ✅ Function copies Google Doc template, replaces all `{{VARIABLE}}` placeholders
- ✅ Function exports copy as PDF and uploads to Firebase Storage
- ✅ Generated PDF contains actual patient/assessment data — no `[No content provided]`
- ✅ All `CBX_` fields render as ☑/☐
- ✅ Missing template returns clear error message directing user to Settings → Documents
- ✅ No orphaned `{{PLACEHOLDER}}` text in generated documents

---

### Step 3.3 — Wire Documents Page to Pass `assessmentId` to Cloud Function

⬜ **Status:** Not started

**What to do:**
In the redesigned `DocumentsPage.jsx` from Step 3.1, when generating from a selected assessment:

```javascript
const handleGenerateSingle = async (templateId) => {
  const generateDocFn = httpsCallable(functions, 'generateDocument');
  const result = await generateDocFn({
    patientId: selectedPatient.id,
    documentType: templateId,
    assessmentId: selectedAssessment?.id || null,  // NEW — pass assessment ID
    customData: {}
  });
  // ... handle result
};
```

For "Generate All":
```javascript
const handleGenerateAll = async () => {
  const selectedDocs = getSmartSelectedDocs(); // from Step 3.1
  for (const docType of selectedDocs) {
    await handleGenerateSingle(docType);
  }
};
```

**Acceptance criteria:**
- ✅ Assessment-based generation passes `assessmentId` to Cloud Function
- ✅ Manual generation passes `null` for `assessmentId`
- ✅ Batch generation iterates all selected documents
- ✅ Each generated document shows download link upon completion
- ✅ Error states display clearly if template is missing or generation fails

---

### ✋ Phase 3 — Verification Checklist

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

### 🏁 End-to-End Smoke Test

⬜ Create a patient with full demographics, diagnoses, and known hazards
⬜ Open Home Visits → select patient → profile displays correctly with hazards and Maps link
⬜ Start New Assessment → fill out form → Complete Assessment
⬜ Navigate to Documents → select patient → select completed assessment
⬜ Smart selection shows correct document set for the visit type
⬜ Generate All → PDFs download with actual data populated
⬜ Settings → Documents → all template URLs saved and loading correctly
⬜ Edit Patient → panel scrolls correctly, footer pinned
⬜ Documents page → zero emoji, all Lucide icons

---

## Files Modified/Created (Summary)

| File | Change | Phase | Step |
|------|--------|-------|------|
| `src/components/PatientModal.jsx` | Fix overflow CSS + add `knownHazards` field | 1, 2 | 1.1, 2.2 |
| `src/components/DocumentsPage.jsx` | Replace emoji → Lucide + full redesign for assessment flow | 1, 3 | 1.2, 3.1, 3.3 |
| `src/components/SettingsPage.jsx` | Add "Documents" tab for template management | 2 | 2.1 |
| `src/components/HomeVisitsPage.jsx` | **NEW** — Assessment toolkit/dashboard wrapper | 2 | 2.2 |
| `src/components/HomeVisitAssessment.jsx` | Refactor to work as modal within HomeVisitsPage | 2 | 2.2 |
| `src/components/Sidebar.jsx` | Rename "Visits" → "Home Visits" | 2 | 2.2 |
| `src/App.jsx` | Route `'visits'` → `<HomeVisitsPage />` | 2 | 2.2 |
| `src/services/patientService.js` | Add `knownHazards` to schema | 2 | 2.2 |
| `functions/generateDocument.js` | Accept `assessmentId`, use real templates, expand `prepareMergeData` | 3 | 3.2 |

---