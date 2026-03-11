# HHCA CTI 1.2.0 — Implementation Plan

## How To Use This Plan

This document is the single source of truth for the Harmony 1.2.0 expansion. It is structured so that an AI assistant (Claude) can follow it step-by-step, presenting each step to the developer (Kobe) for approval before proceeding.

**Workflow:**
1. Claude reads the current step
2. Claude proposes the code changes or new files for that step
3. Kobe reviews and approves (or requests changes)
4. Once approved, Claude marks the step complete and moves to the next
5. At the end of each Phase, Claude runs a verification checklist before proceeding

**Approval Gates:** Each step marked with `⬜` requires explicit approval. Mark as `✅` when complete.

---

## Summary of Changes from Original Plan

This plan replaces the original `Harmony_Expansion_Plan.md`. Key architectural shifts based on reconciliation with the `.xlsx` implementation plan:

1. **Visit-centric data model** — Clinical data lives on dated `assessments` subcollection records, not crammed into the patient document
2. **Three-tier data architecture** — Patient demographics (stored on patient), encounter setup (stored on assessment), per-visit clinical data (stored on assessment)
3. **68 standardized autofill variables** — Replacing the original claim of 107; properly categorized by where data lives
4. **Checkbox Logic Handler + Format Adapters** — Added to Phase 1 as foundational utilities for document generation
5. **Two clinical workflows** — Digital form (Workflow A) AND hybrid paper/scan (Workflow B) for doctor adoption
6. **Assessment-based document generation** — Documents tied to a specific dated visit, not a patient snapshot
7. **API integrations moved earlier** — RxNav and ICD-10 promoted to Phase 2 alongside UI work
8. **Template cleanup step** — Explicit removal of deprecated templates added to Phase 4

---

## Data Architecture: Three-Tier Model

All 68 standardized autofill variables map to one of three tiers:

### Tier 1: Patient Demographics (~25 variables)
**Stored on:** `patients/{patientId}`
**Updated:** When patient info changes (intake, corrections, transfers)
**Variables:** `{{PATIENT_NAME}}`, `{{DOB}}`, `{{MRN}}`, `{{MBI}}`, `{{MPI}}`, `{{CBX_GENDER}}`, `{{PATIENT_ADDRESS}}`, `{{PATIENT_PHONE}}`, `{{ADMISSION_DATE}}`, `{{ELECTION_DATE}}`, `{{CDATE_START}}`, `{{CDATE_END}}`, `{{BENEFIT_PERIOD_NUM}}`, `{{CBX_BENEFIT_PERIOD}}`, `{{CBX_F2F_STATUS}}`, `{{F2F_DATE}}`, `{{F2F_PROVIDER_NAME}}`, `{{F2F_PROVIDER_NPI}}`, `{{CBX_F2F_ROLE}}`, `{{DIAGNOSIS_1}}` through `{{DIAGNOSIS_6}}`, `{{DX_DATE_1}}` through `{{DX_DATE_6}}`, `{{CBX_DX_RELATED}}`, `{{CBX_DX_UNRELATED}}`, `{{ATTENDING_PHYSICIAN_NAME}}`, `{{ATTENDING_PHYSICIAN_NPI}}`, `{{ATTENDING_PHYSICIAN_PHONE}}`, `{{PATIENT_LOCATION}}`

### Tier 2: Visit/Encounter Setup (~15 variables)
**Stored on:** `patients/{patientId}/assessments/{assessmentId}`
**Updated:** Once per visit when the encounter form is started
**Variables:** `{{SELECT_DATE}}`, `{{TIME_IN}}`, `{{TIME_OUT}}`, `{{CBX_VISIT_TYPE}}`, `{{CBX_VISIT_PURPOSE}}`, `{{PROVIDER_NAME}}`, `{{PROVIDER_NPI}}`, `{{CBX_PROVIDER_ROLE}}`, `{{CBX_CERT_TYPE}}`

### Tier 3: Per-Visit Clinical Data (~28 variables)
**Stored on:** `patients/{patientId}/assessments/{assessmentId}`
**Updated:** During the clinical encounter by the physician
**Variables:**

| Category | Variables |
|----------|-----------|
| **Clinical Narratives** | `{{HPI_NARRATIVE}}`, `{{COMORBIDITY_NARRATIVE}}`, `{{CLINICAL_NARRATIVE}}` |
| **Vitals** | `{{VITALS_BP}}`, `{{VITALS_HR}}`, `{{VITALS_RESP}}`, `{{VITALS_O2}}`, `{{CBX_O2_TYPE}}`, `{{WEIGHT_CURRENT}}`, `{{WEIGHT_PRIOR}}` |
| **Functional Status** | `{{PPS_CURRENT}}`, `{{PPS_PRIOR}}`, `{{FAST_CURRENT}}`, `{{ADL_SCORE_CURRENT}}`, `{{CBX_ADL_DEPENDENT}}`, `{{CBX_AMBULATION}}`, `{{CBX_INTAKE}}` |
| **Symptoms (ESAS)** | `{{PAIN_SCORE}}`, `{{PAIN_GOAL}}`, `{{CBX_PAIN_RELIEF}}`, `{{CBX_SYMPTOM_SEVERITY}}`, `{{SYMPTOM_NOTES}}` |
| **Physical Exam** | `{{CBX_EXAM_WNL}}`, `{{CBX_EXAM_ABN}}`, `{{EXAM_FINDINGS_NARRATIVE}}`, `{{PHQ2_SCORE}}` |
| **LCD & Eligibility** | `{{CBX_LCD_CRITERIA}}` |
| **Plan of Care** | `{{CBX_MED_CHANGES}}`, `{{MED_CHANGE_DETAILS}}`, `{{ORDERS_DME}}`, `{{CBX_LOC}}`, `{{CBX_REFERRALS}}`, `{{CBX_DISCUSSED_WITH}}` |

---

## Firestore Structure (Target)

```
organizations/
  {orgId}/
    name, npi, phone, fax, address
    physicians/            ← Phase 4 (Physician Directory)
      {physicianId}/

users/
  {uid}/
    email, displayName, role, organizationId

patients/
  {patientId}/
    // Tier 1: Patient Demographics
    firstName, lastName, name, mrn, dob, mbi, medicaidNumber,
    admissionNumber, ssn, gender, race, ethnicity, maritalStatus,
    primaryLanguage, religion, isDnr, codeStatus, dpoaName,
    livingWillOnFile, polstOnFile, nkda, nfka, otherNotes,
    admissionDate, startOfCare, electionDate, levelOfCare,
    disasterCode, address, locationName, locationType,
    institutionName, patientPhone, organizationId, status,

    // Nested objects
    attendingPhysician: { name, npi, address, phone, fax, email }
    hospicePhysician: { name, npi }
    primaryContact: { name, relationship, phone, address }
    primaryCaregiver: { name, relationship, address, mobile, email }
    secondaryCaregiver: { name, relationship, address, mobile }
    pharmacy: { name, address, phone, fax }
    funeralHome: { name, address, phone }
    referral: { source }

    // Arrays
    diagnoses: [{ name, icd10, relationship, onsetDate }]  // idx 0 = Terminal, up to 6
    medications: [{ name, dose, route, frequency, indication }]
    allergies: [{ allergen, reactionType, severity }]

    // Benefit period tracking (existing — do not modify)
    startingBenefitPeriod, isReadmission, priorHospiceDays,
    f2fRequired, f2fCompleted, f2fPhysician, f2fProviderRole,
    f2fProviderNpi, f2fDate, currentBenefitPeriod,
    certStartDate, certEndDate, ...

    // Subcollection
    assessments/
      {assessmentId}/
        // Tier 2: Encounter Setup
        visitDate, timeIn, timeOut, providerName, providerNpi,
        providerRole, visitType, visitPurpose[], certType,

        // Tier 3: Clinical Data
        hpiNarrative, comorbidityNarrative, clinicalNarrative,
        vitalsBp, vitalsHr, vitalsResp, vitalsO2, o2Type,
        weightCurrent, weightPrior,
        ppsCurrent, ppsPrior, fastCurrent, adlScoreCurrent,
        adlDependent: {}, ambulationStatus, intakeStatus,
        painScore, painGoal, painRelief, symptomSeverity: {},
        symptomNotes,
        examWnl: {}, examAbn: {}, examFindingsNarrative,
        phq2Score,
        lcdCriteria: {},
        medChanges: {}, medChangeDetails, ordersDme,
        locChange, referrals: {}, discussedWith: {},

        // Metadata
        patientId, organizationId, createdBy, createdAt,
        updatedAt, status  // draft | complete | paper
```

---

## Phase 1: Data Foundation

**Goal:** Build the database layer everything depends on. No UI changes yet.
**Estimated effort:** Week 1-2
**Dependencies:** None — this is the starting point.

---

### Step 1.1 — Expand Patient Schema in `patientService.js`

⬜ **Status:** Not started

**What to do:**
- Update `createPatientSchema()` to include all Tier 1 fields with safe defaults
- Add all nested objects (attendingPhysician, hospicePhysician, primaryContact, primaryCaregiver, secondaryCaregiver, pharmacy, funeralHome, referral) with empty string defaults for every sub-field
- Add arrays (diagnoses, medications, allergies) defaulting to `[]`
- Add `patientPhone` as a new flat field
- Do NOT remove or rename any existing fields — this must be backward compatible

**Fields to add (flat):** firstName, lastName, mbi, medicaidNumber, admissionNumber, ssn, gender, race, ethnicity, maritalStatus, primaryLanguage, religion, isDnr, codeStatus, dpoaName, livingWillOnFile, polstOnFile, nkda, nfka, otherNotes, electionDate, levelOfCare, disasterCode, address, locationName, locationType, institutionName, patientPhone

**Nested objects to add:**
- `attendingPhysician: { name: '', npi: '', address: '', phone: '', fax: '', email: '' }`
- `hospicePhysician: { name: '', npi: '' }`
- `primaryContact: { name: '', relationship: '', phone: '', address: '' }`
- `primaryCaregiver: { name: '', relationship: '', address: '', mobile: '', email: '' }`
- `secondaryCaregiver: { name: '', relationship: '', address: '', mobile: '' }`
- `pharmacy: { name: '', address: '', phone: '', fax: '' }`
- `funeralHome: { name: '', address: '', phone: '' }`
- `referral: { source: '' }`

**Arrays to add:**
- `diagnoses: []` — each entry: `{ name: '', icd10: '', relationship: 'Terminal', onsetDate: '' }`
- `medications: []` — each entry: `{ name: '', dose: '', route: '', frequency: '', indication: '' }`
- `allergies: []` — each entry: `{ allergen: '', reactionType: '', severity: '' }`

**Acceptance criteria:**
- `createPatientSchema()` returns a complete object with all Tier 1 fields
- All nested objects have every sub-field initialized to `''`
- Arrays default to empty `[]`
- No existing fields are removed or renamed
- SSN field included but commented: `// DEFERRED: requires encryption before production use`

---

### Step 1.2 — Expand `docToPatient` Converter

⬜ **Status:** Not started

**What to do:**
- Update the Firestore document → JS object converter to handle all new nested paths
- Use null-safe access for every nested field: `data.attendingPhysician?.name || ''`
- Handle arrays with fallback to `[]`
- Ensure backward compatibility: old patient documents with missing fields get safe defaults

**Pattern to follow for each nested object:**
```javascript
attendingPhysician: {
  name: data.attendingPhysician?.name || '',
  npi: data.attendingPhysician?.npi || '',
  address: data.attendingPhysician?.address || '',
  phone: data.attendingPhysician?.phone || '',
  fax: data.attendingPhysician?.fax || '',
  email: data.attendingPhysician?.email || '',
}
```

**Acceptance criteria:**
- Converter handles a patient doc with ALL new fields populated
- Converter handles a legacy patient doc with NONE of the new fields (no crashes, no `undefined` values)
- Every nested object resolves to its full shape even if only partially stored in Firestore

---

### Step 1.3 — Update `addPatient` and `updatePatient`

⬜ **Status:** Not started

**What to do:**
- `addPatient`: Accept all new fields, validate required fields, auto-set defaults for any omitted nested objects/arrays
- `updatePatient`: Handle partial updates using Firestore merge strategy for nested objects (updating `attendingPhysician.npi` must NOT wipe `attendingPhysician.name`). Array fields use full replacement for v1 (replace entire `diagnoses[]` array on save).

**Important:** Use Firestore dot-notation for nested field updates to avoid overwriting sibling fields:
```javascript
// CORRECT — updates only npi
updateDoc(ref, { 'attendingPhysician.npi': '1234567890' })

// WRONG — overwrites entire attendingPhysician object
updateDoc(ref, { attendingPhysician: { npi: '1234567890' } })
```

**Acceptance criteria:**
- Adding a patient with only basic fields (name, MRN, DOB) succeeds — all other fields are defaulted
- Updating `attendingPhysician.npi` does NOT wipe out `attendingPhysician.name`
- Updating `diagnoses` replaces the full array
- Validation rejects missing required fields (name, mrn, dob, organizationId)

---

### Step 1.4 — Migration Script: `functions/migratePatients.js`

⬜ **Status:** Not started

**What to do:**
Create a one-time callable Cloud Function that:
1. Queries all patients in the organization
2. For each patient, checks if `attendingPhysician` is a string — if so, converts to object: `"Dr. Smith"` → `{ name: "Dr. Smith", npi: "", address: "", phone: "", fax: "", email: "" }`
3. Adds safe default values for every new field that doesn't yet exist on the document
4. Uses batched writes (max 500 per Firestore batch)
5. Logs: patients scanned, patients migrated, errors encountered

**Edge cases to handle:**
- `attendingPhysician` is `null` or `undefined` → create empty object
- `attendingPhysician` is already an object → skip conversion
- `attendingPhysician` is an empty string → create empty object
- Patient already has all new fields → skip (no unnecessary writes)

**Acceptance criteria:**
- Script is idempotent (safe to run multiple times without side effects)
- Existing data is never overwritten — only missing fields are added
- Console output summarizes results
- Script can be triggered via `firebase functions:call migratePatients`

---

### Step 1.5 — Create Assessment Schema and Service

⬜ **Status:** Not started

**What to do:**
Create new file `src/services/assessmentService.js` with:

**Schema function:**
- `createAssessmentSchema()` — returns the full default object for Tier 2 + Tier 3 fields (all strings default to `''`, all numbers to `0` or `null`, all objects to `{}`, all arrays to `[]`)

**CRUD functions:**
- `addAssessment(patientId, data)` — creates a new doc in `patients/{patientId}/assessments/` with auto-generated ID. Auto-sets: `organizationId` (from user claims), `createdBy` (current user UID), `createdAt` (server timestamp), `updatedAt` (server timestamp), `status: 'draft'`
- `updateAssessment(patientId, assessmentId, data)` — partial update with merge. Auto-updates `updatedAt`.
- `getAssessment(patientId, assessmentId)` — single document fetch. Returns null if not found.
- `getAssessments(patientId, options)` — list assessments for a patient. Options: `{ status, limit, orderBy }`. Default: ordered by `visitDate` desc, excludes `status: 'deleted'`.
- `deleteAssessment(patientId, assessmentId)` — soft delete: sets `status: 'deleted'`, `updatedAt: serverTimestamp()`
- `completeAssessment(patientId, assessmentId)` — sets `status: 'complete'`, validates required fields before completing

**Required fields for completion:** visitDate, providerName, visitType

**Acceptance criteria:**
- Full CRUD operations work against the assessments subcollection
- `createAssessmentSchema()` returns all Tier 2 + Tier 3 fields with safe defaults
- `organizationId` is automatically set and enforced
- Timestamps are auto-managed
- `completeAssessment` rejects if required fields are missing
- `getAssessments` filters out deleted records by default

---

### Step 1.6 — Checkbox Logic Handler Utility

⬜ **Status:** Not started

**What to do:**
Create new file `functions/utils/checkboxHandler.js` with:

**Core function:** `resolveCheckbox(value, matchValue)`
- If `matchValue` is omitted: treats `value` as boolean → `true` = ☑, `false` = ☐
- If `matchValue` is provided: `value === matchValue` → ☑, else ☐
- If `value` is an array and `matchValue` is provided: `value.includes(matchValue)` → ☑, else ☐

**Batch function:** `resolveAllCheckboxes(data, fieldDefinitions)`
- Takes raw assessment/patient data and a map of checkbox field definitions
- Returns a flat object: `{ 'CBX_GENDER_MALE': '☑', 'CBX_GENDER_FEMALE': '☐', ... }`
- Processes all `CBX_` prefixed fields in one pass

**Fields this must handle (from autofill sheet — 23 checkbox variables):**
`CBX_GENDER`, `CBX_VISIT_TYPE`, `CBX_VISIT_PURPOSE`, `CBX_PROVIDER_ROLE`, `CBX_BENEFIT_PERIOD`, `CBX_CERT_TYPE`, `CBX_F2F_STATUS`, `CBX_F2F_ROLE`, `CBX_DX_RELATED`, `CBX_DX_UNRELATED`, `CBX_O2_TYPE`, `CBX_ADL_DEPENDENT`, `CBX_AMBULATION`, `CBX_INTAKE`, `CBX_PAIN_RELIEF`, `CBX_SYMPTOM_SEVERITY`, `CBX_EXAM_WNL`, `CBX_EXAM_ABN`, `CBX_LCD_CRITERIA`, `CBX_MED_CHANGES`, `CBX_LOC`, `CBX_REFERRALS`, `CBX_DISCUSSED_WITH`

**Acceptance criteria:**
- Boolean mode: `resolveCheckbox(true)` → `'☑'`, `resolveCheckbox(false)` → `'☐'`
- String match mode: `resolveCheckbox('Male', 'Male')` → `'☑'`, `resolveCheckbox('Male', 'Female')` → `'☐'`
- Array mode: `resolveCheckbox(['Chaplain', 'SW'], 'Chaplain')` → `'☑'`
- Null/undefined inputs → `'☐'` (never throws)
- `resolveAllCheckboxes` processes all 23 CBX fields

---

### Step 1.7 — Format Adapters Utility

⬜ **Status:** Not started

**What to do:**
Create new file `functions/utils/formatAdapters.js` with:

**Date formatting:** `formatDate(value, format)`
- Accepts: Firestore Timestamp, JS Date, ISO string, or `null`
- Formats:
  - `'MM/DD/YYYY'` → `02/25/2026`
  - `'MONTH DD, YYYY'` → `February 25, 2026`
  - `'YYYY-MM-DD'` → `2026-02-25`
- Returns `''` for null/undefined/invalid input

**Name formatting:** `formatName(first, last, format)`
- `'FULL'` → `John Smith`
- `'LAST_FIRST'` → `Smith, John`
- Returns whatever is available if one part is missing

**NPI formatting:** `formatNpi(value)`
- Validates 10-digit numeric string
- Returns formatted value or `''` if invalid

**Phone formatting:** `formatPhone(value)`
- Normalizes to `(555) 123-4567`
- Handles: 10-digit, 11-digit (strips leading 1), already-formatted, dashes, spaces
- Returns `''` for null/undefined

**Batch function:** `resolveAllFormats(rawData, fieldFormatMap)`
- Takes raw data and a map of `{ fieldName: { formatter, format } }`
- Returns a flat object with all fields formatted

**Acceptance criteria:**
- `formatDate` handles Firestore Timestamps, JS Dates, and ISO strings
- `formatPhone` normalizes all common formats to `(555) 123-4567`
- `formatNpi` rejects non-10-digit values gracefully (returns `''`)
- ALL formatters return `''` for null/undefined input (never throw)
- `resolveAllFormats` processes a full data payload

---

### Step 1.8 — Expand Organization Schema

⬜ **Status:** Not started

**What to do:**
- Add fields to `organizations/{orgId}` document: `npi` (string), `phone` (string), `fax` (string), `address` (object: `{ street, city, state, zip }`)
- These fields feed document headers: `{{HOSPICE_NAME}}` → `org.name`, `{{HOSPICE_NPI}}` → `org.npi`
- Create or update a service function `getOrganization(orgId)` that returns the org doc with safe defaults for all new fields
- No UI changes yet — Settings page update is in Phase 2

**Acceptance criteria:**
- Org document schema includes all new fields
- Existing org documents still load correctly (new fields default to `''` or `{}`)
- `getOrganization()` returns a complete org object with no `undefined` values

---

### Step 1.9 — Update Firestore Security Rules

⬜ **Status:** Not started

**What to do:**
Add rules for:

1. **New patient fields** — enum validation for: `gender` (Male/Female/Other/Unknown), `codeStatus` (Full Code/DNR/DNR-CC/Comfort Measures), `locationType` (Home/SNF/ALF/IPU/Hospital/Other), `levelOfCare` (Routine/Continuous/Respite/GIP), `referral.source` (free text, no enum needed)

2. **NPI validation** — any field ending in `npi` or `Npi` must be either empty string or exactly 10 numeric digits

3. **Assessments subcollection** — new rules:
   - Read: user must be authenticated AND `resource.data.organizationId == request.auth.token.orgId`
   - Create: user must be authenticated AND role is `clinician` or `admin` AND `request.resource.data.organizationId == request.auth.token.orgId`
   - Update: same org check, user must own the assessment OR be admin
   - Delete: blocked (soft delete only via status field)

4. **Organization fields** — only `admin` role can update org-level fields

**Acceptance criteria:**
- Invalid enum values are rejected at write time
- Invalid NPI format is rejected
- Assessment reads/writes are org-isolated
- Direct delete on assessments is blocked
- All existing patient/user rules still work unchanged
- Test: a user from org_A cannot read assessments from org_B

---

### ✋ Phase 1 — Verification Checklist (Do Before Moving to Phase 2)

⬜ Run migration script against test data — all legacy patients updated without errors
⬜ Create a new patient with all fields — verify Firestore document matches schema
⬜ Create a new patient with ONLY basic fields — verify defaults fill correctly
⬜ Load a legacy patient — verify `docToPatient` handles missing fields
⬜ Create an assessment under a patient — verify subcollection document structure
⬜ Update a nested object field (e.g., `attendingPhysician.npi`) — verify merge behavior (no data loss on sibling fields)
⬜ Run `resolveCheckbox` against boolean, string, and array inputs — verify ☑/☐ output
⬜ Run `formatDate` with Timestamp, Date, ISO string, and null — verify output
⬜ Attempt to create an assessment with wrong `organizationId` — verify security rules block it
⬜ Attempt to delete an assessment directly — verify Firestore rules block it

---

## Phase 2: UI + API Integrations

**Goal:** Build the patient-facing UI for demographics and integrate external APIs for clinical data entry quality.
**Estimated effort:** Week 2-3
**Dependencies:** Phase 1 must be complete (schema, services, and utilities exist).

---

### Step 2.1 — Sidebar Navigation Component

⬜ **Status:** Not started

**What to do:**
Create `src/components/Sidebar.jsx`:
- Collapsible sidebar with navigation items: Dashboard, Patients, Certifications, Documents, HUV, Settings
- Active state indicator (highlight current page)
- Role-based visibility (e.g., Settings only for admins)
- Mobile: hamburger toggle, slides over content
- Desktop: persistent sidebar, content shifts right
- Update `App.jsx` to use sidebar layout wrapper

**Acceptance criteria:**
- All nav items route correctly
- Active page is visually highlighted
- Collapses on mobile, persists on desktop
- Role-based items hidden for unauthorized roles
- Smooth open/close animation

---

### Step 2.2 — Restructure PatientModal to 7 Tabs

⬜ **Status:** Not started

**What to do:**
Replace the current 3-tab PatientModal with 7 tabs scoped to **stored patient data only** (Tier 1). Per-visit clinical data does NOT go here — that's the assessment form in Phase 3.

| Tab # | Tab Name | Fields |
|-------|----------|--------|
| 1 | **Demographics** | firstName, lastName, DOB, SSN*, gender, race, ethnicity, primaryLanguage, religion, maritalStatus, patientPhone |
| 2 | **Admission & Clinical** | admissionDate, startOfCare, electionDate, levelOfCare, disasterCode, startingBenefitPeriod, isReadmission, priorHospiceDays, codeStatus, isDnr, dpoaName, livingWillOnFile, polstOnFile |
| 3 | **Diagnoses** | DiagnosisManager component (Step 2.3) |
| 4 | **Contacts & Caregivers** | primaryContact {name, relationship, phone, address}, primaryCaregiver {name, relationship, address, mobile, email}, secondaryCaregiver {name, relationship, address, mobile} |
| 5 | **Physicians & F2F** | attendingPhysician {name, npi, address, phone, fax, email}, hospicePhysician {name, npi}, F2F tracking fields |
| 6 | **Services** | pharmacy {name, address, phone, fax}, funeralHome {name, address, phone}, referral {source} |
| 7 | **Medications & Allergies** | MedicationManager (Step 2.4), AllergyManager (Step 2.5) |

*SSN: masked input field, storage deferred

**Modal behavior:**
- Desktop: expand to drawer/side-panel (max-width ~800px)
- Tab switching preserves unsaved data in local React state
- "Save" persists all tabs in one `updatePatient` call
- Validation errors highlight the tab containing the error
- "Add Patient" mode: all tabs available, save calls `addPatient`
- "Edit Patient" mode: pre-fills from existing data via `docToPatient`

**Acceptance criteria:**
- All 7 tabs render correctly with proper fields
- Switching tabs does NOT lose unsaved data
- Saving writes to Firestore correctly for both add and edit modes
- Legacy patients load with defaults for missing fields
- Validation prevents saving with required fields empty
- Modal is usable on mobile (scrollable, tabs accessible)

---

### Step 2.3 — DiagnosisManager Sub-Component

⬜ **Status:** Not started

**What to do:**
Create `src/components/DiagnosisManager.jsx`:
- Renders inside PatientModal Tab 3
- Dynamic list of up to 6 diagnosis rows
- Each row: diagnosis name (text), ICD-10 code (text with format hint `A00.0`), relationship (dropdown: Terminal / Related / Unrelated), onset date (date picker)
- Row 0: relationship is locked to "Terminal" and cannot be changed
- Add row button (blocked after 6 rows, show message)
- Remove row button (row 0 cannot be removed)
- Reorder with up/down arrows (row 0 stays at top)
- Receives `value` (array) and `onChange` (callback) as props

**Acceptance criteria:**
- First diagnosis is always "Terminal" relationship
- Max 6 diagnoses enforced with user feedback
- First row cannot be deleted
- Empty rows are stripped before passing to parent on change
- ICD-10 field accepts free text (autocomplete comes in Step 2.7)

---

### Step 2.4 — MedicationManager Sub-Component

⬜ **Status:** Not started

**What to do:**
Create `src/components/MedicationManager.jsx`:
- Renders inside PatientModal Tab 7
- Dynamic table rows: name (text), dose (text), route (dropdown), frequency (text), indication (text)
- Route dropdown: PO, IV, SQ, IM, Topical, Inhaled, SL, PR, Other
- Add/remove rows
- Receives `value` (array) and `onChange` (callback) as props
- Medication name is free text for now (RxNav autocomplete in Step 2.6)

**Acceptance criteria:**
- Rows add and remove dynamically
- Route dropdown works correctly
- Empty rows stripped before onChange
- Integrates with PatientModal save flow via props

---

### Step 2.5 — AllergyManager Sub-Component

⬜ **Status:** Not started

**What to do:**
Create `src/components/AllergyManager.jsx`:
- Renders inside PatientModal Tab 7, below MedicationManager
- NKDA checkbox ("No Known Drug Allergies") — checking disables and hides allergy rows, sets `nkda: true`
- NFKA checkbox ("No Known Food Allergies") — sets `nfka: true`, independent of NKDA
- When NKDA is unchecked: dynamic allergy rows with allergen (text), reactionType (text), severity (dropdown: Mild / Moderate / Severe)
- Add/remove allergy rows
- Receives `value` (object: `{ nkda, nfka, list }`) and `onChange` as props

**Acceptance criteria:**
- NKDA toggle hides/shows allergy list
- Unchecking NKDA restores previously entered allergies (kept in local state)
- Both NKDA and NFKA toggle independently
- Integrates with PatientModal save flow

---

### Step 2.6 — RxNav API Integration (Medications)

⬜ **Status:** Not started

**What to do:**
Add autocomplete to MedicationManager's medication name field:
- API: `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms={query}&ef=DISPLAY_NAME`
- Debounce: 300ms after user stops typing
- Trigger: after 3+ characters entered
- Display: dropdown list of matching medication names
- Select: populates the name field
- Fallback: if API returns error or times out (2s), silently fall back to free text

**Acceptance criteria:**
- Typing 3+ characters shows autocomplete dropdown
- Results appear within ~500ms
- Selecting a result fills the medication name
- API failure is invisible to user (no error message, just no autocomplete)
- Works correctly when adding multiple medications

---

### Step 2.7 — ICD-10 API Integration (Diagnoses)

⬜ **Status:** Not started

**What to do:**
Add autocomplete to DiagnosisManager's ICD-10 field:
- API: `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms={query}`
- Debounce: 300ms
- Trigger: 2+ characters in either the ICD-10 field OR the diagnosis name field
- Display: dropdown showing `code — description` (e.g., `C34.1 — Malignant neoplasm of upper lobe, bronchus or lung`)
- Select: auto-fills BOTH the `icd10` and `name` fields from the selected result
- Fallback: free text if API unavailable

**Acceptance criteria:**
- Searching by code ("C34") or description ("lung cancer") both work
- Selecting a result fills both diagnosis name and ICD-10 code
- API failure falls back to free text silently
- Works for all 6 diagnosis rows independently

---

### Step 2.8 — Settings Page Expansion

⬜ **Status:** Not started

**What to do:**
- Add organization info section to existing Settings page
- Fields: Organization NPI, Phone, Fax, Address (street, city, state, zip)
- Admin-only visibility (check user role)
- Save updates to `organizations/{orgId}` document
- NPI: validate 10-digit numeric on blur
- Phone/fax: auto-format to `(555) 123-4567` on blur

**Acceptance criteria:**
- Org fields display current values from Firestore
- Edits save correctly
- NPI validation prevents invalid values
- Phone/fax auto-format on blur
- Non-admin users see no organization section

---

### ✋ Phase 2 — Verification Checklist (Do Before Moving to Phase 3)

⬜ Sidebar: navigate to every page, verify routing and active states
⬜ Create a new patient using 7-tab modal — all 7 tabs save correctly
⬜ Edit an existing legacy patient — no crashes, defaults applied for missing fields
⬜ Add 6 diagnoses with ICD-10 autocomplete — verify array saves correctly
⬜ Try to add 7th diagnosis — verify it's blocked
⬜ Add 3 medications with RxNav autocomplete — verify array saves correctly
⬜ Check NKDA on, then off — verify allergy list toggles correctly
⬜ Update org NPI in Settings — verify Firestore doc updates
⬜ Check Settings as non-admin user — verify org section is hidden
⬜ Test entire flow on mobile viewport — sidebar collapses, modal scrolls

---

## Phase 3: Assessment Workflow & Document Generation

**Goal:** Build the clinical assessment form, both digital and hybrid workflows, and rewire document generation to pull from specific assessment records.
**Estimated effort:** Week 3-4
**Dependencies:** Phase 1 (assessment service) and Phase 2 (patient modal) must be complete.

---

### Step 3.1 — Digital Assessment Form (Workflow A)

⬜ **Status:** Not started

**What to do:**
Create new route `/home-visit` → `src/components/HomeVisitAssessment.jsx`

This is the primary clinical data entry form. It captures all Tier 2 + Tier 3 data for a single patient visit.

**Form layout (sections in order):**

**Section 1 — Patient Selection:**
- Reuse existing patient search/select component
- On selection, display header bar: patient name, MRN, DOB, current benefit period, F2F status, admission date

**Section 2 — Encounter Setup (Tier 2):**
- Visit Date (date picker, default: today)
- Time In / Time Out (time pickers)
- Provider Name (text, pre-filled from logged-in user's `displayName`)
- Provider NPI (text, pre-filled from user profile if available)
- Provider Role (dropdown: MD, DO, NP, PA, Hospice, Attending)
- Visit Type (dropdown: Routine, Urgent, F2F, Recert, Admission)
- Visit Purpose (multi-select checkboxes: Routine Oversight, Symptom Crisis, Admission, Medication Review, etc.)
- Certification Type (dropdown: Initial, Recertification, N/A)

**Section 3 — Clinical Narratives:**
- HPI Narrative (textarea, 4+ rows)
- Comorbidity Narrative (textarea, 4+ rows)
- Clinical Narrative / 6-Month Prognosis (textarea, 6+ rows)

**Section 4 — Vitals & Anthropometrics:**
- Blood Pressure (text, format hint: `120/80`)
- Heart Rate (number)
- Respiratory Rate (number)
- O2 Saturation (number, %)
- O2 Type (radio: Room Air / Oxygen Flow → if Oxygen, show liters input)
- Current Weight (number + unit toggle: lbs/kg)
- Prior Weight (number, for trending)

**Section 5 — Functional Status:**
- PPS Current (number input or dropdown: 0-100 in increments of 10)
- PPS Prior (same)
- FAST Score (dropdown: 1-7 with sub-stages for dementia patients)
- ADL Score Current (text, e.g., "4/6")
- ADL Dependencies (checkboxes: Bathing, Dressing, Feeding, Toileting, Transferring, Continence)
- Ambulation (radio: Independent, Assist, Wheelchair, Bedbound)
- Oral Intake (radio: Normal, Decreased, Minimal/Sips)

**Section 6 — Symptom Assessment (ESAS):**
- Pain Score (0-10 slider or number input)
- Pain Goal (0-10)
- Pain Relief (radio: Effective, Partial, Inadequate)
- Symptom Severity Grid (checkboxes with severity for: Dyspnea, Nausea, Fatigue, Anxiety, Depression, Drowsiness, Appetite, Wellbeing)
- Symptom Notes (textarea)

**Section 7 — Physical Exam / ROS:**
- WNL Systems (checkboxes: HEENT, Cardiovascular, Respiratory, GI, GU, Musculoskeletal, Neurological, Skin, Psych)
- Abnormal Systems (same checkboxes — selecting abnormal deselects WNL for that system)
- Exam Findings Narrative (textarea — elaboration on abnormal findings)
- PHQ-2 Score (number, 0-6)

**Section 8 — LCD & Eligibility:**
- LCD Criteria checkboxes: Weight loss >10%, Albumin <2.5, Recurrent infections, Declining functional status, Dysphagia, Frequent ER visits/hospitalizations

**Section 9 — Plan of Care & Orders:**
- Medication Changes (checkboxes: New, Discontinued, Adjusted, None)
- Medication Change Details (textarea)
- DME/Supplies Orders (textarea)
- Level of Care (dropdown: current level / requested change)
- Referrals (checkboxes: Chaplain, Social Worker, Volunteer, Music/Art Therapy)
- Discussed With (checkboxes: Patient, Family, IDG, Case Manager)

**Save behaviors:**
- "Save Draft" → calls `addAssessment` or `updateAssessment` with `status: 'draft'`
- "Complete Assessment" → calls `completeAssessment` (validates required fields) → prompts: "Generate documents now?" → if yes, navigates to document generation (Step 3.3) with this assessment pre-selected

**Acceptance criteria:**
- All 9 sections render with correct field types
- Patient selection header shows key info
- Provider fields pre-fill from auth context
- Draft save works (can navigate away and resume)
- Complete validates required fields (visitDate, providerName, visitType)
- Data saves correctly to `patients/{patientId}/assessments/{assessmentId}`
- Form is usable on tablet (primary physician device)

---

### Step 3.2 — Hybrid Paper Workflow (Workflow B)

⬜ **Status:** Not started

**What to do:**
Add a secondary action to the `/home-visit` page:

**"Generate Blank Assessment" button** (visible after patient is selected):
- Generates a PDF version of the assessment form
- Patient demographics section is pre-filled (name, MRN, DOB, admission date, benefit period, diagnoses, attending physician)
- All clinical sections are blank (with labeled fields and checkboxes for handwriting)
- Format: standard letter paper, printable

**Upload flow** (on the Documents page or a dedicated upload section):
- Select patient
- Upload scanned document (PDF/image)
- System creates an assessment record with `status: 'paper'` and attaches the file URL
- Paper assessments appear in the patient's assessment list but cannot be used for auto-generated documents

**Acceptance criteria:**
- Blank PDF generates with correct patient demographics
- PDF is properly formatted for printing (margins, font size, checkbox squares)
- Upload creates an assessment record with `status: 'paper'`
- Paper assessments are visible in assessment history
- Paper assessments show a "Paper — Manual Entry Required" badge

---

### Step 3.3 — Assessment-Based Document Generation

⬜ **Status:** Not started

**What to do:**
Redesign `src/components/DocumentsPage.jsx` with new primary flow:

**Step A — Select Patient** (reuse patient search)

**Step B — Select Assessment:**
- Show list of completed assessments for this patient (date, provider, visit type, status)
- Option to "Create New Assessment" (navigates to `/home-visit`)
- Only `status: 'complete'` assessments are selectable for generation

**Step C — Smart Document Selection:**
Based on the selected assessment's `visitType` + patient context:

| Visit Type | Auto-Selected Documents |
|------------|------------------------|
| **Admission** | Hospice H&P, CTI 60-Day Narrative, Progress Note |
| **Recertification** | CTI 60-Day Narrative, Attending Physician CTI (if patient has attending physician), Progress Note |
| **Routine** | Progress Note, Physician Home Visit Assessment |
| **F2F Encounter** | Physician Home Visit Assessment (with F2F attestation section), Progress Note |

Display: "This visit will generate:" with checkboxes for each document (pre-checked based on rules above). User can add/remove.

**Step D — Generate & Deliver:**
- Batch call to generate all selected documents
- Pass both `patient` data (Tier 1) and `assessment` data (Tier 2 + 3) to `prepareMergeData`
- Show download links for each generated document
- Option to email to configured recipients

**Secondary flow:** Keep a collapsible "Manual Document Generation" section below for edge cases (works like current template picker — no assessment required).

**Acceptance criteria:**
- Selecting an assessment loads its data for merge
- Smart selection matches visit type to correct document set
- User can override (add/remove documents from selection)
- Generation uses BOTH patient demographics AND assessment data
- Manual generation fallback works independently
- Generating from an older assessment uses THAT assessment's data, not the latest

---

### Step 3.4 — Expand `prepareMergeData` for All 68 Variables

⬜ **Status:** Not started

**What to do:**
Update `functions/generateCertDocs.js` (or equivalent Cloud Function) to map all 68 standardized variables.

**Function signature change:**
```javascript
// OLD: prepareMergeData(patient, org)
// NEW: prepareMergeData(patient, assessment, org)
```

**Tier 1 mappings (from patient doc):**
```
{{PATIENT_NAME}}          → formatName(patient.firstName, patient.lastName, 'FULL')
{{DOB}}                   → formatDate(patient.dob, 'MM/DD/YYYY')
{{MRN}}                   → patient.mrn
{{MBI}}                   → patient.mbi
{{MPI}}                   → patient.medicaidNumber
{{CBX_GENDER}}            → resolveCheckbox(patient.gender, [option])
{{PATIENT_ADDRESS}}       → patient.address
{{PATIENT_PHONE}}         → formatPhone(patient.patientPhone)
{{PATIENT_LOCATION}}      → patient.locationName
{{ADMISSION_DATE}}        → formatDate(patient.admissionDate, 'MM/DD/YYYY')
{{ELECTION_DATE}}         → formatDate(patient.electionDate, 'MM/DD/YYYY')
{{CDATE_START}}           → formatDate(patient.certStartDate, 'MM/DD/YYYY')
{{CDATE_END}}             → formatDate(patient.certEndDate, 'MM/DD/YYYY')
{{BENEFIT_PERIOD_NUM}}    → patient.currentBenefitPeriod
{{CBX_BENEFIT_PERIOD}}    → resolveCheckbox(...)
{{CBX_F2F_STATUS}}        → resolveCheckbox(patient.f2fRequired, [option])
{{F2F_DATE}}              → formatDate(patient.f2fDate, 'MM/DD/YYYY')
{{F2F_PROVIDER_NAME}}     → patient.f2fPhysician
{{F2F_PROVIDER_NPI}}      → patient.f2fProviderNpi
{{CBX_F2F_ROLE}}          → resolveCheckbox(patient.f2fProviderRole, [option])
{{DIAGNOSIS_1}} - {{DIAGNOSIS_6}} → patient.diagnoses[n].name
{{DX_DATE_1}} - {{DX_DATE_6}}     → formatDate(patient.diagnoses[n].onsetDate, 'MM/DD/YYYY')
{{CBX_DX_RELATED}}        → resolveCheckbox(patient.diagnoses[n].relationship, 'Related')
{{CBX_DX_UNRELATED}}      → resolveCheckbox(patient.diagnoses[n].relationship, 'Unrelated')
{{ATTENDING_PHYSICIAN_NAME}}  → patient.attendingPhysician.name
{{ATTENDING_PHYSICIAN_NPI}}   → formatNpi(patient.attendingPhysician.npi)
{{ATTENDING_PHYSICIAN_PHONE}} → formatPhone(patient.attendingPhysician.phone)
```

**Tier 2 mappings (from assessment doc):**
```
{{SELECT_DATE}}           → formatDate(assessment.visitDate, 'MM/DD/YYYY')
{{TIME_IN}}               → assessment.timeIn
{{TIME_OUT}}              → assessment.timeOut
{{CBX_VISIT_TYPE}}        → resolveCheckbox(assessment.visitType, [option])
{{CBX_VISIT_PURPOSE}}     → resolveCheckbox(assessment.visitPurpose, [option])
{{PROVIDER_NAME}}         → assessment.providerName
{{PROVIDER_NPI}}          → formatNpi(assessment.providerNpi)
{{CBX_PROVIDER_ROLE}}     → resolveCheckbox(assessment.providerRole, [option])
{{CBX_CERT_TYPE}}         → resolveCheckbox(assessment.certType, [option])
```

**Tier 3 mappings (from assessment doc):**
```
{{HPI_NARRATIVE}}         → assessment.hpiNarrative
{{COMORBIDITY_NARRATIVE}} → assessment.comorbidityNarrative
{{CLINICAL_NARRATIVE}}    → assessment.clinicalNarrative
{{VITALS_BP}}             → assessment.vitalsBp
{{VITALS_HR}}             → assessment.vitalsHr
{{VITALS_RESP}}           → assessment.vitalsResp
{{VITALS_O2}}             → assessment.vitalsO2
{{CBX_O2_TYPE}}           → resolveCheckbox(assessment.o2Type, [option])
{{WEIGHT_CURRENT}}        → assessment.weightCurrent
{{WEIGHT_PRIOR}}          → assessment.weightPrior
{{PPS_CURRENT}}           → assessment.ppsCurrent
{{PPS_PRIOR}}             → assessment.ppsPrior
{{FAST_CURRENT}}          → assessment.fastCurrent
{{ADL_SCORE_CURRENT}}     → assessment.adlScoreCurrent
{{CBX_ADL_DEPENDENT}}     → resolveCheckbox(assessment.adlDependent, [option])
{{CBX_AMBULATION}}        → resolveCheckbox(assessment.ambulationStatus, [option])
{{CBX_INTAKE}}            → resolveCheckbox(assessment.intakeStatus, [option])
{{PAIN_SCORE}}            → assessment.painScore
{{PAIN_GOAL}}             → assessment.painGoal
{{CBX_PAIN_RELIEF}}       → resolveCheckbox(assessment.painRelief, [option])
{{CBX_SYMPTOM_SEVERITY}}  → resolveCheckbox(assessment.symptomSeverity, [option])
{{SYMPTOM_NOTES}}         → assessment.symptomNotes
{{CBX_EXAM_WNL}}          → resolveCheckbox(assessment.examWnl, [option])
{{CBX_EXAM_ABN}}          → resolveCheckbox(assessment.examAbn, [option])
{{EXAM_FINDINGS_NARRATIVE}} → assessment.examFindingsNarrative
{{PHQ2_SCORE}}            → assessment.phq2Score
{{CBX_LCD_CRITERIA}}      → resolveCheckbox(assessment.lcdCriteria, [option])
{{CBX_MED_CHANGES}}       → resolveCheckbox(assessment.medChanges, [option])
{{MED_CHANGE_DETAILS}}    → assessment.medChangeDetails
{{ORDERS_DME}}            → assessment.ordersDme
{{CBX_LOC}}               → resolveCheckbox(assessment.locChange, [option])
{{CBX_REFERRALS}}         → resolveCheckbox(assessment.referrals, [option])
{{CBX_DISCUSSED_WITH}}    → resolveCheckbox(assessment.discussedWith, [option])
```

**Organization fields:**
```
{{HOSPICE_NAME}}          → org.name
{{HOSPICE_NPI}}           → formatNpi(org.npi)
```

**Backward compatibility:** If `assessment` parameter is null/undefined (for manual generation without an assessment), all Tier 2 + 3 fields resolve to `''`.

**Acceptance criteria:**
- All 68 variables resolve to values or empty strings — never `undefined` or `null`
- Checkbox fields render as ☑ or ☐
- Date fields use the correct format per template needs
- Function works with assessment (full mode) or without (backward compatible manual mode)
- Missing data produces clean empty strings in the output

---

### Step 3.5 — Update Document Templates for Standardized Variables

⬜ **Status:** Not started

**What to do:**
- Audit every document template (CTI 60-Day Narrative, Attending Physician CTI, Progress Note, Hospice H&P, Physician Home Visit Assessment)
- Replace any legacy placeholder names with the 68 standardized variable names from the autofill sheet
- Verify every `{{VARIABLE}}` in every template has a mapping in `prepareMergeData`
- Create a cross-reference table documenting which variables each template uses

**Reference — Variables per document type (from autofill sheet):**
- **All Documents:** PATIENT_NAME, DOB, MRN, DIAGNOSIS_1-6
- **CTI:** MBI, MPI, CBX_GENDER, ADMISSION_DATE, ELECTION_DATE, CDATE_START, CDATE_END, BENEFIT_PERIOD_NUM, CBX_BENEFIT_PERIOD, CBX_F2F_STATUS, F2F_DATE, F2F_PROVIDER_NAME, F2F_PROVIDER_NPI, CBX_F2F_ROLE, COMORBIDITY_NARRATIVE, CLINICAL_NARRATIVE, vitals, functional status, ATTENDING_PHYSICIAN_NAME/NPI/PHONE
- **Attending CTI:** MBI, PATIENT_ADDRESS, PATIENT_PHONE, ADMISSION_DATE, CDATE_START, CDATE_END, CBX_BENEFIT_PERIOD, CBX_CERT_TYPE, DX_DATE_1-6, CBX_DX_RELATED, CBX_DX_UNRELATED, PPS_CURRENT, FAST_CURRENT, ADL_SCORE_CURRENT, CBX_LCD_CRITERIA, CLINICAL_NARRATIVE
- **Assessment:** SELECT_DATE, TIME_IN/OUT, CBX_VISIT_TYPE/PURPOSE, PROVIDER_NAME/NPI, CBX_PROVIDER_ROLE, PATIENT_LOCATION, CBX_BENEFIT_PERIOD, CBX_CERT_TYPE, CBX_F2F_STATUS, all clinical narratives, all vitals, all functional status, all symptoms, all exam, all plan of care
- **Progress Note:** SELECT_DATE, TIME_IN/OUT, CBX_VISIT_TYPE/PURPOSE, PROVIDER_NAME/NPI, CBX_PROVIDER_ROLE, PATIENT_LOCATION, CBX_F2F_STATUS, F2F_DATE, all clinical fields, all symptoms, all exam, all plan of care

**Acceptance criteria:**
- Every placeholder in every template has a corresponding mapping
- No orphaned `{{UNMAPPED}}` text in generated documents
- Template-to-variable cross-reference is documented

---

### ✋ Phase 3 — Verification Checklist (Do Before Moving to Phase 4)

⬜ Create a patient, then complete a full digital assessment — data saves correctly to subcollection
⬜ Resume a draft assessment — data loads, edits save
⬜ Complete an assessment — required field validation works
⬜ Generate a blank assessment PDF — demographics pre-filled, clinical sections blank
⬜ Upload a scanned paper assessment — record created with `status: 'paper'`
⬜ Generate documents from a completed assessment — all 68 variables populate correctly
⬜ Test each visit type (Admission, Recert, Routine, F2F) — correct doc set auto-selected
⬜ Override document selection (add/remove) — works correctly
⬜ Generate from an older assessment — uses THAT assessment's data
⬜ Manual generation fallback — still works without selecting an assessment
⬜ Check generated documents for orphaned placeholders — none found

---

## Phase 4: Polish & Cleanup

**Goal:** Supporting features, quality of life improvements, deprecated template removal, and production deployment.
**Estimated effort:** Week 4-5
**Dependencies:** Phases 1-3 complete.

---

### Step 4.1 — Patient Chart View

⬜ **Status:** Not started

**What to do:**
Create `src/components/PatientChartView.jsx`:
- Read-only comprehensive view of all patient data
- **Header:** Name, MRN, DOB, age, status badge (Active/Discharged)
- **Compliance sidebar:** Current benefit period, cert start/end dates, F2F status & date, HUV status, days until next cert
- **Data sections** (scrollable): Demographics, Diagnoses, Contacts & Caregivers, Physicians, Services, Medications & Allergies, Location
- **Assessment History:** Table of past assessments — columns: Date, Provider, Visit Type, Status, Actions (View/Generate Docs)
- **Quick actions:** "New Assessment", "Edit Patient" (opens modal), "Generate Documents"
- Route: `/patients/{patientId}`

**Acceptance criteria:**
- All patient data renders in organized, readable sections
- Assessment history pulls from subcollection, ordered by date desc
- Quick actions navigate to correct pages/modals
- Compliance sidebar highlights overdue items in red/yellow
- Page is read-only (editing only via PatientModal)

---

### Step 4.2 — Physician Directory

⬜ **Status:** Not started

**What to do:**
Create `organizations/{orgId}/physicians/{physicianId}` collection:
- Fields: name, npi, address, phone, fax, email, specialty, role
- Service: `src/services/physicianService.js` with CRUD + search
- UI: section in Settings page for admin management
- Integration: PatientModal Tab 5 (Physicians & F2F) → attending physician name field gets autocomplete from directory
- Auto-save: when a user enters a NEW physician on a patient (name + NPI not in directory), offer to save to directory

**Acceptance criteria:**
- Physician directory CRUD works
- Patient modal physician fields show directory autocomplete
- New physicians can be auto-added to directory from patient modal
- Search by name or NPI
- Directory is scoped to the organization

---

### Step 4.3 — Template Cleanup

⬜ **Status:** Not started

**What to do:**
- Audit all document templates in Firebase Storage / Google Drive
- Identify deprecated templates (old formats, pre-standardization variable names)
- Archive deprecated templates (move to an `archive/` folder, don't delete permanently)
- Remove deprecated template references from the UI
- Ensure all generation flows point to current standardized templates only

**Acceptance criteria:**
- No deprecated templates appear in any UI dropdown or selection
- Archived templates are recoverable if needed
- All document generation uses standardized templates with 68-variable mappings

---

### Step 4.4 — Firebase Hosting Deployment

⬜ **Status:** Not started

**What to do:**
- Configure `firebase.json` for Hosting with SPA rewrite rules
- Build: `npm run build` produces optimized Vite output
- Deploy: `firebase deploy --only hosting`
- Configure: proper caching (static assets: long cache, HTML: no-cache), security headers (X-Frame-Options, CSP)
- Verify: all routes work on refresh (SPA routing), HTTPS enforced

**Acceptance criteria:**
- App accessible at live Firebase Hosting URL
- All routes work on direct navigation and refresh
- HTTPS enforced
- Build + deploy can be run as a single command

---

### ✋ Phase 4 — Final Verification Checklist

⬜ Patient chart view: displays all data for a fully populated patient
⬜ Patient chart view: assessment history shows all subcollection records
⬜ Physician directory: search returns correct results
⬜ Physician directory: patient modal autocomplete works
⬜ Physician directory: new physician auto-save offer works
⬜ No deprecated templates accessible in any UI
⬜ Firebase Hosting: app loads at live URL
⬜ Firebase Hosting: all routes work on refresh

### 🏁 End-to-End Smoke Test

⬜ Create a new patient via 7-tab modal (all tabs filled)
⬜ Start a Home Visit Assessment for that patient
⬜ Complete the assessment with all sections filled
⬜ Generate documents from the completed assessment
⬜ Verify all 68 variables populated in generated documents
⬜ View patient in Chart View — all data present, assessment in history
⬜ Generate a blank assessment PDF — demographics correct
⬜ Manual document generation — still works independently
⬜ Test as non-admin user — proper access restrictions

---

## User Journey (End State)

| Step | Task | Role | What Happens |
|------|------|------|-------------|
| 1 | **Intake** | Nurse/Admin | Creates patient via 7-tab PatientModal — demographics, diagnoses, meds, contacts, physicians |
| 2 | **Start Visit** | Doctor | Opens `/home-visit`, selects patient. Form loads with pre-filled patient header. |
| 3 | **Log Assessment** | Doctor | Enters vitals, functional status, symptoms, exam findings, narratives. Uses RxNav/ICD-10 autocomplete. Saves as draft or completes. |
| 4 | **Generate Docs** | Admin/Doctor | Documents page → selects completed assessment → system auto-selects correct document set → "Generate All" |
| 5 | **Output** | System | Generates fully populated documents. All 68 variables resolved. Checkboxes as ☑/☐. Ready for billing/filing. |

---

## Key Decisions

| # | Decision | Status | Resolution |
|---|----------|--------|------------|
| 1 | **SSN Storage** | Deferred | Include field in schema, defer actual storage until encryption-at-rest is confirmed. Comment in code. |
| 2 | **Visit Data Persistence** | ✅ Decided | Use `assessments` subcollection. Enables history, trending, assessment-based generation. |
| 3 | **ICD-10 Lookup** | ✅ Decided | NIH Clinical Tables API in Phase 2. Free text fallback. |
| 4 | **Physician Directory** | ✅ Decided | Phase 4. Reduces repetitive data entry. |
| 5 | **Patient Location** | Open | Currently on patient doc (Tier 1). If location changes per visit, consider adding `visitLocation` to assessment schema. |

---

## Files Modified/Created (Summary)

| File | Change | Phase | Step |
|------|--------|-------|------|
| `src/services/patientService.js` | Expand schema, converters, CRUD | 1 | 1.1-1.3 |
| `src/services/assessmentService.js` | **NEW** — assessment CRUD + schema | 1 | 1.5 |
| `functions/migratePatients.js` | **NEW** — one-time migration | 1 | 1.4 |
| `functions/utils/checkboxHandler.js` | **NEW** — Unicode checkbox utility | 1 | 1.6 |
| `functions/utils/formatAdapters.js` | **NEW** — date/name/phone formatters | 1 | 1.7 |
| `firestore.rules` | Assessment rules + field validation | 1 | 1.9 |
| `src/components/Sidebar.jsx` | **NEW** — navigation | 2 | 2.1 |
| `src/components/PatientModal.jsx` | Rebuild — 7 tabs | 2 | 2.2 |
| `src/components/DiagnosisManager.jsx` | **NEW** — diagnosis rows | 2 | 2.3 |
| `src/components/MedicationManager.jsx` | **NEW** — medication rows | 2 | 2.4 |
| `src/components/AllergyManager.jsx` | **NEW** — allergy rows + NKDA | 2 | 2.5 |
| `src/components/SettingsPage.jsx` | Expand with org info | 2 | 2.8 |
| `src/components/HomeVisitAssessment.jsx` | **NEW** — digital assessment form | 3 | 3.1 |
| `src/components/DocumentsPage.jsx` | Redesign — assessment-based flow | 3 | 3.3 |
| `functions/generateCertDocs.js` | Expand prepareMergeData — 68 vars | 3 | 3.4 |
| `src/components/PatientChartView.jsx` | **NEW** — read-only patient view | 4 | 4.1 |
| `src/services/physicianService.js` | **NEW** — physician directory CRUD | 4 | 4.2 |
| `functions/services/cleanup.js` | **NEW** — template cleanup | 4 | 4.3 |
