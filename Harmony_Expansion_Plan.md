# Harmony HCA — Expansion Implementation Plan

## Overview

This plan covers the complete expansion of Harmony from its current ~20-field patient schema to the full 107 approved autofill entries, restructured document workflow, and new physician-facing "Home Visit Assessment" flow. The spreadsheet has been reviewed — 107 entries approved, 19 denied (ICD-10 codes, relationships, and per-visit context fields deferred to form-time entry).

---

## Current State → Target State

| Area | Current | Target |
|------|---------|--------|
| **Patient Fields** | ~20 flat fields (name, MRN, DOB, admission, benefit period, F2F, HUV, attendingPhysician as string) | 74 Firestore fields across nested objects (attendingPhysician, hospicePhysician, pharmacy, funeralHome, primaryContact, caregivers) + arrays (diagnoses[], medications[], allergies[]) |
| **Patient Modal** | 3 tabs: Basic Info, Benefit Period, HUV Tracking | 7 tabs: Demographics, Admission & Clinical, Contacts & Caregivers, Physicians, Services, Medications & Allergies, Location |
| **Documents Page** | Individual CTI document generation per template | Unified Home Visit Assessment workflow + manual generation fallback |
| **Document Templates** | 5 separate templates generated individually | Single "visit" kicks off context-aware generation of the right document set |
| **Organization Data** | Name only | Name, NPI, address, phone, fax (for document headers) |

---

## Phase 1: Database Expansion (P0 — Do First)

This is the foundation everything else depends on.

### 1A. Expand `createPatientSchema` in `patientService.js`

Add all new fields with safe defaults. The key structural changes:

**New flat fields (25):** firstName, lastName, mbi, medicaidNumber, admissionNumber, ssn, gender, race, ethnicity, maritalStatus, primaryLanguage, religion, isDnr, codeStatus, dpoaName, livingWillOnFile, polstOnFile, nkda, nfka, otherNotes, electionDate, levelOfCare, disasterCode, address, locationName, locationType, institutionName, f2fProviderRole, f2fProviderNpi

**New nested objects (6):**
- `attendingPhysician: { name, npi, address, phone, fax, email }` — **MIGRATION needed** from current string field
- `hospicePhysician: { name, npi }`
- `primaryContact: { name, relationship, phone, address }`
- `primaryCaregiver: { name, relationship, address, mobile, email }`
- `secondaryCaregiver: { name, relationship, address, mobile }`
- `pharmacy: { name, address, phone, fax }`
- `funeralHome: { name, address, phone }`
- `referral: { source }`

**New arrays (3):**
- `diagnoses: [{ name, icd10, relationship }]` — idx 0 is always "Terminal"
- `medications: [{ name, dose, route, frequency, indication }]`
- `allergies: [{ allergen, reactionType, severity }]`

### 1B. Expand `docToPatient` converter

Handle all new nested paths with null safety. Pattern:
```
attendingPhysician: {
  name: data.attendingPhysician?.name || '',
  npi: data.attendingPhysician?.npi || '',
  ...
}
```

### 1C. Update `addPatient` and `updatePatient`

- `addPatient`: Accept and validate all new fields, auto-set defaults for nested objects
- `updatePatient`: Handle partial updates with merge strategy for nested objects, support array field updates (full array replacement is fine for v1)

### 1D. Migration Script: `functions/migratePatients.js`

Two migrations:
1. **attendingPhysician string → object**: Move existing `attendingPhysician: "Dr. Smith"` to `attendingPhysician: { name: "Dr. Smith", npi: "", ... }`
2. **Add default values**: Batch update all existing patients with empty defaults for new fields so queries don't break

### 1E. Expand Organization Schema

Add to `organizations/{orgId}`: npi, phone, fax, address fields for document autofill headers.

### 1F. Update Firestore Rules

Add field-level validation for new enum fields (gender, codeStatus, locationType, levelOfCare, referral source). Validate NPI format (10 digits).

---

## Phase 2: Expand Patient Modal UI (P0)

### 2A. Restructure PatientModal to 7 Tabs

Replace current 3-tab layout with:

| Tab | Fields |
|-----|--------|
| **1. Demographics** | firstName, lastName (auto-parsed from name), DOB, SSN, gender, race, ethnicity, primaryLanguage, religion, maritalStatus |
| **2. Admission & Clinical** | admissionDate, startOfCare, electionDate, levelOfCare, disasterCode, startingBenefitPeriod, isReadmission, priorHospiceDays, codeStatus, isDnr, dpoaName, livingWillOnFile, polstOnFile, diagnoses (via DiagnosisManager) |
| **3. Contacts & Caregivers** | primaryContact {name, relationship, phone, address}, primaryCaregiver {name, relationship, address, mobile, email}, secondaryCaregiver {name, relationship, address, mobile} |
| **4. Physicians** | attendingPhysician {name, npi, address, phone, fax, email}, hospicePhysician {name, npi}, F2F fields (f2fRequired, f2fCompleted, f2fPhysician, f2fProviderRole, f2fProviderNpi) |
| **5. Services** | pharmacy {name, address, phone, fax}, funeralHome {name, address, phone}, referral {source} |
| **6. Medications & Allergies** | MedicationManager component, AllergyManager component (with NKDA/NFKA toggles) |
| **7. Location** | address, locationName, locationType, institutionName |

The modal should expand to a drawer/side-panel on desktop (max-width ~800px) to accommodate the extra fields without feeling cramped.

### 2B. New Sub-Components

**DiagnosisManager** (P0):
- Dynamic list of up to 6 diagnoses
- Each row: name (text), icd10 (text with format hint), relationship (dropdown: Terminal/Related/Unrelated)
- First diagnosis locked as "Terminal"
- Add/remove rows, reorder capability

**MedicationManager** (P1):
- Dynamic table: name, dose, route (dropdown), frequency, indication
- Route dropdown: PO, IV, SQ, IM, Topical, Inhaled, SL, PR, Other
- Add/remove rows

**AllergyManager** (P1):
- NKDA checkbox (when checked, disables allergy list)
- NFKA checkbox
- Dynamic list: allergen, reactionType, severity (dropdown: Mild/Moderate/Severe)

---

## Phase 3: Redesign Documents Page — Home Visit Assessment Flow (P0)

This is the biggest UX change. Instead of the current "pick a template and generate" approach, the primary workflow becomes visit-driven.

### 3A. New Primary Flow: "Start Home Visit Assessment"

When a doctor opens the Documents page (or clicks from the dashboard), the main CTA is **"Start Home Visit Assessment"** rather than individual template buttons.

**Step 1 — Select Patient** (same as current)

**Step 2 — Visit Context Form** (NEW — short form, ~30 seconds to fill):
- Visit Date (default: today)
- Visit Time
- Provider Name (pre-filled from logged-in user if physician role)
- Provider Role (dropdown)
- Visit Type (dropdown: Admission, Recertification, Routine, F2F Encounter)
- Visit Purpose (checkboxes: Certification Review, Medication Review, Symptom Assessment, etc.)

**Step 3 — Smart Document Selection** (automatic based on visit type + patient context):

| Visit Type | Documents Generated |
|------------|-------------------|
| **Admission** | Hospice H&P, CTI 60-Day Narrative, Progress Note |
| **Recertification** | CTI 60-Day Narrative, Attending Physician CTI (if has attending), Progress Note |
| **Routine** | Progress Note, Physician Home Visit Assessment |
| **F2F Encounter** | Physician Home Visit Assessment (with F2F attestation section), Progress Note |

The system uses the patient's benefit period, F2F requirement status, and visit type to automatically determine which documents to generate. The doctor sees a preview: "This visit will generate: CTI 60-Day Narrative, Attending Physician CTI, Progress Note" with checkboxes to add/remove.

**Step 4 — Generate & Deliver**:
- Generate all selected documents (batch call)
- Show download links
- Option to email to configured recipients (attending physician, team)
- Documents are pre-filled with all 107 autofill fields from patient data + visit context

### 3B. Keep Manual Generation as Secondary

Below the Home Visit Assessment section, keep a collapsible "Manual Document Generation" section that works like the current template library — pick a template, generate individually. This is the fallback for edge cases.

### 3C. Update `prepareMergeData` in Cloud Functions

Expand the merge data builder to map ALL 107 approved autofill keys to patient data. Handle:
- Nested object paths: `{{PHYS_ATT_NAME}}` → `patient.attendingPhysician.name`
- Array fields: `{{DIAGNOSIS1}}` → `patient.diagnoses[0].name`, `{{ICD10_1}}` → `patient.diagnoses[0].icd10`
- Calculated fields: `{{PATIENT_AGE}}` from DOB, `{{CHECKBOX_BENEFIT_PERIOD}}` from period number
- Organization fields: `{{HOSPICE_NAME}}`, `{{HOSPICE_NPI}}` etc from org doc
- Visit context fields (denied from DB storage): `{{SELECT_DATE}}`, `{{SELECT_TIME}}`, `{{TODAY}}`, `{{VISIT_TYPE}}`, `{{VISIT_PURPOSE}}` — passed in via `customData` parameter at generation time

### 3D. Denied Fields Strategy

The 19 denied entries are all either ICD-10 codes/relationships (which live in the diagnoses array — they're stored, just not as separate top-level fields) or per-visit context fields. For ICD-10 codes, the autofill logic pulls from `diagnoses[n].icd10` and `diagnoses[n].relationship` at generation time. For visit context, these are passed as `customData` from the Visit Context Form in Step 2 — they're transient, not stored on the patient record.

---

## Phase 4: Supporting Features (P1-P2)

### 4A. Patient Chart View (P1)
Read-only comprehensive view of all patient data — header with name/MRN/status, sidebar with quick compliance info, scrollable sections for each data category. Quick-action buttons for Generate Doc, Edit Patient. This replaces needing to open the edit modal just to view data.

### 4B. Visit Data Entry Form (P1)
For capturing per-visit clinical data not stored on patient record: vitals (BP, HR, RR, Temp, O2, Weight), pain assessment, functional status (PPS, FAST, Karnofsky), symptom assessment grid, physical exam checklist, clinical narrative. This data goes into the generated documents but isn't persisted as structured patient data (or optionally stored in a visits subcollection).

### 4C. Physician Directory (P2)
Organization-level physician lookup: `organizations/{orgId}/physicians/{id}`. Search/filter, link to patients (auto-populate attending physician fields). Avoids re-entering physician info across patients.

### 4D. Settings Page Expansion (P1)
Add organization info fields (NPI, address, phone, fax) to settings. These feed into `{{HOSPICE_NAME}}`, `{{HOSPICE_NPI}}` etc. Also physician directory management and document template configuration.

### 4E. Sidebar Navigation (P0)
Collapsible sidebar with: Dashboard, Patients, Certifications, Documents, HUV, Settings. Active state indicators, role-based menu items. This replaces the current top-level tab/routing approach.

---

## Implementation Order

Given dependencies, here's the recommended build sequence:

```
Week 1-2: Phase 1 (Database)
  ├── 1A: Expand createPatientSchema
  ├── 1B: Expand docToPatient
  ├── 1C: Update addPatient/updatePatient
  ├── 1D: Migration script (run once)
  ├── 1E: Org schema expansion
  └── 1F: Firestore rules update

Week 2-3: Phase 2 (Patient Modal)
  ├── 2A: 7-tab modal restructure
  ├── 2B: DiagnosisManager component
  ├── 2B: MedicationManager component
  └── 2B: AllergyManager component

Week 3-4: Phase 3 (Documents Redesign)
  ├── 3A: Home Visit Assessment flow
  ├── 3B: Manual generation fallback
  ├── 3C: Expand prepareMergeData (107 keys)
  └── 3D: Visit context customData passthrough

Week 4-5: Phase 4 (Supporting)
  ├── 4E: Sidebar navigation (can start Week 1)
  ├── 4D: Settings page expansion
  ├── 4A: Patient chart view
  └── 4B-C: Visit data form, physician directory
```

---

## Key Decisions Needed

1. **SSN storage**: The spreadsheet includes SSN as approved. Do we want to store this? It requires encryption at rest and adds HIPAA compliance burden. Recommendation: defer unless specifically needed for a document template.

2. **Visit data persistence**: Store per-visit clinical data (vitals, exam findings) in a `visits` subcollection, or only embed in generated documents? Subcollection enables visit history and trending; document-only is simpler.

3. **ICD-10 lookup**: Should the DiagnosisManager include ICD-10 code lookup/autocomplete, or just a free-text field with format validation? Lookup is better UX but requires an ICD-10 database or API.

4. **Physician Directory scope**: Build as P2 nice-to-have, or promote to P1 given it reduces data entry for attending physicians across patients?

---

## Files Modified (Summary)

| File | Change | Phase |
|------|--------|-------|
| `src/services/patientService.js` | Expand schema, converters, CRUD | 1 |
| `firestore.rules` | Add validation for new fields | 1 |
| `functions/migratePatients.js` | NEW — one-time migration | 1 |
| `src/components/PatientModal.jsx` | Complete rebuild — 7 tabs | 2 |
| `src/components/DiagnosisManager.jsx` | NEW — diagnosis sub-component | 2 |
| `src/components/MedicationManager.jsx` | NEW — medication sub-component | 2 |
| `src/components/AllergyManager.jsx` | NEW — allergy sub-component | 2 |
| `src/components/DocumentsPage.jsx` | Redesign — Home Visit Assessment flow | 3 |
| `functions/generateCertDocs.js` | Expand prepareMergeData to 107 keys | 3 |
| `src/components/Sidebar.jsx` | NEW — navigation component | 4 |
| `src/components/SettingsPage.jsx` | Expand with org info | 4 |
| `src/components/PatientChartView.jsx` | NEW — read-only patient view | 4 |
| `src/components/VisitDataEntryForm.jsx` | NEW — clinical visit data capture | 4 |
