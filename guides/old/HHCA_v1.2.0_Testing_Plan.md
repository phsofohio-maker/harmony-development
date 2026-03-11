# Harmony HCA v1.2.0 — Testing & Template Migration Plan (FINAL)

**Date:** March 4, 2026  
**Version:** 1.2.0  
**Context:** All 4 phases of the CTI expansion have been implemented (14 steps). No automated test suite — testing is lint, build, and manual verification. This plan also covers migration from the old multi-document template system to 5 consolidated templates.

> **Note:** The `.md` exports of all 5 Google Doc templates are the source of truth for merge variable names. Some variable names differ from the original 68-variable plan — those discrepancies are documented in Part A and must be reconciled during implementation.

---

## Part A: Template Migration

### A.1 — New Template System (5 Documents)

The old system split certifications across 7 templates per benefit period. The new system uses 5 purpose-driven documents that handle all periods internally.

| # | Template Name | Codebase Key | Google Doc ID | Replaces |
|---|---|---|---|---|
| 1 | **CTI Narrative** | `CTI` | `1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58` | `60DAY`, `90DAY_INITIAL`, `90DAY_SECOND` |
| 2 | **Attending Physician CTI** | `ATTEND_CTI` | `1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI` | `ATTEND_CERT` |
| 3 | **Progress Note** | `PROGRESS_NOTE` | `1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA` | `PROGRESS_NOTE` (new ID) |
| 4 | **Physician H&P** | `PHYSICIAN_HP` | `1p7Qoik9VQq0AdHiEtiKOLLsyGV5Xldp9qqe-qOyRJB8` | `PATIENT_HISTORY` |
| 5 | **Home Visit Assessment** | `HOME_VISIT_ASSESSMENT` | `15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s` | *(new — was empty)* |

**Deprecated keys to remove:** `60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`, `ATTEND_CERT`, `PATIENT_HISTORY`, `F2F_ENCOUNTER`

### A.2 — Updated `documentTypes` per Benefit Period

The `determineCertPeriodByBenefit()` function (in both frontend and Cloud Functions) must change:

| Period | Old `documentTypes` | New `documentTypes` |
|---|---|---|
| Period 1 (Initial 90-day) | `['90DAY_INITIAL', 'ATTEND_CERT', 'PATIENT_HISTORY']` | `['CTI', 'ATTEND_CTI', 'PHYSICIAN_HP']` |
| Period 2 (2nd 90-day) | `['90DAY_SECOND', 'PROGRESS_NOTE']` | `['CTI', 'PROGRESS_NOTE']` |
| Period 3+ (60-day) | `['60DAY', 'PROGRESS_NOTE']` | `['CTI', 'PROGRESS_NOTE']` |

The Home Visit Assessment (`HOME_VISIT_ASSESSMENT`) is generated per-visit, not per-period — it does not appear in `documentTypes` arrays.

### A.3 — Merge Variable Audit (Template Source of Truth)

The actual merge variables used across the 5 templates differ in some cases from the original 68-variable plan. Below is the complete catalog extracted from the `.md` exports. **These are the variable names `prepareMergeData` must resolve.**

**Shared across most/all templates:**

| Variable | Used In | Notes |
|---|---|---|
| `PATIENT_NAME` | All 5 | |
| `DOB` | All 5 | |
| `MRN` | All 5 | |
| `CBX_BP` | CTI, Attend CTI, H&P, Home Visit | Benefit period checkbox |
| `CBX_CT` | Attend CTI, H&P, Home Visit | Certification type checkbox |
| `CBX_F2F` | CTI, H&P, Home Visit | F2F status checkbox |
| `CBX_R` | CTI, Attend CTI, H&P, Home Visit | Diagnosis related/unrelated |
| `DIAGNOSIS_1` through `DIAGNOSIS_6` | Attend CTI, H&P, Home Visit | **Note: CTI uses `DIAGNOSIS1`/`DIAGNOSIS2` (no underscore)** |
| `CALC_ICD` | CTI, Attend CTI, H&P, Home Visit | Computed ICD-10 code |
| `ADMISSION` | CTI, Attend CTI, H&P | Admission date |
| `SELECT_DATE` | H&P, Progress Note, Home Visit | Visit date |
| `SELECT_TIME` | H&P, Progress Note, Home Visit | Visit time(s) |

**CTI-specific variables:**

| Variable | Notes |
|---|---|
| `MBI` | Medicare Beneficiary ID |
| `MPI` | Medicaid number |
| `CBX_GENDER` | Gender checkbox |
| `BENEFIT_PERIOD` | Benefit period number |
| `ELECTION_DATE` | Hospice election date |
| `CD_1`, `CD_2` | Cert period start/end dates |
| `DIAGNOSIS1`, `DIAGNOSIS2` | **No underscore — inconsistent with other templates** |
| `PHYS_ATT_NAME`, `PHYS_ATT_NPI`, `PHYS_ATT_PHONE` | Attending physician info |
| `SUGGESTION` | AI-suggested narrative hint |
| `F2F_DATE` | F2F encounter date |
| `F2F_PHYSICIAN`, `F2F_NPI` | F2F provider info |
| `CBX_F2F_ROLE` | F2F provider role checkbox |
| `BENEFIT_PERIOD_1` | Benefit period start (for F2F section) |

**Attending CTI-specific variables:**

| Variable | Notes |
|---|---|
| `MBI` | Medicare Beneficiary ID |
| `NPI` | Hospice NPI (org-level) |
| `PATIENT_ADDRESS`, `PATIENT_PN` | Patient address/phone |
| `CDATE1`, `CDATE2` | Cert dates — **different key from CTI's `CD_1`/`CD_2`** |
| `D1_DATE` through `D6_DATE` | Diagnosis onset dates |

**H&P-specific variables:**

| Variable | Notes |
|---|---|
| `CALC_AGE` | Computed patient age |
| `PHYS_ATT_NAME` | Attending physician |
| `PATIENT_LOCATION` | Visit location |
| `BENEFIT_PERIOD_1`, `BENEFIT_PERIOD_2` | Period date range |

**Progress Note-specific variables:**

| Variable | Notes |
|---|---|
| `PATIENT_LOCATION` | Visit location |
| `CBX_VT` | Visit type checkbox (Routine/Urgent/F2F/Recert) |
| `PROVIDER` | Provider name |
| `CBX_ROLE` | Provider role checkbox (MD/DO/NP/PA) |
| `NPI` | Provider NPI |
| `DIAGNOSIS1` | **No underscore — same as CTI** |

**Home Visit Assessment-specific variables:**

| Variable | Notes |
|---|---|
| `CBX_ROLE` | Provider role checkbox |
| `CBX_VP` | Visit purpose checkbox |

### A.4 — Variable Naming Inconsistencies to Resolve

These must be addressed before `prepareMergeData` can work across all templates:

| Issue | Templates Affected | Decision Needed |
|---|---|---|
| `DIAGNOSIS_1` vs `DIAGNOSIS1` (underscore) | CTI + Progress Note use no underscore; others use underscore | Standardize in templates or handle both in code |
| `CD_1`/`CD_2` vs `CDATE1`/`CDATE2` | CTI vs Attending CTI | Standardize or map both |
| `PATIENT_PN` vs `PATIENT_PHONE` | Attending CTI uses `PATIENT_PN`; original plan used `PATIENT_PHONE` | Pick one |
| `PROVIDER` vs `PROVIDER_NAME` | Progress Note uses `PROVIDER`; original plan used `PROVIDER_NAME` | Pick one |
| `F2F_PHYSICIAN` vs `F2F_PROVIDER_NAME` | CTI uses `F2F_PHYSICIAN`; original plan used `F2F_PROVIDER_NAME` | Pick one |
| `BENEFIT_PERIOD` vs `BENEFIT_PERIOD_NUM` | CTI uses `BENEFIT_PERIOD`; original plan used `BENEFIT_PERIOD_NUM` | Pick one |
| `PHYS_ATT_*` naming | Used by CTI and H&P but not in original plan's variable list | Add to `prepareMergeData` |

**Recommendation:** Since the templates are the source of truth, update `prepareMergeData` to resolve ALL variable names found in the templates. Where naming is inconsistent between templates, the easiest fix is to populate both variants from the same source data (e.g., set both `DIAGNOSIS_1` and `DIAGNOSIS1` to the same value).

### A.5 — Files Requiring Updates

| File | What Changes |
|---|---|
| `functions/scripts/configureTemplates.js` | Replace `documentTemplates` object with 5 new keys/IDs |
| `functions/scripts/setupOrg.js` | Same — replace `settings.documentTemplates` |
| `src/services/organizationService.js` | Update `ORG_DEFAULTS.settings.documentTemplates` |
| `src/services/certificationCalculations.js` | Update `determineCertPeriodByBenefit()` → new `documentTypes` arrays (see A.2) |
| `functions/utils.js` | Backend mirror of above — same `documentTypes` changes |
| `functions/scripts/initDocumentTemplates.js` | Replace 7-template `TEMPLATES` object with 5 new templates |
| `functions/lib/pdfGenerator.js` | Update `prepareMergeData` to resolve all variables from A.3 |
| `src/services/verifyDatabase.js` | Update template key validation |
| `src/components/DocumentsPage.jsx` | Template library should show 5 templates |
| **Firestore (runtime)** | Run updated `configureTemplates.js` after deploy |

---

## Part B: Lint & Build Verification

### Step 1 — Lint Check

```bash
npm run lint
```

**Key files to validate:**
- `src/components/PatientModal.jsx` (rewritten — 7 tabs)
- `src/components/DiagnosisManager.jsx` (new)
- `src/components/MedicationManager.jsx` (new)
- `src/components/AllergyManager.jsx` (new)
- `src/components/HomeVisitAssessment.jsx` (new)
- `src/components/PatientChartView.jsx` (new)
- `src/components/PhysicianDirectory.jsx` (new)
- `src/components/SettingsPage.jsx` (modified — Physicians tab)
- `src/components/Sidebar.jsx` (modified — Visits nav)
- `src/components/PatientsPage.jsx` (modified — chart view)
- `src/services/organizationService.js` (new)
- `src/services/documentService.js` (modified)
- `functions/migratePatients.js` (new)
- `functions/generateDocument.js` (modified)
- `functions/lib/pdfGenerator.js` (modified)
- `firestore.rules` (rewritten)

### Step 2 — Production Build

```bash
npm run build
```

**What to look for:** Failed module resolution, JSX compilation errors, bundle size regression.

### Step 3 — Cloud Functions Syntax Check

```bash
cd functions && npm run lint 2>/dev/null || node -c migratePatients.js && node -c generateDocument.js && node -c lib/pdfGenerator.js
```

### Step 4 — Dev Server Smoke Test

```bash
npm run dev
```

Confirm it loads in the browser with no console errors.

---

## Part C: Manual Verification Checklist

### Phase 1 — Data Layer

- [ ] Open PatientModal → verify all 7 tabs render (Demographics, Admission, Physicians, Clinical, Directives, Services, Compliance)
- [ ] Create a new patient → confirm new fields save to Firestore (`attendingPhysician` as object, `diagnoses` array, etc.)
- [ ] Edit existing patient → verify backward compatibility (old string `attendingPhysician` still displays and saves)
- [ ] **Data round-trip test:** Create patient with all fields populated → close modal → reopen → verify every field persisted (especially `attendingPhysician` object, `diagnoses` array, `medications` array, `allergies` array)
- [ ] Run `migratePatients.js` against existing Parrish data → verify migrated docs have correct structure
- [ ] Spot-check 3 migrated patients → open in PatientModal → confirm data integrity

### Phase 2 — Patient UI

- [ ] Clinical tab → DiagnosisManager: add/remove diagnoses with ICD-10 and relationship type
- [ ] Clinical tab → MedicationManager: add/remove medications with dose, route, frequency
- [ ] Clinical tab → AllergyManager: add/remove allergies with severity; toggle NKDA
- [ ] Tab navigation works smoothly (no flash, no data loss on tab switch)

### Phase 3 — Document Generation

- [ ] Navigate to Visits page from sidebar
- [ ] Open HomeVisitAssessment → fill out all 6 sections (Visit Info, Vitals, Functional, Symptoms, Care Plan, Notes)
- [ ] **Happy path:** Click "Save & Generate PDF" → confirm visit saves AND PDF generates with merge fields populated
- [ ] **Missing template fallback:** Attempt generation for a template that doesn't exist → confirm graceful error (not crash)
- [ ] Generated documents appear in history with correct patient name, date, and download link
- [ ] **Template consolidation — Period 1:** System offers `CTI` + `ATTEND_CTI` + `PHYSICIAN_HP` (not old keys)
- [ ] **Template consolidation — Period 2:** System offers `CTI` + `PROGRESS_NOTE`
- [ ] **Template consolidation — Period 3+:** System offers `CTI` + `PROGRESS_NOTE`
- [ ] **Home Visit Assessment:** Available for any visit regardless of period (not in `documentTypes` arrays)

### Phase 4 — UI/Navigation

- [ ] Sidebar shows "Visits" nav item with clipboard icon
- [ ] Patients page → click "View Chart" → PatientChartView slides in from right
- [ ] Patient chart shows all sections (Demographics, Identifiers, Clinical tables, etc.)
- [ ] Chart "Edit" button opens PatientModal for that patient
- [ ] Settings → "Physicians" tab appears with Stethoscope icon
- [ ] PhysicianDirectory → Add, edit, remove physicians; role badges display correctly
- [ ] Settings → General tab shows Agency/Provider info and Compliance Thresholds
- [ ] Settings → Save Changes persists all new fields to Firestore

### Firestore Rules

- [ ] Authenticated user CAN read their own org's patients
- [ ] Authenticated user CANNOT read another org's patients (test with Firebase Emulator rules playground or second test account)
- [ ] Visits subcollection accessible under patients (read + write for org staff)
- [ ] Admin-only operations (patient delete, settings update) properly restricted

### Template Migration Verification

- [ ] Run updated `configureTemplates.js` → Firestore shows 5 new keys with correct IDs
- [ ] Old deprecated keys (`60DAY`, `90DAY_INITIAL`, etc.) no longer referenced anywhere in codebase
- [ ] `determineCertPeriodByBenefit(1)` returns `documentTypes: ['CTI', 'ATTEND_CTI', 'PHYSICIAN_HP']`
- [ ] `determineCertPeriodByBenefit(2)` returns `documentTypes: ['CTI', 'PROGRESS_NOTE']`
- [ ] `determineCertPeriodByBenefit(3)` returns `documentTypes: ['CTI', 'PROGRESS_NOTE']`
- [ ] DocumentsPage template library shows 5 templates
- [ ] Generate a CTI for a test patient → merge fields populate correctly
- [ ] Generate an Attending CTI → `CDATE1`/`CDATE2`, `D1_DATE`–`D6_DATE` populate
- [ ] Generate a Physician H&P → `CALC_AGE`, `PHYS_ATT_NAME` populate
- [ ] Generate a Progress Note → `PROVIDER`, `CBX_VT`, `CBX_ROLE` populate
- [ ] `verifyDatabase.js` passes with no template key warnings

---

## Execution Order

1. **Resolve variable naming** (Part A.4) — decide on standardization approach
2. **Template migration code changes** — update all files in Part A.5
3. `npm run lint` — catch syntax/import issues
4. `npm run build` — confirm compilation
5. Functions syntax check — validate backend
6. `npm run dev` — visual smoke test
7. **Run migration script** — `migratePatients.js` for existing patient data (back up Firestore first)
8. **Run template config** — updated `configureTemplates.js` to push new IDs to Firestore
9. **Manual checklist** — work through Part C
10. **Deploy** — `firebase deploy` once all checks pass

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Variable naming inconsistencies (`DIAGNOSIS_1` vs `DIAGNOSIS1`) | Merge fields show `{{DIAGNOSIS1}}` literally in output | Populate both variants in `prepareMergeData` or standardize templates |
| Old template keys referenced in unexpected places | Document generation 404s | `grep -r '60DAY\|90DAY_INITIAL\|90DAY_SECOND\|ATTEND_CERT\|PATIENT_HISTORY\|F2F_ENCOUNTER'` across entire repo |
| Migration script corrupts patient data | Data loss | Back up Firestore before running `migratePatients.js` |
| `visits` vs `assessments` subcollection naming mismatch | Firestore rules don't match code | Verify which name the code actually uses and align rules |
| `CALC_ICD` and `CALC_AGE` are computed fields | Won't populate if compute logic isn't in `prepareMergeData` | Ensure age calculation and ICD-10 lookup are wired in |
| `SUGGESTION` field in CTI (AI-generated narrative hint) | New feature not in current `prepareMergeData` | Decide if this is a future feature or needs v1.2.0 implementation |
| Email notifications reference old template names | Confusing alert content | Check `utils.js` email templates for hardcoded doc names |