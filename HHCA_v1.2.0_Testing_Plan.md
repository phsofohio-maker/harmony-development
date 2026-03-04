# Harmony HCA v1.2.0 — Testing & Template Migration Plan

**Date:** March 4, 2026
**Version:** 1.2.0
**Context:** All 4 phases of the CTI expansion have been implemented (14 steps). No automated test suite exists — testing is lint validation, production build, and manual verification. This plan also covers the migration from the old multi-document template system to the new consolidated CTI templates.

---

## Part A: Template ID Migration

### Background

The old system used separate Google Doc templates per benefit period (`60DAY`, `90DAY_INITIAL`, `90DAY_SECOND`). The new system consolidates into a single `HHCA_CTI` template that handles all certification periods, plus dedicated templates for attending physician certification, progress notes, and home visit assessments.

### New Template Mapping

| Old Key(s) | New Key | New Google Doc ID | Notes |
|---|---|---|---|
| `60DAY`, `90DAY_INITIAL`, `90DAY_SECOND` | `CTI` | `1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58` | Consolidated CTI — replaces 3 old templates |
| `ATTEND_CERT` | `ATTEND_CTI` | `1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI` | Attending Physician CTI |
| `PROGRESS_NOTE` | `PROGRESS_NOTE` | `1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA` | Updated ID, same key |
| *(empty)* | `HOME_VISIT_ASSESSMENT` | `15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s` | New — was previously unconfigured |

### Deprecated Keys (Remove)

- `60DAY` — absorbed into `CTI`
- `90DAY_INITIAL` — absorbed into `CTI`
- `90DAY_SECOND` — absorbed into `CTI`
- `PATIENT_HISTORY` — no replacement in CSV (confirm if still needed or remove)
- `F2F_ENCOUNTER` — no replacement in CSV (confirm if still needed or remove)

### Files Requiring Template ID Updates

**1. `functions/scripts/configureTemplates.js`** — Replace entire `documentTemplates` object with new mapping.

**2. `functions/scripts/setupOrg.js`** — Replace `settings.documentTemplates` block.

**3. `src/services/organizationService.js`** — Update `ORG_DEFAULTS.settings.documentTemplates` to reflect new keys.

**4. `src/services/certificationCalculations.js`** — **Critical.** The `determineCertPeriodByBenefit()` function returns `documentTypes` arrays per period. These must change from the old multi-template system to the consolidated CTI:

```
Period 1: ['90DAY_INITIAL', 'ATTEND_CERT', 'PATIENT_HISTORY']  →  ['CTI', 'ATTEND_CTI']
Period 2: ['90DAY_SECOND', 'PROGRESS_NOTE']                    →  ['CTI', 'PROGRESS_NOTE']
Period 3+: ['60DAY', 'PROGRESS_NOTE']                          →  ['CTI', 'PROGRESS_NOTE']
```

**5. `functions/utils.js`** — Backend mirror of `determineCertPeriodByBenefit` — same `documentTypes` changes needed.

**6. `functions/scripts/initDocumentTemplates.js`** — Replace the 7-template `TEMPLATES` object with new 4-template structure using new keys and updated Firestore subcollection docs.

**7. `src/services/verifyDatabase.js`** — Template key validation will need to check the new keys.

**8. Firestore (runtime)** — After code deploys, run `configureTemplates.js` to update the live `organizations/org_parrish` document with new IDs.

### Open Questions

- [ ] Is `PATIENT_HISTORY` still a separate document, or is it folded into the CTI?
- [ ] Is `F2F_ENCOUNTER` still a separate document, or is the F2F captured in `HOME_VISIT_ASSESSMENT`?
- [ ] Does `ATTEND_CTI` replace `ATTEND_CERT` as the key name, or should we keep `ATTEND_CERT` and just update the ID?

---

## Part B: Lint & Build Verification

### Step 1 — Lint Check

```bash
npm run lint
```

**What to look for:** Import errors in new/modified files, undefined references, unused variables.

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
- [ ] Edit existing patient → verify backward compatibility (old string `attendingPhysician` still displays and saves correctly)
- [ ] **Data round-trip test:** Create a patient with all fields populated, close modal, reopen → verify every field persisted correctly (especially `attendingPhysician` object, `diagnoses` array, `medications` array, `allergies` array)
- [ ] Run `migratePatients.js` against existing Parrish data → verify migrated patient docs have correct new field structure
- [ ] Spot-check 3 migrated patients → open in PatientModal, confirm data integrity

### Phase 2 — Patient UI

- [ ] Clinical tab → DiagnosisManager: add/remove diagnoses with ICD-10 and relationship type
- [ ] Clinical tab → MedicationManager: add/remove medications with dose, route, frequency
- [ ] Clinical tab → AllergyManager: add/remove allergies with severity; toggle NKDA
- [ ] Tab navigation works smoothly in PatientModal (no flash, no data loss on tab switch)

### Phase 3 — Document Generation

- [ ] Navigate to Visits page from sidebar
- [ ] Open HomeVisitAssessment → fill out all 6 sections (Visit Info, Vitals, Functional, Symptoms, Care Plan, Notes)
- [ ] **Happy path:** Click "Save & Generate PDF" → confirm visit saves to Firestore AND PDF generates with merge fields populated
- [ ] **Missing template fallback:** Attempt generation for a template that doesn't exist → confirm graceful error message (not a crash)
- [ ] Verify generated documents appear in history with correct patient name, date, and download link
- [ ] **Template consolidation check:** For a Period 1 patient, verify the system now offers `CTI` + `ATTEND_CTI` (not the old `90DAY_INITIAL` + `ATTEND_CERT` + `PATIENT_HISTORY`)
- [ ] For a Period 3+ patient, verify the system offers `CTI` + `PROGRESS_NOTE` (not `60DAY` + `PROGRESS_NOTE`)

### Phase 4 — UI/Navigation

- [ ] Sidebar shows "Visits" nav item with clipboard icon
- [ ] Patients page → click "View Chart" (clipboard icon) → PatientChartView slides in from right
- [ ] Patient chart shows all sections (Demographics, Identifiers, Clinical tables, etc.)
- [ ] Chart "Edit" button opens PatientModal for that patient
- [ ] Settings → "Physicians" tab appears with Stethoscope icon
- [ ] PhysicianDirectory → Add, edit, remove physicians; role badges display correctly
- [ ] Settings → General tab shows Agency/Provider info and Compliance Thresholds sections
- [ ] Settings → Save Changes persists all new fields to Firestore

### Firestore Rules

- [ ] Authenticated user CAN read their own org's patients
- [ ] Authenticated user CANNOT read another org's patients (test with Firebase Emulator rules playground or a second test account)
- [ ] Visits subcollection is accessible under patients (read + write for org staff)
- [ ] Admin-only operations (patient delete, settings update) are properly restricted

### Template Migration Verification

- [ ] Run updated `configureTemplates.js` → verify Firestore `organizations/org_parrish/settings/documentTemplates` has new keys and IDs
- [ ] `determineCertPeriodByBenefit(1)` returns `documentTypes: ['CTI', 'ATTEND_CTI']`
- [ ] `determineCertPeriodByBenefit(2)` returns `documentTypes: ['CTI', 'PROGRESS_NOTE']`
- [ ] `determineCertPeriodByBenefit(3)` returns `documentTypes: ['CTI', 'PROGRESS_NOTE']`
- [ ] DocumentsPage template library shows the 4 new templates (not the old 7)
- [ ] Generate a CTI document for a test patient → verify merge fields populate from both patient data and visit/assessment data
- [ ] `verifyDatabase.js` passes with no template key warnings

---

## Execution Order

1. **Template migration code changes** — Update all files listed in Part A before testing
2. `npm run lint` — fast, catches most issues immediately
3. `npm run build` — confirms everything compiles
4. Functions syntax check — validates backend code
5. `npm run dev` — visual smoke test in browser
6. **Run migration script** — `migratePatients.js` for existing data
7. **Run template config** — updated `configureTemplates.js` to push new IDs to Firestore
8. **Manual checklist** — work through Part C systematically
9. **Deploy** — `firebase deploy` once all checks pass

---

## Risk Areas to Watch

| Risk | Impact | Mitigation |
|---|---|---|
| Old `60DAY`/`90DAY_*` keys referenced elsewhere | Document generation breaks | Search entire codebase for old keys before deploy |
| Migration script corrupts existing patient data | Data loss | Back up Firestore before running `migratePatients.js` |
| `visits` vs `assessments` subcollection naming inconsistency | Firestore rules don't match code | Confirm which name the code actually uses, align rules |
| `PATIENT_HISTORY` and `F2F_ENCOUNTER` removed without replacement | Missing documents for certain workflows | Confirm with clinical team before removing |
| Email notifications reference old template names | Confusing alert content | Check email templates in `utils.js` for hardcoded doc names |
