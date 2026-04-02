

![][image1]

**HHCA v1.3.0 — Implementation Plan**

Scanned Assessment OCR Pipeline

*Document AI Integration for Physician Home Visit Assessment Tool*

April 2, 2026  —  Prepared for Claude Code Execution  
Standalone Feature Release  —  Parrish Health Systems

**PREREQUISITES**

This plan assumes v1.2.1 (or v1.2.2) is deployed and stable. The Drive Quota Blocker does NOT block this feature *— Document AI is independent of the Google Docs/Drive document generation pipeline.*

The scanned assessment feature adds a new data entry pathway into the existing assessment schema. It does not modify any existing Cloud Functions or document generation logic.

# **How To Use This Plan**

This document follows the same two-track, gated workflow used in v1.2.0 and v1.2.1 plans. Claude Code follows Track A step-by-step. Kobe handles Track B infrastructure tasks. Each step requires explicit approval before proceeding.

**Workflow:** Claude reads step → proposes changes → Kobe approves → Claude executes → next step.

**Approval Gates:** Each step marked with ☐ needs Kobe’s approval. Mark ☑ when done.

# **Track Overview**

| Track | Description | Owner | Status | Dependencies |
| :---- | :---- | :---- | :---- | :---- |
| A | Cloud Function \+ Document AI Pipeline | Claude Code | NOT STARTED | B1, B2 |
| B | GCP Infrastructure Setup | Kobe | NOT STARTED | None |
| C | Upload \+ Review UI | Claude Code | NOT STARTED | Phase 1 |
| D | Integration \+ Pipeline | Claude Code | NOT STARTED | Phase 2 |

# **Architecture Overview**

The scanned assessment pipeline introduces a new data entry pathway that feeds into the existing assessment schema. Scanned assessments, once reviewed and approved, are indistinguishable from digitally-entered assessments and can be used for document generation.

| DATA FLOW ARCHITECTURE \[1\] Upload PDF/Image  →  Firebase Storage ↓ \[2\] Cloud Function Trigger  →  Document AI Form Parser API ↓ \[3\] Field Mapping Engine  →  CTI labels → Assessment schema ↓ \[4\] Draft Assessment (status: 'scanned\_draft')  →  Firestore ↓ \[5\] Review UI (split-screen: PDF \+ extracted fields) ↓ \[6\] Clinician approves  →  status: 'complete'  →  Document Generation |
| ----- |

# **Cost Estimate**

Based on Parrish Health Systems current volume of approximately 8–10 physician home visits per week (40/month), each producing a 5-page CTI form:

| Service | Unit Cost | Est. Monthly Vol | Monthly Cost |
| :---- | :---- | :---- | :---- |
| Document AI Form Parser | $0.065/page | \~200 pages (40 docs) | \~$13 |
| Firebase Storage | $0.026/GB | \< 1 GB | \~$0.03 |
| Cloud Functions (processing) | $0.40/million invocations | \~40 invocations | \~$0.01 |
| **Total estimated** |  |  | **\< $15/month** |

# **Phase 1: GCP Infrastructure \+ Backend Pipeline**

**Goal:** Enable Document AI, create the processing Cloud Function, and build the field mapping engine that converts raw OCR output into structured assessment data.

**Estimated effort:** 1–2 weeks

**Dependencies:** Kobe must complete Track B items B1–B3 before Track A can begin.

## **Track B (Kobe Manual) — GCP Setup**

**☐ B1 — Enable Document AI API**  *\[Not started\]*

Go to Google Cloud Console → APIs & Services → Enable APIs. Search for "Cloud Document AI API" and enable it for the parrish-harmonyhca project.

**☐ B2 — Create Form Parser Processor**  *\[Not started\]*

Go to Cloud Console → Document AI → Processors → Create Processor. Select "Form Parser" (pre-trained, no custom training needed). Region: us (multi-region). Name: "cti-form-parser". Copy the processor ID after creation — Claude Code needs this for the Cloud Function.

***Acceptance criteria:***

* Form Parser processor appears in Document AI console

* Processor ID copied and shared with Claude Code

* Processor is in ENABLED state

**☐ B3 — Grant Document AI Permissions to Service Account**  *\[Not started\]*

The default compute service account (1062012852590-compute@developer.gserviceaccount.com) needs the "Document AI API User" role (roles/documentai.apiUser). Go to IAM & Admin → IAM → find the service account → Add Role → "Cloud Document AI API User".

***Acceptance criteria:***

* Service account has documentai.apiUser role

* Role visible in IAM console

**☐ B4 — Store Processor ID in Firebase Config**  *\[Not started\]*

After B2, run the following Firebase CLI command to store the processor ID as an environment config value that Cloud Functions can access:

firebase functions:config:set docai.processor\_id="YOUR\_PROCESSOR\_ID" docai.location="us"

Then redeploy functions: firebase deploy \--only functions

## **Track A (Claude Code) — Backend Pipeline**

**☐ A1.1 — Create scanAssessment Cloud Function**  *\[Not started\]*

Create functions/scanAssessment.js — a Firebase onCall (v2) Cloud Function that accepts a storage file path, calls the Document AI Form Parser API, and returns raw extracted entities.

**Input:** { orgId, patientId, storagePath }

**Output:** { extractedFields: {}, confidenceScores: {}, rawText: string, pageCount: number }

Implementation notes: Use @google-cloud/documentai client library. The function reads the file from Firebase Storage, sends it to Document AI, and processes the response. Use onCall (not onRequest) for automatic CORS handling.

***Acceptance criteria:***

* Function deploys without errors

* Accepts PDF or image files from Firebase Storage

* Returns structured extraction result

* Handles errors gracefully (invalid file, API failure, timeout)

* Includes 300-second timeout for large documents

**☐ A1.2 — Build Field Mapping Engine**  *\[Not started\]*

Create functions/utils/ctiFieldMapper.js — a mapping module that translates Document AI’s raw key-value pairs into the standardized assessment schema fields. This is the critical translation layer.

The mapper handles three extraction types: key-value pairs (form fields), checkbox detection (checked/unchecked states), and free-text blocks (narrative sections). Each field mapping includes a confidence threshold — fields below the threshold are flagged for manual review.

***Acceptance criteria:***

* Maps all 34 CTI form field groups (see Field Mapping Reference)

* Checkbox fields resolve to the same format as digital assessments

* Narrative fields preserve paragraph breaks from handwriting

* Confidence scores passed through per-field

* Unknown/unmapped fields collected in an "unrecognized" array for debugging

**☐ A1.3 — Create Assessment Draft from Scan**  *\[Not started\]*

Extend scanAssessment.js to save the mapped data as a draft assessment in Firestore at organizations/{orgId}/patients/{patientId}/assessments/{assessmentId} with status: 'scanned\_draft'. Include the confidence scores and original storage path as metadata.

The draft assessment uses the exact same schema as digital assessments, plus additional scan metadata fields: scanStoragePath, scanProcessedAt, scanConfidenceScores, scanRawText.

***Acceptance criteria:***

* Draft saves to correct Firestore path (multi-tenant)

* Assessment schema matches digital assessment format exactly

* Scan metadata fields included for review UI

* scanStoragePath references the original uploaded file

* Status is 'scanned\_draft' (not 'draft' or 'complete')

**☐ A1.4 — Firebase Storage Rules for Scanned Documents**  *\[Not started\]*

Update storage.rules to allow authenticated users with the correct orgId claim to upload files to the scans/{orgId}/ path. File size limit: 25MB. Allowed MIME types: application/pdf, image/jpeg, image/png, image/tiff.

***Acceptance criteria:***

* Authenticated users can upload to their org’s scan path

* Cross-org uploads blocked by security rules

* File size and MIME type validation in place

**☐ A1.5 — Unit Tests for Field Mapper**  *\[Not started\]*

Create functions/test/ctiFieldMapper.test.js with test cases covering: known good extraction (all fields populated), partial extraction (missing fields default to empty), checkbox resolution (single-select and multi-select), narrative text with line breaks, and confidence threshold filtering.

***Acceptance criteria:***

* Tests cover all 34 field groups

* Edge cases: empty extraction, corrupted data, unexpected field names

* Tests pass with npm test from functions/ directory

## **✋ Phase 1 — Verification Checklist**

☐ B1–B4: Document AI API enabled, processor created, IAM role assigned, config set

☐ A1.1: scanAssessment function deploys and responds to test call

☐ A1.2: Field mapper correctly translates sample Document AI output

☐ A1.3: Draft assessment saves to Firestore with correct schema

☐ A1.4: Storage rules allow upload and block cross-org access

☐ A1.5: Unit tests pass

☐ End-to-end: Upload sample CTI PDF → call scanAssessment → draft appears in Firestore

# **Phase 2: Upload \+ Review UI**

**Goal:** Build the frontend components for uploading scanned CTI forms and reviewing/correcting the extracted data before approval.

**Estimated effort:** 2–3 weeks

**Dependencies:** Phase 1 complete.

**☐ A2.1 — Scan Upload Component**  *\[Not started\]*

Create src/components/ScanUpload.jsx — an upload interface accessible from the Home Visits page (as a secondary action alongside "New Assessment"). Flow: Select patient → Upload file (drag-and-drop or file picker) → Show processing spinner → Navigate to review screen.

The component should accept PDF, JPEG, PNG, and TIFF files. Show a preview thumbnail after selection. Display upload progress. Call the scanAssessment Cloud Function after upload completes.

***Acceptance criteria:***

* Upload accepts PDF, JPEG, PNG, TIFF up to 25MB

* Patient must be selected before upload is allowed

* Preview thumbnail shows after file selection

* Upload progress bar visible during transfer

* Processing spinner with status text while Document AI runs

* Error handling for: file too large, wrong format, API timeout, network failure

* Navigates to review screen on success

**☐ A2.2 — Scan Review Component — Split-Screen Layout**  *\[Not started\]*

Create src/components/ScanReview.jsx — a full-page review interface with two panels. Left panel: scrollable PDF/image viewer showing the original scanned document. Right panel: extracted data organized into the same section cards as the digital assessment form (Visit Info, Vitals, Functional Status, Symptoms, Exam, Plan of Care, Narratives).

Each extracted field shows: the extracted value (editable), a confidence indicator (green/yellow/red dot based on Document AI confidence score), and the ability to click on the field to highlight the corresponding region in the PDF viewer (if bounding box data is available).

***Acceptance criteria:***

* PDF viewer renders all pages of the scanned document

* Extracted fields are editable inline

* Confidence indicators: green (≥80%), yellow (50–79%), red (\<50%)

* Low-confidence fields (\<50%) auto-highlighted with yellow background

* Checkbox fields render as toggleable checkboxes (pre-set from OCR)

* Narrative fields render as expandable text areas

* Responsive: stacks vertically on mobile/tablet

**☐ A2.3 — Review Actions: Approve, Edit, Reject**  *\[Not started\]*

Add action buttons to the review screen. "Approve" saves the (possibly edited) data as status: 'complete' and the assessment enters the normal pipeline. "Save for Later" keeps the status as 'scanned\_draft' for future review. "Reject" deletes the draft assessment and optionally the uploaded file.

Before approval, run the same required-field validation as digital assessments (visitDate, clinicianName, visitType must be present). Show validation errors inline.

***Acceptance criteria:***

* Approve changes status from 'scanned\_draft' to 'complete'

* Approved assessments appear in patient’s assessment list identically to digital ones

* Save for Later preserves all edits without changing status

* Reject prompts for confirmation before deleting

* Required field validation runs before approve (same rules as digital)

* Validation errors shown inline next to the relevant fields

**☐ A2.4 — Scan History and Status Badges**  *\[Not started\]*

Update the Home Visits page assessment list to show scanned assessments with appropriate status badges. New statuses: 'scanned\_draft' shows an orange "Scan — Pending Review" badge. Completed scanned assessments show a subtle "Scanned" indicator but otherwise look identical to digital assessments.

Add a filter option to the assessment list: All / Digital / Scanned / Pending Review.

***Acceptance criteria:***

* Scanned draft assessments visible in assessment list with orange badge

* Completed scanned assessments show subtle “Scanned” chip

* Filter dropdown works for all four options

* Clicking a scanned\_draft assessment opens the review screen

* Clicking a completed scanned assessment opens the normal detail view

**☐ A2.5 — PDF Viewer Component**  *\[Not started\]*

Create src/components/PDFViewer.jsx using react-pdf (pdf.js wrapper) or a simple iframe-based viewer. The viewer must support multi-page navigation, zoom, and scroll. For the review screen, it renders inside the left panel.

If react-pdf adds too much bundle size, an alternative is to use Firebase Storage download URLs with the browser’s native PDF rendering in an iframe. Evaluate both approaches during implementation.

***Acceptance criteria:***

* Renders multi-page PDFs with page navigation

* Zoom in/out controls

* Scrollable within its panel

* Renders JPEG/PNG uploads as simple images (no PDF wrapper needed)

* Loads from Firebase Storage download URL

## **✋ Phase 2 — Verification Checklist**

☐ Upload a 5-page CTI PDF → processing completes within 30 seconds

☐ Review screen shows PDF on left, extracted data on right

☐ Edit a field in the review screen → change persists after save

☐ Low-confidence fields are highlighted yellow

☐ Approve a scanned assessment → appears as 'complete' in assessment list

☐ Reject a scanned assessment → draft deleted, upload optionally removed

☐ Filter assessment list by Scanned / Pending Review

☐ Test with: clean scan, tilted scan, phone photo of form, partially filled form

☐ Mobile responsive: review screen stacks vertically

# **Phase 3: Integration \+ Document Generation Pipeline**

**Goal:** Connect approved scanned assessments to the existing document generation pipeline so they can produce CTI narratives, progress notes, and other clinical documents.

**Estimated effort:** 1 week

**Dependencies:** Phase 2 complete. Drive Quota Blocker resolved (or docxtemplater alternative in place).

**☐ A3.1 — Verify Schema Compatibility**  *\[Not started\]*

Confirm that approved scanned assessments (status: 'complete', origin: 'scan') produce identical output when passed through prepareMergeData as digital assessments. Create a test script that generates a document from a scanned assessment and compares the merge data output against a known-good digital assessment.

***Acceptance criteria:***

* prepareMergeData produces valid output for scanned assessments

* All 68 merge variables resolve (no undefined/null)

* Checkbox fields render correctly (same ☑/☐ format)

* Narrative fields populate without encoding artifacts

**☐ A3.2 — Update DocumentsPage Assessment Selector**  *\[Not started\]*

Update the assessment selector in DocumentsPage.jsx (Step 3.3 from v1.2.0) to include approved scanned assessments in the selectable list. Scanned assessments should show the same information as digital ones plus a subtle "Scanned" indicator.

***Acceptance criteria:***

* Approved scanned assessments appear in assessment picker

* Selecting a scanned assessment generates documents correctly

* "Scanned" indicator visible but not obtrusive

* scanned\_draft assessments are NOT selectable for generation

**☐ A3.3 — Add Scan Origin Tracking to Assessment Records**  *\[Not started\]*

Add an origin field to the assessment schema: 'digital' for form-entered, 'scan' for OCR-processed, 'paper' for legacy uploads without extraction. This field is set once at creation and never changes. Update assessmentService.js to include this field.

***Acceptance criteria:***

* New assessments get origin: 'digital' automatically

* Scanned assessments get origin: 'scan'

* Legacy paper uploads retain origin: 'paper'

* Origin field visible in assessment detail view

* Origin field is read-only after creation

**☐ A3.4 — Audit Trail for Scanned Assessments**  *\[Not started\]*

Add an editHistory array to scanned assessment records that logs every field change made during review. Each entry: { field, originalValue, newValue, editedBy, editedAt }. This provides an audit trail showing what the OCR extracted vs. what the clinician approved.

***Acceptance criteria:***

* Edit history captures all changes made during review

* Original OCR values preserved even after editing

* Audit trail viewable from assessment detail (collapsible section)

* Edit history does not inflate Firestore document beyond 1MB limit

## **✋ Phase 3 — Verification Checklist**

☐ Generate a CTI document from a scanned assessment → all fields populated

☐ Generate a Progress Note from a scanned assessment → no orphaned placeholders

☐ Compare output: same patient, digital vs. scanned assessment → equivalent quality

☐ Audit trail shows OCR original values vs. clinician-edited values

☐ Origin field correctly set for new digital, new scanned, and legacy paper assessments

☐ scanned\_draft assessments blocked from document generation

# **Phase 4: Polish, Error Handling, and Production Readiness**

**Goal:** Harden the pipeline for production use, add quality-of-life features, and deploy.

**Estimated effort:** 1 week

**☐ A4.1 — Error Recovery and Retry Logic**  *\[Not started\]*

Add retry logic to the scanAssessment Cloud Function for transient Document AI API failures (429, 503). Implement exponential backoff with 3 retries. If all retries fail, save the assessment as status: 'scan\_failed' with the error message, and show a "Retry" button in the UI.

***Acceptance criteria:***

* Transient API errors trigger automatic retry (up to 3 attempts)

* Failed scans saved with status: 'scan\_failed' and error details

* UI shows retry button for failed scans

* Retry clears the error and re-processes the document

**☐ A4.2 — Batch Upload Support**  *\[Not started\]*

Allow uploading multiple scanned forms at once (e.g., after a day of home visits). The upload component should accept multiple files, process them sequentially, and show progress for each. Each file must still be associated with a specific patient.

***Acceptance criteria:***

* Multiple file selection in upload dialog

* Each file requires patient association before processing

* Sequential processing with per-file progress indicators

* Failed files don’t block remaining files

* Summary shown after batch: X succeeded, Y failed, Z pending review

**☐ A4.3 — Processing Cost Dashboard (Optional)**  *\[Not started\]*

Add a small admin-only widget on the Settings page showing Document AI usage: total pages processed this month, estimated cost, and processing success rate. Data source: a simple counter document in Firestore updated by the Cloud Function.

***Acceptance criteria:***

* Admin-only visibility (role check)

* Shows: pages processed, estimated cost, success rate

* Resets monthly

* Does not require external billing API access

**☐ A4.4 — Production Deployment**  *\[Not started\]*

Deploy all new Cloud Functions, updated Storage rules, and frontend changes. Verify end-to-end flow in production with a real CTI form scan.

***Acceptance criteria:***

* Cloud Functions deployed: scanAssessment

* Storage rules deployed with scan upload path

* Frontend deployed with upload \+ review UI

* End-to-end test: scan real CTI form → review → approve → generate document

## **✋ Phase 4 — Verification Checklist**

☐ Simulate API failure → retry logic triggers and succeeds on retry

☐ Upload 3 scanned forms in batch → all three process correctly

☐ Admin sees cost dashboard with accurate page count

☐ Full production deployment completed

☐ End-to-end: real handwritten CTI form → scan → review → approve → generate CTI document

# **Appendix A: CTI Form → Assessment Schema Field Mapping**

This table maps every field on the Parrish Health Systems Physician Home Visit Assessment Tool (5-page CTI form) to the corresponding Document AI extraction key and assessment Firestore field. Confidence ratings are based on analysis of the sample scanned form provided.

| CTI Form Label | Document AI Key | Assessment Field | Confidence |
| :---- | :---- | :---- | ----- |
| Patient: | patient\_name | patientName (Tier 1\) | **HIGH** |
| DOB: | dob | dob (Tier 1\) | **HIGH** |
| MRN: \# | mrn | mrn (Tier 1\) | **HIGH** |
| Date: | visit\_date | visitDate (Tier 2\) | **HIGH** |
| Time: \_\_ to \_\_ | time\_in / time\_out | timeIn / timeOut (Tier 2\) | **MEDIUM** |
| Location: checkboxes | patient\_location | patientLocation (Tier 2\) | **HIGH** |
| Benefit Period: checkboxes | benefit\_period | benefitPeriod (Tier 1\) | **HIGH** |
| Cert Type: checkboxes | cert\_type | certType (Tier 2\) | **HIGH** |
| Visit Purpose: checkboxes | visit\_purpose | visitPurpose (Tier 2\) | **HIGH** |
| Diagnosis \#1-6 \+ ICD-10 | diagnosis\_1..6 / icd\_1..6 | diagnoses\[\] (Tier 1\) | **MEDIUM** |
| Comorbidities text | comorbidities\_narrative | comorbidityNarrative | **MEDIUM** |
| Decline Narrative | decline\_narrative | hpiNarrative (Tier 3\) | **LOW-MED** |
| ESAS Symptoms | symptom\_\* checkboxes | symptom fields (Tier 3\) | **HIGH** |
| Pain Score / Goal | pain\_score / pain\_goal | painLevel / painGoal | **HIGH** |
| BP / HR | bp\_systolic / bp\_diastolic / hr | bpSystolic/Diastolic/HR | **HIGH** |
| Resp / O2 | resp\_rate / o2\_sat | respiratoryRate / o2Sat | **HIGH** |
| Weight | weight | weight (Tier 3\) | **HIGH** |
| PPS % | pps\_current | performanceScore | **HIGH** |
| FAST | fast\_current | fastCurrent | **MEDIUM** |
| ADLs / 6 | adl\_score | adlScoreCurrent | **MEDIUM** |
| Ambulation: checkboxes | ambulation\_status | ambulationStatus | **HIGH** |
| Intake: checkboxes | intake\_status | intakeStatus | **HIGH** |
| Physical Exam WNL/Abn | exam\_\* checkboxes | examWnl / examAbn | **HIGH** |
| Exam findings text | exam\_findings | examFindingsNarrative | **LOW-MED** |
| PHQ-2 Score | phq2\_score | phq2Score | **HIGH** |
| LCD Criteria checkboxes | lcd\_criteria\_\* | lcdCriteria (Tier 3\) | **HIGH** |
| Clinical Narrative (CTI) | clinical\_narrative | narrativeNotes (Tier 3\) | **LOW-MED** |
| Medication changes | med\_changes | planChanges (Tier 3\) | **MEDIUM** |
| New Orders | new\_orders | interventions (Tier 3\) | **MEDIUM** |
| Level of Care | level\_of\_care | locChange | **HIGH** |
| Referrals: checkboxes | referrals\_\* | referrals | **HIGH** |
| Discussed with: checks | discussed\_with\_\* | discussedWith | **HIGH** |
| Terminal Prognosis: checks | attestation\_\* | attestation fields | **HIGH** |
| Physician Print Name | physician\_name | clinicianName (Tier 2\) | **MEDIUM** |

**Confidence key: HIGH** \= structured fields, checkboxes, short entries. **MEDIUM** \= handwritten short text, tables with some ambiguity. **LOW-MED** \= dense handwritten narrative blocks requiring human review.

# **Appendix B: Key Architectural Decisions**

### **Why Document AI Form Parser (Not Custom Processor)?**

The pre-trained Form Parser handles the CTI form’s structure well because it’s a consistent template with labeled fields, tables, and checkboxes. A Custom Document AI processor would require 50–100 labeled training documents and ongoing maintenance. If extraction accuracy on narrative fields proves insufficient, a Custom processor can be added later as an incremental upgrade without changing the rest of the pipeline.

### **Why Not Direct Vision AI / Gemini for OCR?**

While Gemini’s vision capabilities could theoretically extract form data, Document AI Form Parser provides structured key-value extraction with bounding boxes and confidence scores out of the box. This structured output is much easier to map programmatically than parsing free-text LLM responses. If a future version wants to use Gemini for narrative enhancement (cleaning up handwriting transcription), it can be layered on top of the Document AI extraction.

### **Why Human Review is Mandatory?**

Clinical documentation is used for Medicare compliance and audit. Automated extraction errors in diagnosis codes, medication names, or clinical narratives could create compliance risk. The review step ensures a clinician verifies every field before the data enters the compliance pipeline. This also protects against poor scan quality (tilted pages, smudges, low-contrast copies).

### **Why onCall (Not Storage Trigger)?**

A Storage-triggered Cloud Function would process every uploaded file automatically. However, the scan must be associated with a specific patient, which requires user input. Using onCall allows the frontend to pass both the storage path and the patient context in a single request, and provides direct error feedback to the user.

# **Appendix C: Future Enhancements (Post v1.3.0)**

**Smart Narrative Cleanup:** Use Gemini API to clean up handwriting transcription errors in narrative fields during the review step. Present the original OCR text alongside a “suggested cleanup” that the clinician can accept or reject.

**Custom Document AI Processor:** If the Form Parser accuracy on the CTI template plateaus below acceptable levels, train a custom processor using 50–100 labeled CTI forms. This would improve extraction accuracy for Parrish-specific field layouts.

**Auto-Match Patient from Scan:** Extract patient name \+ MRN from the scan and auto-suggest the matching patient record, reducing the manual patient selection step to a confirmation click.

**Mobile Capture:** Add camera capture directly in the app (using the device camera API) so physicians can photograph completed CTI forms from their phone/tablet without a separate scanning step.

**Template Detection:** Automatically identify which Parrish form template was scanned (CTI, Progress Note, etc.) and apply the appropriate field mapping, rather than assuming CTI.

# **Handoff Instructions for Claude Code**

When starting a Claude Code session with this plan:

**1\.** Share this document as a project file

**2\.** Confirm Track B items B1–B4 are complete and provide the Document AI processor ID

**3\.** Say: "Implement Phase 1 Track A from the HHCA v1.3.0 plan — build the scanAssessment Cloud Function and field mapping engine"

**4\.** After Phase 1, say: "Implement Phase 2 — build the scan upload and review UI"

**5\.** After Phase 2, say: "Implement Phase 3 — connect scanned assessments to document generation"

**Reference PDF:** The sample CTI form (CTI\_20260319162422529.pdf) uploaded to this project is the canonical reference for field mapping. Use it as the test document for end-to-end verification.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAABuCAIAAADtf8s6AABdp0lEQVR4Xux9B3xVVdZvpjlWdKx0y2Av4GABRJp0pENCEhISktCrIEV6lV6lk9CrIEUElSpVaoAA6b3c3H7v6X29tfZJIjrzG53vvXHm5XOzf5eTc+85u/336nvvEPgt/Zb+DSnkpzd+S7+l/xfpN2D9lv4t6Tdg/Zb+Lek3YP2W/i3pN2D9lv4t6Tdg/Zb+LanSAcv64X/Mxl254s8fvmb5rvsmmCZ9/tNsgVnxwrtTxXv0u0r84Ts7V1xX9lS5gGXZ427pYGlgyQCYRQAJIKjqAUVTATJKnTSsBoglXsMv6bISBNUHagBUQ5dBkSxTMeCfZQ1UAVTe0gRTUwxdNw3DIqjpVJDpUQSnGBRY0bJu8UFB9PMESAOs8mRX8qeVr1ypcgGLSErF8FEydesHAsKyZQIvKHgvIEluQ0r3OY5n3jiWlYz5VMbVM+lX8fNk5j/LpzOuXrhz4/zt62fuXD+Rfh0fP5F102FJbkshsmeBFhSwGiqCTTIAsawiDGXEOs+yxGr4G7D+f0oWkQ1EDhs2AyFlgaRZggiSDAbe1nVRBDbWxZr4RfL5qm3erda2QcTUUVFTRmLuNW1k6PSRH84Z3m7uP8udZ4+MmPFx2LRR3WeMajdnVOt5o1rNH/WnlnUfbl0/VfEG8OVSQNUVqgsWKsmWoiDIZLCC5cAqq2SlTpUKWJgsy8AM7BOzm3OroN8oTt967Iu1R7YFQBN19XJe+nuxPZ7q9N5VEK4D7wQ9AHoQdBfoxaDrtixFQ18uV919YREbUwglhg90N2j4uAN0J5ibTx1+vUPzJZ9vzlb8OmhFrrzd5w5/m3s1HQIFwOPv7Yph1oDyT6teuVLlAhbSKUnyuJ2lnEsEvcQKNu7X7cXwZg93qfdA17r3dnv9FBQiDl7t/EGHsQNugpgHkAm8goNtEnkzdUPWccgte+ArMkLt7qyCKYAhWjoKWKCbNofFm6UqHzZj9CuxnZ6OblcK4qpDSTX6NntsWKuHh7V+Lr7t+KQFRKp0XfMFnH63TBy6MqfKBizU2BAmOZpnVOLc1/q2f7Jf8yr9Gv8+/u0Hhze7f0Szh+IbvdC37crv9qcYniwrUCgFECLEsDSShEAhkdsiqcymV8SzdLrxg5bHuC1wYKDwLqsKwhJ4FQSNCwRRWs8BfVPW97XjP4xaO/7+9i/+IeGdkMGNQga+88TItlW6v9UsouOt/DSfEOAUgdHFypwqF7AQG5qMtKr9J/G1olrcF/7OHwc3/v2w9/8w/L2QAW/fN7Thg33ffrZfmzumG3mfX+EBhXjVsEUyEvFN4lS2/G8rbnb6QRyqsBpgVk3SEUWU0E3KGogePz6dVpibG3BV6f3WE2M+CIl87d4Bje4d9N69H7UISXj3d5Hv1ohvPf3LpBK/i/HWypwqFbAsIjomB+YzvT+4P7zhvQOb3T+mVUj8m38c0jAk7s374+q/OrjtGTU3V/eLCAQL1FIf+/8Hq4RqUySNCf62UcBkwPpxNujHFnJD1AVkRulQ6hJMg1dVUSXd8O1xPf8Q8XpI6MuPJjR8OB6JVsOQ0U1ChjcOGdzkL73fdwhu5Ls/rX3lSpUKWDiiQYaS52La/b53g5DYt/6Y0OCBfo3uGdL4vpHN7o19O1MrlRll0hkDxE/MJn5qlMtwIzEzAQpQhqVYlsSIGRkHGCWzWSTHCbKko4hVATWTvafiT0UIxo0d/MCwFg9NaB8y7P0/JbxbdXrXe4Y2ebhf46jPxnpBVH+Tsf4/SsSgGLw+2rT48aimDw9u+fjwln+Irh/S/52Qvm8+NyssFTjUzjTdRP1fJwMm0hgZhXcEkMp0PWZ1qhC3KDNqVHZHZMANADgt2QWaG1Q/GByAQDc1DmkYXRv46QE5Bbz3j+sQMqgh5t9FvPHo6Fa/C69bPbbpKdctBZVTTfhp7StXqmzAcrg9+F+BEXy+Z9NHejZ4PKZx7SGtqg9vXW10h5CwN2pENX+nV9v+Ez6avHze8p0bjlw7eyojOZV35FlcAYiZui/HChaBWYwqHph+ZoYQQeVB50D3MJsCflVEWc8FKQ/kNM3zfWnmsYxrB65+l3hkz7iFM/uOHdYxttfzXd5/Kuz9kPA3Hx7R5oHYRi8Ma/fMiHa141sM2jDLC6rD57B+k7H+P0qGTbEMA8nPwm2r/tqp0U3wJ4MrG7g96ac3pxx/f0p89YQ2D0a9j/mR2OZ/6deqSsIH9ye0+HNC8z/GN/19fJM/JDS9J6HVffGtHur7wVNRzWtENqvRu8mTkU0e692kSp+mD8Y0fbDPBw/ENH8koXWVuBb450PRTR6PaVEtvjX+uFp0i+oRzar2alK9V9P2YxJCZ43akHvuG39qCjjvgPM05L0Y9UGa6XbI3oDESYby09pXrlTZgOW3dElTwdI8vKdB95YX5NwcCMgaD5Yuq1IpaKUG7zE4r8l7LcEHsg+UUhAxO0AsAqEQ+OsgH7dKzkDpeaPgnJF7DorOgvMw5B+C/CNQcBn8Z/XSC+C+CcJNsq/6b0IgFfg0CGYChwjOAT4XeCR1yBP9lqxaKLvpLuBGbVk48LNppSAplkYkkO5X5lTZgIUDhmI053WhzL1gx+rYNVMzgANNB58EXtENOkpUpmkahqbqGieJQYljVlAyiiqk4lkC6BLovCUFiTkWJmyZHL51woDDC65DIA28KOWTVIbylqogUplIjzzYMCTJEhXM5D5C0Rw1A0lDIQ7w9Zx0vSSjdrfGKZbXDZphmRIT1yp3qlTAshi2FFkEU3cHXPnAPdKn6XZ3MvlpHAEIarkkMJFZQQSLN42Apvrw1zTS5MIri4ZA2gamy+KToXDg/jnPr4t9fE3EvUu6jMz8/BQ4eVB105AM4mSYBdPAjG/gFIVXVcUwyVLBTBYCwkvQQTRB0EYun1E7umU6qE6yhxDOK7lOWMmARYmByxREv4piuP5Q3+a9dy4QNAmQIklaMal+pPuZCAGkOxqZrCzVJG2wAhGGKUi8CFp44rjnZnZ9YE3XP67t8vieuKpJcRPyDrlUznYbmhY9oVqgMEOpqpi6SsEUJlklSHl0yrLOyVSEYdVq16BKj0apgFQQFE7Cx1V8uFKnSgUsiwGDPDIW8ZoC0F6IbPdKaBvRUkWBAxx3xFW52dM2SlHkFjNWquQHJIKnKaon6L6Uf+PZVZF/Tuoa6lo5D76exO353faI3+/omwYBgzgnFYIY9VmmTQIJbeT3Ya8E3QuSSwuAgEzVwMJqtm04cV+SCwUvkwz9BrN0/LT2lStVNmDZIrGuomIIATAXHN75XKemTtA9pmiQPKSzAMCyrNjZMsgaitjSSfDyS/7v7lyInjOi5sqov34+OFE+6wDvqdxT767q/8jS8InX96SC4AA+qPMUFqNbqkw4s51CRAFZjCHyOlETTBO5qp7iyntvWNQt4D0o4LEqkiFXln9S+UqWKhuwVEa0yOXH7OAOUBsmhO7Ku5wLihflKAnFaaNcoiJUMRDQz+1PzF/cOdpyeuRrU7qPhXOroCgFvPRzVUoBx6D0rQ8s7RZxecVhK90JQa/gIfHcL4JsIU/kAGzqhVzO5AWkgAFQXGB2njxkxrc78shJxAoQUMQCnuz0lTlVNmAhHRAskzAim8CryBBXnzhQb3RkBkVNyeAPkhPHjosirsQitygSRg9qIsrsJbznxWkd6iT1rLq+e8iqjn/ZmbBHuYV8zaGUvDW1W+3EiCoHe/95XcfWX07MgqATfCCr4EKWp8nMIs/b3kYkXAEReIr0OuS49UT3xhlg5KG6iZJZQMYf8zophpU7VSpgge1BhvJIF80KSALKyy/0/KDVyJgSML2ynyiUqhqBgO73g6ZaqsQJfkFHEUzygXom90a1JR9W2dzpofUdUWx/eFXPv26Iq7289+tbBz24vNMTW8L+srZ9zdVdXv8s6gq48oBDDQ/FN2SEfkX2qrLCWCH+k8Qgyu0brh17OrT5X3u19IGJyqZhWBShUx4sXblTZQNWhcrGEFbm+/v6wqmXWrxbL7TNd1x2LgTJKKr6nZJXAw0zcjKZPlXmt5Fn3tw96saG0Vc3TL6xY2LytjE3to1J2zU2e+/Q65umZn8xNWXb1O837ndeLAS+FEQOFN5SeEPmLK1EDmbLLi/5ELXr/rzFh7a8EN76pbBWBRQJgbWhOAiOETbSMCq5R6eSActWC5mVSKIhtDhTFVHcMczc0sKtl47+ufd7T8a2qBrWuN6Azl0nD0w8tudk6kURkJFRDoCIuRjkbJ13A9i+Qgco6RBIAXcuiC6AIoAciw8aQpGv2CF7vaCSZcGQTqZcWrhtddPBPer0bvpk2LuvxHeo3bNJKihnXZl+ULhcfKuJqHKyjHSr0huy/ouAVWbepAgCEzkWywYZfsoEcZzkxElkFKQpRF0LgoJjFgQUpBSDxU+V28HpbUwep7/tqD2Tier4QjeIuarndP7NxNMHOk4cUC++U+2I5tV7Na0W1qR6RLOavVs8G9emVt9W1fu0qNb7fczV+zSrFtOsap+mT/V+v2pUs+pxrWontKnTr33VyMY1Yj54PLxx1V7v14lp3WxkZNzicXuSjyb7sorAz4MhMBVBYcoBrexgVgabgpa1tlKn/xpgYUcrzOBYBoeyTGghK5NF39rxUzoqdiivaLqplS1PMFBs0sryT97640Q8UlZMVZEkIaAKSG9KQckFPofcfHwhyCW0wFDjGF59IPmJhkmo3AVIAhP8IHNE2DQXaHkg5oOcAYFs4IpAdoKEMj6ncorK67LAVnP8uOj/Zem/CViMi9GMlq0fZduEUGYmMikm2A6PwouyH5hEsEgk/rnxs4B3ubUgckiFzKVAAfJlpM4miHTPJKTSp31hX1dclP8MSyQzu8HsFBTnR4HNiqryvOLnKj1B+tn03wIssu+QhYnWwGCqsI/jNd6R2MIYgTzEZd6Xcks3jSf+KdHjlvhz40kytGUGVCloKEFT9Vtkj2ArAJmaRq+lhaYymHaIH7uga5mFAdrORNVki6U1RivZs2SCV+SApksWCJrGK8xk9b87/RcBiwda5SkBrVinW8QKiYUgDpjgpbP4TBZaTno9aIquq4ZJBIu8KwLzsfzzZJF5S0fNXwCdZ7K5D3Q/mAGWOZZ1Zq34J7mMqpZHytvZBqJNWCu9KeGXpP8WYDFiooNCBIsEKZSWkOPgnzbrwa8QTPY18R+gABX6kw0jUS2dXf8cpaBSGC4oSoqetWxfMkOGdLfXrwIj9nXFBbuuuKTyrLtea8NNrvzWhJ9N/03AQqlc10wTyYnqN0SkKF6N5y2FnL602sEwyJGs6YYkW7JIyiBJ2Qp9pyooZKO+SB7Cf5osNvzKXaHstgBXBlBmAyM9jiQnlm3Z6u4Lewn/j6HGfIQ/yj+H8Eqf/luAZZDZST9XdHvd6f2rk7+ef+GLuRf3Lfh+35IL+5POfXmmICVfdnuA33v+y00XDyw7vfuz64emnd486/zOGUc3rjj3eQkEc2WHn5Y1/LNklJMliZEVm2z9QHXKssFciP8kkwW9IiHjRrlNY5YFiUmBpBP+tOT/delXAtaPBu4f3dXJIGlZksCLrvoLw6vu6fvQ57FVFocucJzIhSBH1AwHDLKM4KgDcxovDnvus07Pr+5Za063U+C6bPm9bKmMX6Xl8pqgEIIsWouqqkw0U0B1SviJSDIYZdIUYoJIs1ySQAKcLAuqEdRNkYFP5FSQdDA1Q0fxzvSpomIyCkeLD1X75aJKMRGmJuoSp4qcqOuI1CBSXPzOoPcEsRwyriEN1CSyX5AESWYTlcWB2SYVG+s602tZjCB+p6oyfuVxow7Avg3iy8xsM5AOgUK2Sk1hgRrEkSUJG0wg9ik0UTjLDVYJK5omDK1ho3Vr/5H0awPrHyT2hWVzJ5nP8ma+nBQRsq5VlRXdxt3ZiqiSqdsNXhSCpu4G880Z3WosbPvY+g+rreu+QDiZAgG/DQUm1pTyft5AOEGpLHjAKrLwESiSJD/zpRRpSkCm+GKO9b5PFiRFxLH3Oks5gXfLslNVckyllDYhsshhIwUdshcF/Gy3myGOzGh+hcfxR7Lk1YKGwZk+p5CVBZymqRbPlAzZVL2sOPAJ4OFRUSRhESGnMCJp4BQCt6Upqs5ZFlXe5sOKIMtenYIBlVKVt8OXXdh6xYISFwoAIshBTUad1o6g0FXNwA8KdmXaMFN8cHa5WNG0uk37T9rPfiVg/WzCfsgE6Sr4m28aFbKj+/3H4mO+W5ACDg6CKEWVmoITNA8Ix0uvvJEUV2VDjwfXh/bP3nISHCRVodDv8WHX8pLXK3jswNCggIOkFfBODqUxXdY1RSPCRyD2goLZofgC+TmAsJEEUjFBKw163MWOIlepD4cQBTgT4cFrefng8vKlnkKNyzNwVAXOV4xDKEscD3I2ODK0gkLDia/wmrSikBQDjUW7i8wVaZFKkgOeEhAFIloarwgCmStMkBRBRdkQoa0jbghRhqCqXofqDpKdVs8DwQu6Oz8XOFqHhgSIo2gKU9FU1JxlpkdzIGaDXAC6E28Q6SOlWjIMhB0rnbki/hPp1wLWXVyvoqk/uVEseWI3T38tsf8fdoX9aWWHZCsHp6/u9ZiyrFiaAwLnhesfzI+8d3nnkDWdO5xfcgxwhHUjIECA90Lw2+ILs69tfylp0KuLYt5fNuCT27v6XFxdY0GvF+f1/k7KuCUW4BCeD2QM/HLRc4t615wT+sq83jngv2MWtJzZt96c6PdWDbtpORAVtx3pk79c1W7r+KeXhf91VrdC8GFOA3+D1aPe3jKm3uye+0tOB80gcs7DV440mtbzlfm9Xl0R/7mVl2U3REPeyYPLDSq/7vrhDzdOfnZen9e3j6y6tHfzHWPHXd16XEwD8kgLhRA85U2bc2Hnq5/2enl2WPPF/a+BNx2EEfsXdV03ptm64W/Pi4nZOb0EhHPuW9ErxtSfEPrG3Ojpqfsvgws5oFvVfGBGzRpc79OoOQUnUkFzcB6ijrKu0iaDtHsOcc7/bcASRVFSZMy2doUsaeHWZW/PiHzz8xEhy9u+tf+jK+B04DAHiz204FhLhYJOif2eXtoh5LOO92/ocxJQ5uAUkwQWpDl1Z4e/vjbuieWhY4VjByF3WfGRV5ZH3rui6wObImqvjrolZUvAf35879g9i5Ih66WFPWutDn98ZejH+XufXxjxyNJeD+0ZFLKpT9+sXUvzT/TfPP0L/UafKyse+3pwyOq2k+FG069n1Znb5wCU/mVG55C1HR7fE7sDSnsvHL7gwJKZF9e+uC764bXhDXZMvA3kFdQkGRG8J/3r54c0+9Oi0Go7P6qWOOQ4uL6FosdW9ng8Mfzplb2LgfeYfPOPoj4+uHw/pN6/uWfI/siQxG7zIb3mpC4noCQJrj61o88Dyzo+vaJXi+WDpt/cu8Z37o2VCY+vj35x77CRN7boZMVF0gtN58VWXd67yZGZR8BRhBxeRkKFdJFCsJG2aSw87D+SfkVgmT8ClopJ15jCTosbUDR5a2nfaltjQ5K63Ls3puqWvs8uin9+4YC31oyvv2DYK5OjaoxvU3N1t4eTOtXYPeC51QMcgAIySiW+Zd9vf3VG92e3DQyZ1T7syqo08KbKuQvObnhpeueaW2JePTyq18l5RXyeAVJmIP8IZC28tqX2urA/buj+4JEB9Q9NWKtfSwM+BXz7ci8WAodyTAC4r4pOvz6tyyM7o/68p8+TG+OHpOw8Ae6INZ+8s6DPk1vCXv5udPVdg78yb2eB56UZ7R/bFB6yLbzhl1PTKFxeQGFqT/rpKuMavbS77wOb4uNzvzxKr0Wm5nl2ZbcntoQhtu6AByU7Ly1p5FvOiqi9N/IPB8NqHRz21uaR3yiZ37qvtlnU9+H1nR7c0uOpjRHnwXuDgqGViOWjXloeWXNDeLvtIykMjIQH/bmFYU9siG13cv534CsFmfmpaN9AkfkqeFoM959JvxawbMNPBbZQIFIU1NJR9pEM2nP2SOr37+776IFN4Q/v6RNxZckpKDoP7hugfQ/8JQheBbnKlDYPret6/5buzycN3GNmOQSXaAaKwfn0ytCHN4T96dMOq4Wrt2i7KhkHrM7M0L8mJTySGNnt+KenINcnOXWKhjDXeC/XWB76yIHYkLUdQ9Z03QY5p0lKM4P+gF03VVZuGHmvTur47ObYkB29fp/Uc49x+zoEz4G7+vKYKmsjq27sUWdV6OdGyjVwLM76osaW8JDtPf64J/oQuG5CiQzCJ+tnvDqm418Te1Rd3XG+9+w10ArJEqGsP7O9+trO961rX31NqAtk1BsyQBxyeOlbmxP+vL39Qzu6zvUevQzCJXB2Wv/xcwt7hqxu9ej6rv1S1uQCXyijlKjMTpxff37440lda07/QPG6PQDXQa+5Nqrq+pgDkJuBVFAN6OX+AI388rQ0rbJTrL8DFiosEmrWJi2Hv5mZFjl9+EPrulf5PPqetV2+h/xMPht/7C/yoMji1vidaaef2zrgqd1xj2yO/DhtD440il/FelGrub1CklqH7Oq6SDiXZ3EKJ+VynvHf7/rdvkEh23v/aXvMd1CYBSWc38X7UbqHthMGPLq2V9U1oc0TBx0oOkMCkUpSiKiZmQ6HwGKLX5jW8+mNMQ9uj3pyU/TA6+tKIYC8ePaxbfeu6nPP7ri3j488BnnZULrs1v6aszrek9T1wbVdmh0YVWAVy7pnx62v3pwb/vTuflU+71Z1fZdUEPCFbp/8Vc61V2eG3ret68Ofh1VfH3obqDYzjn1ea2Fkla2oAjdrvKNPrl4kgJZmBV9aOfDRDVFPfh7e79rSW+AVLFO0ACWGoWtnPb0uKuRQzycSu4KJ8wfOAFdrU0K1JREZwHksjjY7ZWYXWhnCfEz6T0bhV0y/FrAMCnfRUaS0t/th5m/R6ZYU3gmBD2bE1FvU+56k7k9si2n69fQ0Ck0B02PgOGuifgs8786LeWJdj8eXtX02sed+KLlueHWJX7bjs7oLuj+0v3vIiiZXwZGre4MAkdvn1Ng84E97Ip7+sn+VCc2R2mWQ2g2l7oALTByYe1Z3fGFR9z38hTRwSLT02dQlQ3ELVB8NFTPttXWh969oUWNP7FzXyQuAX/h3n93Rfk74Yxt73LO800EouAOIenfjJb3fWB9Vc0PkS6ujz4IriDopSFFbJ9ZHpryy1e8PxnbPSRRRe0SVU9fqTol4dGXvGl8NfWBZl3G5u89qGcgNX18Z/edVXR/5AkXDHpfAnSPmu0B6e2LEo2sjqh3oNyQ3KVnOUkzyk5aYoqbzk9dOe31FRMjB0Md2RBYH8lygj/9mU+1lsbMLvkmTHRTdaJLVSmXmX7JsMAfYfyr9WsBidkLbH4efSCRQvHTxPiQGyeCqv3HgQ4s61Nod/dL6PtuMZNoNzbB3DNI4XWq+KP7lFZFPbulRJ6ln91NT7gCxTpRS2w8Me2NF1FPrOzbb1S8fnKicn/fnt1kx7JEV3R9Y06r6og+28sdOS3lTtyXh4GKPT9m2oMbuyIe2hiUJZ1KgKAhCgGKRVY4TgNPB5feCOnT/0r+sbV9tV7cqn7a8CvwNCCSlHmm8PPqldaH3rGj93pdjUkAtBNjhPFdnRdjjK7o9ldR7gXnhAkgnc2+WmHzM9ml1FvassSvquTV9jgDqoT5kjjuvH35waa8Hvhjc/PinqzynC4E3jMAtV8pTiz58YnVo7fVRJ6Ag0ypFaEbMG/HKrIha2+IeXxP2DeSuzTw+fssK5GtuCp4OTNk66+n5ne/bF/7Knn468GvO7H1vatxK3/eXaeWGjkIXWxpELa0AVrlj4T+Qfi1gkcOYFBmeZYEshEYRwDEtf/CZxOqb40NWdXn2UPwCOHkaigK0OErBCZiluM5DcbXlofes7RSS1Pb5vQl7oegSkX2rWBQmHUqs9Vn0fUvbNdo+KAU8fRPnNp8+5O1F0TW2RD57ICIybd7krKTQxAm7i5PdANO3LGk2LfyexE73J4YhJ3Kg3CwJqLRTTYJBzR3Qg4F553ZVXdT7gZ1hf1n9Yf9vF9zyl+SDUW1e7z+tD3voYNzLuwd+BQUugDRTjNo3t+b6PrV39fsUUvqnb39+Qq9cEEp06YvCi2/N6l19Xpeay8MT4dZm34U3Z0c9Mzvsns8iXvlywmHILQSlSHWVghC6dNQj68JqJsXUXdc/DTx+EM8EMpstG/bQol7V9w3tdmvlWzNC+xxefggbSoZcCVn/R4lTXlkfE7Ktc6Qjacmh1S8MbNs9aVIGCEiusLtAEilKjAGLDPsWQ5XKxI//RPq1gMXsdbKpC2z5OUoY10sKO4wd0HzKgLozYp9YFPnstsH3zm5dZ1aXDosHoKjh1fgPxwxoM2fECzP7VFvX57m9g6onRr6zftCL08MOQWk6xWZBIRhz847/+dMPX904+OOvEs+o7jtg9N47/aWkvtVXd+10bNInNzd8BfmoASRdPdpmfMx7M6Kqr4sckbm3iMzmBgXQkA+HArxMVeF4b+jy0S+viH9qec9O+yelgBMl37Sgu+b82L+sj3t8S8JOMyUNgvlB2kBrxvd73lo35IVVcW2+nJ4kXb/AZCbOsNwoL4J79rVd1RJjH10f/fzi6LdWDGi7bfwlUG6C4LMEJNJOSx7ydVK7fXM6fL+o23eLNopXSoHzKX7UTDtsmPT4kuhamwY02ftJGu1j4y4GWitG0qkhT9rwaY3ZnUK+Cq9yfkS92eGzbu+/A4pDcNPWzYJI0R8qieq2k/1/C7AsOihEp8g4Oy5PtwTD8oHhACOHOl3GjMPGzNMIQRr3AjCR71wCEYckE/hi0+sErgT4EtAkFeGJbzF9IF9n2wmhkC+zuGUfWcO5O+DNQNEfeG+544z2+QAxGTwFtCDHskMFLaZRqKAzj6LsgEAO+DIgkEsPKuT7A8gA9RYIt2k7eJLAJHYTSeBN8F6B0lvgz6dFFnQMBZDdGyug5QGPQjfmXPAXQ9BBtgYKxCDLOMnhNK+KwUgFVy74XGQ/15gL0vDpXD5IKMNhHTyGHzVcnWz0ENRUlNT6rZz43MLwkP3RITvCD1npeaAUWv6y4GzaMoCCL0QweYqLJGyRoeE/xAfhVwMWjW1FdIptvFIMwplhabqJtIM8Ifa+B3RFzlgcvBK2KobOJ2GDbLKYZBqbgAlBAwTd/oZEVL1c8aS9EcgsSG+zV1BUhMeYTEuSSIEQGUcmCYStcVBoMDQS5UURFM00NNGiMEAcc1qoIWhs01Da78EOiKCQMEtnWy4rpqVYKPWxMCxTI78vj+XrEigsqzK+zd4diWIImUePRAHbJGAw+zhNNSzFIlFP1CUdJSrzUknavvTvzvruZMuu676iDZmnmyweVnN2aMLVtQfgtgyyquArdTugnjWB1naXA8te5/0fFLF+LWDZsZc/AAshpZFAQE23+1qh/7G3OZN8tB6wvBTvQP5UHD2KSjHJ0IxoI8hoODspggC/VUw7WAv71BCJ9pikFpkEP5HFL7DXGmx7YxbNIpNaqpQj0g5wsStFcYK0sy2hUDWtIC0HIv7CNtwuo3AsNMsgKGhYqgyaQJ86/oxGEv+nQ5vYwhxCoWUqFjn1qA7sHSLLhCuTYh9kUnxpWxG8SZHzSKFkipIoMKWX+nWuOzuy0cqEPf7rq+8cbzR7UO+d8z4P3AjYVRQkRKHBaXYIt06Tke0VQLHcFH3PgvHpuINKDixquUWdTtkgOiJS9BKNLg6cTaWwo/ErHAzV0uggLkkiuUHRNUXlDT1YZpoBtj2aSuIqxcQQSiRawmMwDy8trqCBJ+ZgL5NA8Ki0wz+iA4vFok1m72BDQY/by8YYNSUGC2wJPls2gcxbBiQLCkfL0egrhCYxQ5V5gmnYNN3iTbIxacjZBZ1QrhGkGHIVqpiPCZREdG2qqdMEo4AwJmNTlVWqiC0VkWcP68rCH9annGi/cWStWe3/tmbQwHMbvwdPmuYqRr5qabLC+Vh9BPspNito3ppsUyXZpD4lWxYt8fgvAhY55+9KbtpJUXaxmgb9AZ4CMlAkUQ1FdlOYEfYyhawY5TZfCgURZHu0DDZNOUaS6HmBaAheeO34dMEQXbSg5Wx2+qSVS3Z/sVfieMkboOGj7YF0txD0+7GTocTlnLRsfs9hAzJcTkKAbChE8+i9ODdF1su21CoJdAwTlu5wOHTid2aAfkv3/Irot2RdV0Xax1H25hdiQQFVCjDQUyA00O9sImdX3uYxKqGVRolnaGQTgUxypknZDvSzWS4No2FrZdhXHF66JbIFcBTtQEBWZFEWJVOgoC6cMCazPNFcYiZyErh1ZIQyuSUMWpEREBWPobt1stQ4ghynGbxpcYapsD29FInIG0HHLJcEKLAD30yvVZhUoNmzlzWQMMjaRcPE7tPv7LazKG28lk1iph4K0DUUZOWmKXFBu25lGLWv2D5Qenno49/D9x8Ay04qBTUBx3HzN61oEtP5+S7vj581LWnrZplpv/iifQe+SJj2cYOwNs16dViyYS2nk3mJk7BXGC7twaSZSqsFfeQxLd/ZjJEv3uXHlvnzHKKkJF49+VDXxsO/2ZhF4ryiIDhUXZNkU9UEQUAN/wvHrT+GN647qFcOqE6vTyM2x8ZEIXqjMQDZMxdhxPn89gEkmy58+3Kvti+3bzr+4zH9YvrWf/edmJlj1p/7avz2ZbRBCD1pYhGWyo6WUC3OZo52+5kkTnPIsMUn9nOrol32CkcSEsu7uIxyUGKvwI+bhZmthkQ8/MHrV4wS1DxYHJ8u0N5voLDzwWgvB0kDHumpwcsIcdqkmwol2gO0vaVO/+O0adYv8qVurZ/v2MJDAoBBVFIgkRN/LGkEQTbWdE1704PlEwSaFAr5Cs0KOYThz+YMtNaI1bOs5uXQtFhsoKgqNHmQOavIeW1/NsHoB2zdtcHYD/fvSv8AWDiWNqps0hUEPXL68KdDm57NuY1qeoEYxAEoFVDONM8XpT3b9b0+88aiSBTQ1KBIe9VRthEF7FpnhIRNEeoyqhOKB5pfRVJgmhxOddiXfvW52A/7H1hdgKIViSpQWlB08It9gi8AAhJFyAbjD9FNQ7o1uEQbmtHWUn4wBIsNNQvFFOw1fjitNeRIsPfYkYYRnf/0wRuXQbmNSpnDSWVbkHjhm8e6Npp9elcOiLyBwFWI4insxADN8jDKqmm06xW+yw4GlAzDTQd90R3qfSIJOFWIDRJrJ6JF0cmsf6kQ4r9YH4HmnhfM0JUTqyS0ePWTiHTLoxmyaiFvpchUoDdrTFZkvNgOdbQM3lAVRqvwb5xypR4vTVeApNNfD1r26aLDnyN99esqSXKaqUuaJmInAh8UAr4gqkG5gn/G+pVegwU1MCTZoKGtBnWCMdXQpsSsORJ5rBk/YT+j9VHsoCsiVKBlegrW7NtCC3HLhFRqZhmG7HZWnArzd+kfAAtRZf/U/vSD2m3igNpxbQ5nJaNWX2oq+ZrACKl+rjC1RmSzD2cPKwGV0xVRxgoRfgXaJ9gooY3tdFrkgLIDnalGywMlWmilpwGfSZuhyYEA/gXn01PqdGw6+5vtHuIayvRVi2p2aDj56823gfOSUINDq9fq/+H9/dseBjoQkKya9B7Gg9moVLTZHfQjnX++c/NnQ1uO3Lf2BhZkECWncdONICn5gU82LnWB6uJ9qGiWmDzpe2QYM4qYQmAwxoSjjtQxh06NM9NAyEWOb9JvNAZg0aITWb2geuiT9Ee2HJIJ4EyGcztKse+X7t9UJazh26tG/DG6QdyS8cjhRQVJqU5ReDIJ/y6dv+krOFV0545QSsc2YUchG7S0QsV/MPvKV7k3HIxYYt+yIwt0H/FWDqHmMMRi0EvAOJZ8MSXoyJP92BtpvOuv8Z1C2tVLBbXQEpEi4Cz1gsGxw2B5S/OwcSFFgXWIQGOkFeCY0jEINKWxFM5m5Lq298yR13u1Wnhs523D5SZZk7D198Aqy3+X/gGwfpK8Jt9rypAHwxruTb/kxEroMtbDy/rw21sXq0S+12HJ6O8LUoOyiKg/dyu5aY+OvcYMyQNjZ+qFR5u/2eWTIUXluzDWbdcsfuzIxP2767R//5XYTiWmiCIFNuRE+vWnezSbdGJ7JiHJHLdv7WPDOrb6csGsvJPbMy/4cGgN3wPRze4d2LbDxhm9hw+s26xR7baN3ksI23P+uKGxEWHTna4VIz1Q+mRYcySBVw0PrVW0qEdouSKyLdUMosjAkysSf70z9dybA7pP37x8cuKiZ9s3eH9sHx+IBe6ShetXtQ7v/mTnxrPP7qvTpfkbCd1e7/1hXtCNOmnLvr1ax/c6npu8+865xkMj2k8alA1auuZHZBMZYAqBTQ88pY43OjZZk3b8Aoj39nzzuR4NURUIKgHFlGlnZV17P7zjG91apoN00JFSre07Djqx03QI3kah7dee+RKl9biVs57v0MTFB/Z/c7hq43ov9Wj1RkSHAGoSmtStf8xbUZ1TgLumuZtPHJBO24nDpUBhSFiDPwxuuyOYdqw49didq3kgXZFKuw6Jm7957Yh50/7Wt1uNLk2wFTnO4oVLl7z0QaPaPVtELZnSbmhs+6iwZ1u9+1Trt7ZfOc7EYD3x7MHn+3cITZyyNePMkZQLtuaELVMp7P7/BbCCSrD/nLF1RnR7tkuzl5q+26R921dbNmnUtUOzZk1a9uxYZ1zoh6vGlWhBFlNl1uncZMzmpVkg39Y9OSDU79Pplaj29Qb1wInyQZ/uk7avDNISLTNicFy9yPbIFDguAJz4Rf61x/q2GvVNYiHwPjV4Oiv5kS7vJBxeeRE8HrIqai4Q/xjZsMrAtvuUbMSRU/A9F96yVmTL9uP70wGCIioFJu1gS3IQ7L92tnp8h/cnD8C+psA3iWiewMolgQ9JPVI9ZuZ6pE29qMQZmeDLhkDPuR89Fdvsy2vHM0tyBLZ+9emo1i/075wH2g0IXtOcHpAbxXTtOefjPDDzQblDm7xzdfq0ezuh5w3RiZSsjP3bUj9JXfqgpZMLQbkFnuejmtWKeO9w3iUP6S8aC0MwH21dr8OUgTkUV6Of82Uhgb8UzD2ce/WdhK5JN49lgHRZKFqwfR1qCbyltPl0eI3BnaoP7Zyqe7F677f/oEGvDlkWEnzzmuxwcl6bf1Xv2fSpuDa5qBziXJa1uZ8teiOsjQvMDMnlAL1G75Y1YttcV5138jN5kesxZkDV6JbXgS8i/ddcdf5Q9YgWw3ctLbUoLg0p2T093x54aHkyeJHAo5ZDAU4MVSQjlfNB21z4U9D8EmBpEh/1cf+Hwt/bdP1UqS6igBFgXB+FjNOXzz8Q26TdyjHI+3J516IjO+79sH67uSN7fDo6dsTA0eM/HjRhVMehMR+MjkXM3XEXMNZmekwxbtrHT3VrnK37aX991dyXcbFm/3YDP1/iQX3F0lPSbtaLbDv52JYs4BUV9X0F0fZo3Af3hTe+DSoSDr8Q6P7ZxJqDO7WcNTRA5kCDdD1dZtIKfJuR/HhEi1cG9sjG/tVpqQomG1tBRmupK1QNtdp5R7bgXJdB84M478jGkO51T+RfRs5Y6CsNgla7e9NF5/YjF840/VjtrQd2P93qna6Lx304ZciAyR8lTBkd9+n4FiP7dBzVL0P0kPxiG03K7FX67I3Lo5dN6DtjRJ8x8Q1iWj/a970XPuqUAm7RQKlbcxvc2307Pde9yVMd32k1If6yUkSTCssSS+uFt3m2Z9Makc1nH995U3cj5+V0qQPivn/7R/u2uiWVBkB5sXH9F3u1qtapUePoLscD2bScB6eQO/haVPtace0ydZ/k9YFfvJl5BydzgUUSRSloNWPaPBzepISZIXSO7z4y4cmYVunAkbfDMm+B9/GIJuOPbnTRNuJaFnDPDO0wdP9SnEVukOxTzUiNtRWc/7FWWJEkMThk6uhq4U2/zLriYxtpiswIiRPzzKUzD/Rq0H7xRyIoDjMYtWh8SOd6SYUXcLQUmXZEx4d1Og+XZ/ZEte34+Lpdm+8+/3W3KYOr9m9bAHoQh9vjP5969cmO73x8dmsu+GVLOp5yvnrvZnHfrEwG3mtyhsxjy++JbITgvgYeyeXSZan5lAFP9WvTeNYglyVKMmexvfwDEhJA7AV4LbbzU50aHi5IYfIEGQtRTMZ5XwRyFuhJX+2l3YzBPJF3vdvo+LWJK12Ce9mBDbX6t96V/K074ETdrdjveCOs1dJvd4pkf9c4U5w6a0r9bh+csoozybxGJ/yimOUGDcUdNzZWZ+YKZkVHcfh4+tWXOr+fCkEv8KrBOyHYI2nCfVEN4zfO5MinhNKSmCOVFoA06+iWOvHtHm//Nx4ZpeBFbBbK7mtiwYNhDR6MaXp/5/rMtKF+ODb+xbj2rwzoXKT58M5NV3YGaLMuffFY76aPDeuQgzqNxRf6Su6LafK7wR+cAVS5VcmUcoD/ynO7QacWC1YtLhbdj3VvWD2udS4IZLVX1QFTRz3aq3GaxA5PVM000/Nc37bjDifiTDNUAeWqP39Yd/53u7IsL8ckCoMJZ263Wy+3+Nsq4S8FVoUdy9YNUTKN/mTISx0b77h+Ih81FeQihmLRyhY9xZFVK6xp7KJPfLzXqQW2Xz1aM7ZVp0Wj08j1patBP0oSabdu3MlLQ37aqEvLEftXFoGeLZbGjh38TFizQta/wPOXs27W7ta475GVxaCWBEovZt+sGdrko+MbrpilJJHoOo5r7ZHd/xTZ5Dzwsix7ixzRM8dWDW3eetGYHDVAreJVlJd1IqU6UvI2/cIQwa91xSLEdMUpknVc9fpdKDr0mTB0+rGtNyGYB8L7A3q2HRuXQ/5HfsM3e2q1f+fbjMssThzBJDcMb79gT2Kp6scR4njfmavnXm/TqNuij6+DkA1ivuTHLriTlZGfn4/9HfB4S4qKJQUlTVXQlNot3170zfYCrlTSRUFEhiWXgFy7x/svRrdZffEQna1iBo5lXsmBwJVg3jW+4PlW7zhNDvv2/PXvsev8Goecsc/+JfeGN0QQSwrfbfaIp/q2/EtCy3yQCgOOnVs2CrqAiE8BT93Rvb7JuxYkvUetMaJzSExDZNNeDiV1PXbqyL/0RqFKVMSA5HPXH9i1alzLK+BEqgmy2H/80Ofi2zpBFVFkDwTx4r5mL8/8ejOOJo499knt6JaTvlx/U3Fi5Qs5L0/TiaxuFZtr/JP0z4DF8zj3AMEUvXhi1c6NZny3GyXKIorCM53UcnFv2oUHezV+c0LMrqyLt8FfAGbbSQOfj2n/aJeGTcbH9Vww9rnWDfpPQ0ZJ4tffIjv8vtvbbw4JHbRyVvfJQ5Emj/16I14fv3Z+T+r5OoO6DDiz+SKqU2BeVRx1BnR+fVLMCatkxrZVTktE8f/BQW1ReD8KHI4o0qE204c9M6xHq6Sp2RTmQAaIYpCKdL7U5yrlvbmS54a/sMtH8bXbvBs77xNsQobi+fzct6+0bNg8rue0o9tugZIGXO2ezd4YFtp96Sf1Erq2mTb4wd5NeyXN3HbxaJ7F5YNWrct7Ces/zQAhH4QcxZuhefPBqPdJn0cimjYZn9Dr07Fh00ZFTR6FskuhKRSowSJLzKdTUgJrj+5/OqJlw7G066mbYtvNHJDTQX+wZ6O3Jsc9GdH8ouFMA/GFsJbzju8+KeVPOrLp9b6dMkkAN7GUYUumf5N7/Vsh5/lxEe1WjHeaZG6OXDfjofiWIaH1k0G5Zrrf6dV+WOL8w8Upq4998VTX91C/8SHZBvOlAV2eTGibYnlPnDk5atDg+Xs3PBTasG5Em6GzxkUMjn0l/sMn+7TYmHF69JLpt4oymsZ3fyah3SXTlQscFnFGK348pmXM9gV5RiBoyShItFg6+qVhPdZc+eZY6jWnGGQUGYqdpRI56H8A1j8E2D8AFunNQCZg+wKnVwYEs5jX/YbhdpKLQ8eC80UP8vLL4EfCexG8qJZnBhzIJW+48y7xhSO+SZp983AOqeIkoQc1Eft3U+a5Zcf34JDnWMHTRsmXpbfyQb5ZmIkDcEYpugXSOV8OSpq3ReQRxucZ31/XXTcDRTg2qabvEgQvgXwVKRZAQWkJvvkWxahAJm2MBgU+V4CIq8n5kJuYPlPygIr4uGV6T7kzvkj//qw3GyW2AhCKRBRFUfoW0l0FOJDbb59B2fwCl39JLx1/Zueia4edhAY9VXVflkvSGaqyBdS3pQx/CT540XId8aV/60zfcvHYHY0KQ1Rlcq480Vei05KHXC2IdDcVBBx+RDNWo0Tn7kjOM77smyAcl/O/E/KxOUgvC0A8lHbpWPHtG6anEGVQyZlvBhEitwJFN4JF6cBjWalkSjN1DTUA3zWQjoIrBYQsEG/wxftyrhx13HGAlA1SgddBwp2s4n/J4M/SfH58E/ak7EwGednFg/tzLyN/OC5kr7l97LD3Dj6CktMN8F6CQLLuyjWDpXIAlRLs5NNqUaHi5xQB63AFAse8GUezk4NMJQxqsl4hqlv/OrAkSQoEAjpL9iItMjUzgx4vSzoKGJJGS+c0RAzHETUCH7N94n3D6QeKBlBs7VdgbwNkD0W0kjiAAjPZJEn158HiUCxVsDCOHV9DqixmFw0WLWpA8dDv9QW4oO1kE8gqptHZ4LxKL6Qth7BcMl8ZqGNJmoxcGuspk8AumBrz81h5NMzEhgoMvsQUsXfUAI8tIqqsgcAhTE0n5w/6A1g0yuBCeY8ZrES/IrItTEFy+20Ta4nfI4JRGvTlFxf5eQ77B0UgqgBb+GX3MS1Asu3DKG95/SgXYCfIJrJX02vIQYPOeNJVLeCioxVl5rEo9Xmwvchxg26vpqichCoF5LhKsBqAHcCTPwwx6mLr9O3+weq4RAQER+fzWMzSoZD4mxF0ujWRDvxRZIGZ+nSmMiM9w+5XaMRMWRKwYYg8WRbt8xNQ9qc9w8iHYfEuLzlXdSNoqlg9X8CPA4pdiiXia20BqQJYdwHsR+kfAOunyWRbaNrmCoPt+kOmZ/ZJHlw7A9t2gOIO7A0zaJ8M5mln5l6zbBtI096dgD4NxqrZ/tR0QdSRPHblv1HZ3pBkWKcpQqZato0nfStSbAlpJcxm9EOV2LO2AmxLlPbBE/ZyYHqD/WYynJGrm/y1dnEac+lIVO+yzQHvttDgn3RWjr2TYPkjZKUu83JTpplnv5x6gLJ9nzqKPUV3yutQ0QllfWjiNCPtlWxEzA3AhGScO6jJUpyXwvZg0A38IVELjfVM2baa1BByd5BOSu5npAUIFHzK9gcQ0rGPLV2l6CRackj+aaoMcxaY9tHFZd1rC+NUBHuV3fn2dDdZN5J1tKIJdqZW0v2fYuaXAIvNBFvjocy8nGV3FHZN72euLZ558v3swjZDa+xMGwpuuetZ+3GZeRLsAAcibOU/+ElZ9i9ldm2TNFsTsUlCxdESdjQSOWgqxo5VjNBnu5W0MiOTYlmlQJtnsMdZWJRlv4vuMNiVlVjRxvKy2E2LDoou3+mPBpVdWLZTwc4sMIc6Wy9/Q0UTtPKm2dXDVwkWknza70S1nSrM9SmxLVIYcyfLDsfqKbFXlbWI5grLzDNj9/YP2f6qjNJbfpQNwEBWwtNiw7L9cOxrtj0OjZc9EHdnu+Z2Q2xj1U9R9X8PLLs77FdVYMIuu6wNFApCdQ2UB5rZnUck4K56340Vu3PLRuuum1iE3bNC+R27OUp588qbXTaB7HlmA0ujCVrW6RXwqkCYnTXau8EiHmpQ3I49oqxm5DWzx1W5CwF2xew4KvIklv2W/LIqtZQsZBJzd5SDjCId7K5TyxtiN9+ukl03nX0rghVkvimBQZZZVikUzD7jzu55e5WAjaqKKtlzUrFrrv9QQ3ItM5DZnQBUHCPJNtljbifWxYwsMTIvs9IFVpbd+SIr0a4Aewd7GUs/QpX5A7D+Hlk/DywaKlvI+gFibIRtaq+Xo5qxQnK0MQdO2fjYk10tr4b944oX2g+WZ/qB/RVjMvg9FVFRKN6XKd7ItAFE5Lo8xECnHa2ot8jPdNd7WAyMPa4V2KXKG+wPkf6mXdusslLwRtnQsWepoRa7JmJSNnJ2N5NWQ9AwKBxG1Wk3OPIJG2w5gz0AZW2kCDPUguz9hCr6UGXFlXMbaiaLVyDaib9h4cv0BtZwmr139bbJ5lhFo6gtbPsZH9tB3o4mIh83o7GGHQuksy9Um9CWiQpkMmChGYzcUqZqs4aTN7RicNlws/x3qPq/B1bFJCsbM1YY9lXA0EYtnYs69rVgpsORaRmBrZe+PAeOfYGb2WIpPuHyOL85eyqlNL+QD9DoaChFahwKuSq9xEYXvoo3SCa1I0kEptyJqiZwFFklB0VHwM8jYssHhk10gxRkHVVO9WZeyuHvvjxy68Te20cdtGm2mS/yIq9QLAoHTl5wWEqA1hpAye3sPF0oUoVgqRc4lbbRUiHg8OSonAvFaxt2KL3RqV6AFcgHI4skeKqTnFfSefrw9kvG+C1Z0lQcRQEJXhArYhb7nKezknfcOX3Rl00H8uhakd/toohWUBXJK/sCitcvBC75ijaeOrrp1LdHsq9LqAyoHjpMgGkGbEEh3DZR3WMeE68GAS0Q4CTDKNVlN80i8Am0jxf2lVvgkanl8X4/KkJYDQS3i7QrVHmysQ9RzAqqLj8HfhMCZq6Ior2pUZQtzQhsIKoRc+fM7jh9WPN5Q0tB3bB/+85bR1df2ttqZK9i8AsofyHBNShww+5tMtIbP8bDL0u/AFjlk9jGFrukYBIcob1Xzs76etcBMev1BfFnwH0BSl8e3vGNOX1fX9zvLO23ohRonnW3jzU99GkqiJwpu5wOztL8hqhJohjkfKaS6SnCt+X4nRzNdEYlNN1tCC6JK3aW0sTHWYSapmbQLkIWqugSDS2J0HqW4Hh7csz0szuvgvcs+Be4z7w8v+/qOydFVB5NpSDoCoJaDAgsgcz+fg01OheYpageqjwqmDgSqEKWlpa4QfcEcLBMn8uJepnu52k7K4uiGhWBNxURASJbUuz+Jc/Mjy02/QpC01QReaKq3NKdTecNbrxjwhRIeWJx9EVwuAmLqqpQoBeWELCCObqj/kdh/b9ccwy4HXJWkpz616UxeyEDKQNf6gFZMRBeIuq8xtWCdJo3AZSyTZG1XQwGyMcukaYpIzNQdFqWgiwY1Tp/kHb/RviqhBoEzXXJjTPQjhPUXRRc6CPTiUpKK2MOXoXTyfardt0247V1I74G50lwTT68Jg+kxAv76Gxsg3zkpKEwvowZlUmJiWv/avoFwLJJNyPCNn/jUAXVFCcY+aBvSLtwDFzLHOevgTdDL40dNyAbpLdnxbwyN2rtjYN+8K08sz3i1JKDjqtbTuz76urJYuDO5l5fc2jbwSsnC4A/X5o6ffPy0447s/evdzId6eCXe0cumbpg44pgwMN2hNKvnP5u0+b134MzC/hSI0iTSVPzudIO0wb9bcOYE1BaCJpT9flA3ZR68m8rBh5JPb38zK75V/bMObf9Jp+z6diunWf279y9AafDlPXzJi2ecULM+fjExjHfbVmxd2O3AZG7M84q2N3uUuRFNwL5m77Zs+/y8UtWqZfzCB5nujNrysaFk/atbLVq5IuLYmkrrKCLF/zEXDS9APwdlg6vMapd3NeL513amWEisJR0zeHSybQhE2VyRU7uN+zomrN6UTH+STRVbrgo/p35sT7Q0kz39IPr74Cw9dyhVd8fTAWvpKKkrhWKzm8Kk7fs3XrtxiVy5Jn67uQTQ9bPPpZ1df3hXadzkrPBd8GZfvDmma1nDqXr7py8zDmrF73zUfiR9Itb9u/AmmO/XSxOXbxj7fXbyarbZYqcAOr+vEtzvkqavHv5O6uGPTKhcxr4Dl791gnKNbFg+4XDLqBj2JmuWMb/ZRaRxv+PaNYvAFY5mWKkkT6RZyHICr1k9SkhY6NWgKKrGISAMDY6VgI5FXxNt3388uzwG1C8MXlv9LIh2SBMObW57fpxt+goB+XdxQPrzo1DLO4PptRfNmi3eGvu9f2HIH/MwZUNP+l9Avz7PdcDwF90pb4+IzoDpAtQ9MraIS8sTfgWXDzOboU/+v2JsDkf1ZkXd94spcN0LZM3sFz/00t6z7q4NfrAp3WX9m2/d/Id8Cz4NrHetF6z8786B96B8z/K1xyf8ZefWzvoxS0jz4Nnp/Py63P7pgKXpTt7Lvyo2bYJB6DoGwg8ua7fFeBPBtM+XDlqXeDiSXB3Wj2q0caReRAotpz5yK4tOgz4jlU09/YXL04PbTI75qh8OzH7aLM5cVOu7ER5PCiLAct/s/hm1Pxha80bp7V8h+TnNd6v+mrP7PbKjqFfgHe6cfGptfEz4dpmyKyzdkDdTSOGHl992MjosWnSXijYDZnHwPfCp0gIAx98M/eRxb0jT62cl7x/e/H37RePGHdm89dQ3Hz58KlXP0dw7C++/ML6IefAnQfBXSnH6y1IGHht6xko3OG93GnhsP3SrbXcpRdX9NsK2Ycg+9lVCU8v73tbL9JBkEFLdef5aZ84IlLIvm2Rl/QYiwRBsSzU9F9LvwBYTHazyZUtErEgcGL8NJdMwrVDI+6MBPyTiWNLNF+G6TwLJfVX9q+2svf7+8d23TEuHUo2JH/V8/OZJRAshcAb82JfX9DXA+Ilb+prc/qcVrNKwO8F6YyS1SlpfK05Eb22TcvnC4eumlJreexe/saetJOnjLytweQTgH2h+X1OnNMNh4Y23PzJHYp3Q6kq4NX4o6UpD09tv957FllSi9WDn1kXv8B5bOzpNa/Njai6tf94OH8TCj3+ogtQ0HzViG5fzT0tZ+aC9N6c+Ezw5hvODnMGjsk7uF9L31x4bh9kH9Uyp5za2DZxzHnITdUKRq+fVm9J32zwyCCIGoW/uyTXh8uGjbyycTfkNN46ssay3vF3tsR/s6SALSZy+308CNlSfuux4bOLj6bQnpcovGgBzf/Sot61loRjF9GuV/P7fAEZ31nZUx1fP7s85tV50d12TXljRsQe687i/KNrAxc3SclnrLzI86ufWRKzzn0eGSsHErKt3VnfTTq1ofXy4Ysu7/FD4JqS99C0LpngN0DqO2lQ3SUJ/W9vP+RJXslfWOU/9zmkhh+eN/L61uNQcgM8z8+LfnEZtdphuHVSGon3MfnCNq2VSzx23KL5U0T8kvQvAEthFIsBC4jxCmyNlU53RFEudTn9Ih82uK8CpstZLAtelEifWRJdZ8uQBvvGf6/kLD65o+uuGTi3HCA0WDX8mSlhqULB4dSzb9G4BjjN7yzImrR3xSng5hhXn1sYe47LnHpy85Pr+x+GfHzKrweP3jhXogVlhZd0lAaCScnfvr58yLfgSKElpsFb4Ou09KNp2YcyaIGo/7Ka++ScsHc3jz4N7qgV497aOvqZ9QPO6jm5zpyrgax2swZG7Jh1zSpJNopfG9ktG/w54Gk6PS729JpbIN3WS+6UZmSAb9ntwy9MD08Hd6Y3e/DmGbWWRd+hHR84bLBP5zJBqbU0Jv5a0gHIvgX8JyWHam4fPPzOLpwhFs5/mnJaIfh2ZpysO77XFSDjOuollwO59dcMHHh2tQLCDSGrwdDOF4wcFwTGnF7/2tyoQd+tmpiyq96nUZfBfT2Yw4FyIf2ypQsjDixvNK//1qzvbpWkeaxA+7lDuh+ctwscDefGL7i6F/FxKOts7Vm9ssCvgDh9w/w3Zkf3ObuanD9QfDL/4sVg6ro7h7tvmXwWnGeN/NeW9n9txaASkAWsKlMHaVhtFkjijm2DJaMr6rM6raP6l9MvAJaN33IDTxnRIr5IYdS2wqyLKi9IV27e7NKj+4xJU84d/oZ2Orb0LMvXa9n4vl8u+x5cp4yCFz7p1XLmwNhNs+suHPDXKREbUk/0Xzfzb+Mj45ZMWLZzHRK9kV+vfXFGdMLhFfGnE2/wBRkQnOw8+fbM+ObjYyZvW37H8OeBngNCEVUEtRc9C7S4FRNDZw9p9mlCuw3jBp9Zh3cKVa+mijlcyfzLB45p+dd1Rxpf1H7mkBlnduZDsAiCcfPGtpvS/73Z/bdknp7yVWLD8dEJSybuzzh/FIo6r5/YaEa/D2cPW3ZkewYEMkHruHZc/dGhraclhG+Z+v6KoWeN3NtKEZ0URwu1PR0Pz393/YjGc/rO2bpoZfK+eptGPb8o7q1hPe3pF9B5nBJ5oOxMPxu5ZuYHI/s1HR3fa/On2yD3WygpBM8B+fbzc3q/vX54/JaZbZcN3xa8mkL7gfmOQWGrOQN7Th/abXScG0R/wNVq0Yj68/p3mDfcTQuv5QaLhzy6Mv61r6bVnRXz8rzYC7507JOYQ0uaTYsbv30xXm/IO91p48R3ZsSOSpyV5kzNU4uw39quGNVy/uCB2+a/+tngN5M+vi4Xs6WQtl2wjCPdzfZsRfx/wgh/EbBs0wvTCu1LnRVpsNoEwAiQD1Fh/j5TFlHfE1UwnbQyjE4DSMvPcpLlVw3qvL1NrQM4N8WNcAXuEkkhKz3ycyNAUouXYgE0UMjbAm4ZUFPnUQc2UQJAXVLw87pAXkWyVbpJj2Nn0msBvysouFXyRvP2kg2snmBqxQpXylPQcAFPkfI5QbclKpZIyxVlSXCpnMvvpn4jFwHqP6rTR5FJhbSEA4rVAPOT0CJDJ/C5WBWsGM+TgimjYI56Pw+85lZ82FLkj6hn8KofldAbnmwKI2Q7ZiNlv+0voKh+WgoAUlGA7MiqbfpRHIb3Kymt7rJ+GyGLtooADrmYzHmcJbkoZ6BueVN1FNCBidgm847hLQCtRPRBkQe8Aq9wKLams11vU0ng0zWX2x1wlSoUrWVRQA2tLUyDgAMk3hS8HPYPnchHgZOalhwozqB1e2Bo1J8VJlwbYbZZi+3LZUoG7Yz3P4DWzwOLDpxlpzKgbmBb6uxsWzhMezsGYJvu007llE12YCnFmlHMK2WJGceZnbfsggfb/ltmr7Pfajv4Krx7d9+hP21HGTsSxe4Ck6nZUtmbynBv2o4OMk5Sf1UYzclXacsN7JcV/VhmeyxvnU2hycirlZlGdeYqJG8eW5IqUYXJQ2myA1rtJpd5INk1WytF6KZesm/ZvMa2lzMbJb7+8IXjn2xb1nhGwpALSdsuH6J+0hQ/LeizqGNZJdkqorIu0socR9SH1D/MHmD7AIiZsSLsTsMMzMfKlvZbdv9Q223mw+QnizVKKdsjnH5fkfTyB+2BoLf96+nngVVGIVi2B0lkpTLDNVWL2SJsEzKrL1WRcMgGxR5Huy3U1/bvgZBRJiraGLIbZjfDvmOnijusc+lxuaxENnaszLvlTZt0E7BwPhhlLkX7EepchqEKe6/9Y1uIrLhvu0RsobWsQbbHmWXbukOJett+jC6Y0b+8E+ildNsWHuyuI2TbJspy359mqH5LzkMiBwGnyVb+yqoGzFtZFlPO3s6u7K5gflLWk3YBJilvhDBWIjDxhK0jKu8+KKuwXX+7ORWNKsushLJOMO7qB+Z9Krv/r6efB5Y9BmWTkXmyFINcFLQWl2XdIFcAjTG1o6xmZRPI7n/msbJoRw1CpA2pii4jUDJ9pOwOCx+wO/HuO3af2pl0CPv9Fvub/Pw/GNtYb5MvhRYp/xgQhv1IRSfaubwr7ZcTs2LjYZa3126X/ZuyB8knwjDN/KGEVwYnuxMqxsmuDH1LJJBea5NJgrjO9omgUAO9SPGzKAZahlwxD2x6XP6Ku3JZn7JaW2XRExZbMctQayiWQcST1c5uYMXcsD3oCm0qwbrirh6gsuwf39XGH3qJlfgvpZ8HFhsoe+x/HBNScZMiMcrmIjAZX2YXwHYlkFgNgTlAaekSO7rNHjeF8XK2IQJl4qdlgRzk75KY16viDtuSoWyaEulm3YHPUpSObrAwfIrNslmnRCsEqYvL7MflkTzMT1yOVzvQha3RtJ+yeW6AYnyp21UWGkAbzrAe0Flty3qDGVuoPgwJNg22NRuTcWdKRJ5ZWQaLQhEpTpwewcQbwOmBEgpjswRDllVRYIua2btofU1ZSAg+boshNjrYoWi0Rw0dWyVRZn8qtC5SJEHWFGgZJkWtBdkd1naqs+3DFWj9IGX7aEjy8VllREFiNbdY5Wm82PD9QNH/9fTzwErxFjhZLGLPsQPrtG4QP3vcFV9ecrAQb54quPVGlxbvdGkVPzDhhuzKB/1C5s1Oo/vPPbTFia3QjRKAkVuXhk39KCAJoyZ/0mHC4JHrFo5eMc+vSVwgGD1l9C0rkI9sgRZjwZAFk27l3AG2VdVld9bAz6Yl+/PY+Tf69Yybw5dO45hQp5tan/HD/H6vj/fngzJq5sQeCVEtR8VO3LgszwjMWb+85/D43hOHx04Z1Xf8cIeHFo4atDGzmRd0Nujd6Z3YLjfceTSz2cYEOGB5/lI3yDjIw2dOiBwU92bXlrM3rvD6PZMWzR4w+xMXqp+0TYl64PS3CXMnKGAcOfZ1vwkf3dApahM1g7BJI2bvXHsn7XafKaOzAy6vJRWD2mPq8Nf7dmo6dcBHe1amGB6JImnVHnM/jlo9/fOsi2IwIDi9H82aNnPD6hJTxrGTZOY4pkBCX58ZY6Pmjhu6cOrqQ9t3nj18uujW4PkT/bQWUWXSnc77PVu/3jtwzvixa+amOXPBUEfP/CRh1pgukwZGD4sfNHrIjC2f9Vowps24uHGzJvYZMQC1nxLZfzT5fJPu7Rt3bzd17WIHHTRsHrx+tvvIhITB/XvER/yf9q49KqpqjftHq+td97Zu5c2blWVeynyVjwQNFEEFREF5owhq5BsMNUOqK6n5ClOvKaYmaaYZpV41USwDHyCgIm+Q14gMM8wwrzMzZ86cOXPOvvvbe2agbsW1tea/+dZZM3vO7LPPfvz2t/f+vv19e8fFE13IdqW2ZNuFoyrw3cDyggWvD97clvF9+XXu4cHVO7Dwa0LeSX4pYvJN04O7gnrLuaP4Zy0yDI8L8prt3whHbjBFVaUvJARGZ7+394eTAxMC+8X7ypFNbzMOS4l4JN77qQR/DeKmxEdUInQTad/O2RmT8hYeAl6aG1KBbMXGdgTGEOwr84IK6svMiOtClmkZyQPm+PuvSeyCRQ17U1b1dOzE15fFFHQ2tErMK8lhGGR16rZX5odm7s2qljdXIn3y5vRDF3Kj1iweOyf0LtLWwjHPsFscY8sGTMiWmJGa9vWezMKTryXNbLRqMAu02aw8LEVtMmR8Y174e9kfVypaivWyRZvXncz9esHalEFBPu2Y+Um8xWI+/MOZQTEBDBJ3HTs4Mn7auPULbyCMSNvj4eMid6wpa7w7blmUGgllivoJiyN35p+8K2nyOFnIxpS9BadxNuSSqV9y0F+XhwxOj9eCAZPoHTtjxsa365DVYrcDrMhYjBdoXguCQjYtkdlUyZ9kDIzwzZXfHpIULIdzqW3gfAe2hQojZviNmT9jUKx/EzIIxBR73dFdLyVMBQckvHF25oq/J07+XFnagTgZslxqLveOnT4sxO8Br9cgflxU8OioaSl7Nn1afH7AbF8tsnxZcOrJqHENSPddw9XnkqdM/fCtCpucQdYX35r2WPTrmy98AWz7Ial3YNUpZa/P9F+blalBlg4RTOIZsgb2mRV4s6WyQ9AbQa9pnrRtSZ+wISuPb+sTPjwo590h8wNz8k5471z62LrQfqtDcf8YGeJfgLhLkiIxe9PqT7fhnD4WPv4nZGxAdo1Br7WzAxL8LzWWKgV96q71A+dP2d6Yj+8s3/G+FrEFbRVx324flB7TZ+bIWiT0fdO/DZkWblg9ICkQPAuIrBwJTUwH7taRGUuGzp02Ji0ueMOyxB3riOkLr2BUONs3dc394v36zvP9j672fHNZXlmBgdUbbMZmQbPqsy0YK/d4dQcy3kPMPTjZSUj5KP2VmAAZ8X+FG/3Db/b3j5+oRNy+s8deTAzovzZs0OqZbcj8p+gxsw+m35JXPhXtg2fiC7a8/WToa3gY0enVcgmO77HgEZgx7ju4972irz9svdwnZmynncED/ISksGlZq0qJJQg0HOxYRpjTv5waFpq1olnfHLN1Zd+wUYc6SwYunV6NdG2I6cIQQrb7Ha0z0pJuIXXQtpSchgKGWKGtP/3ZwLhJBtGEJ/8R29P6zPUes3tF5La0qI/XjFgQ6hUxsRkZGowdCtj4b4rPTH3UZ3DGD0f6RryeW3Zhy3efDlgWWILav1PenHworf9i/4Hx41+eOfaZtaGPLprw3g+Hyb7sh6PegVVcf/e14DdmL03QI1u7oLvHyNXg2Mjk5ffamZuX22D7h6VS6HgmwfeZRL+M77MHz5+MP8cvnjkq1r8Eqfyzlvw5dkwnZkILo6buXh2Ylbboi61qTme2WZ4IGVuOrNeQCg9MCpt+4JKpByvyGhHjlTx1+OLQ2J1rxq6c3T9mfDNiv2r6KeWng4VIv+LigaGrY/4y17cBCQuyM72SgtQE5XjcZawM5pHzNq8ZNMv3NlI3I3MHntfgcczKmgVzC6f2XhQx5/jW8IMfvLBy1nOLQiZmLGjUtfOI14qmzcezX46Y1ISMMkHbgj+RpR2Z4z5Y4TXLrwEOczO3I9Om3M+GxgY+QOatZw+/kBRQhfSRn7w96t3ox8JfDdu2/Jzy1t8SfGqQOmHrymfjJ+Bhi9GqMbxUFi3mIkfzv/OZM316VtrE7SueTw1fdnpPOWIGxwcE7F5VhDQW1oRHao1ghrM2WMPgt0KeXRoSnDJ39YEthar6YpOs/7TRLcgiA2+aWgWyTVkeP35RRPTmtAnpSc8nTcWViTO8Ku9gv6XBJsSbjLqIjal950/MVpfCtn3EJ2emDZ3mff5uYb1VKUOGakk9IjF4UOykVWezcQcekhQwKO6N9EuflSDFly0FH1w8UIFUwWsTfJJDaxD7SMTI9/MOgijuIal3YOFJxuGSi6PnzViyZ8MXZflvLIr+Z/jEfYVnpr+TPCIuCE+nMnP3x25IHZUYcqL6x/W5n74aFbDzzOc6ZM0tynuALDEbV/SbPhqXcLi/dy0Si5C2AYwuQKj0cmTAhh9PZOYf23loL66Rp6N8rmoarmrrYrJW1Utd7cDM1P5rE68oq8ssso2XjrSDOkWclbrwucljHiCxBjHhmSmj35yVcmh7avaWYbMDhof5J61fNSx88sfnj+04feTjo/sRMfnleMvttoaRsUEzP1m74ps9T82fOmxN/D9iJuHJh1KlwEsEPEZkHtsXuHTOu7s3p+35aETklFHRQSEpST4JYVmnvtj4Vfb7h3dt/+Zzr6k+KiRsOLFvSHxgs4h7lPXZOF/v5PDYD5ack5U8Fz9Jiay1lvYl+zcMnjEh68zRtQeyRswOjEpfNmTGxKDl89oQ1ygZ6uxar1Df0zVF/4wOGL4qbv2FIyeOHMnNP9dgVMpNGjztezx4TNCO1VVmhRJ2Q1jza0tHz5qyN+/knryTW0/lpOzbjAtSK2iqrKomxA9NCo1dmIBne+/nf/lopDe1acZvfCLGL6e5SCI+BhWcNnJxgk9YwP7zxz/6al9//5EBKXNy7xVt+fH4wCi/FsTOXLfQK8KvCqnzHtz6V06WDvYUcQ0cZm+2EW+GZny12y1DIZ6N0rO4z5cV/vtkTiOjlAuMGnEKEfy9Hv4+d3vOvuv15VpyElqprBpzuCZFK2b1Rs6EFya32ut+aq7Ak+4bZcX1yNgKpiYiLHdE+zV53dn75RcVNaVVdziRz6u72WU3V7TVY06jl7gOnUqPWAWy1nfe15B3wVOgMLXX1FUTY3mxSNVUjQy7Ck+delB+B+nqkOGeQlbaUlOqbCqRN5wtvgLHEUqi2WwEDSbiDhVfSAfXEuJtpLmqaYKTB21WljNrRBYvqfLrbx2/fPbba5dq9XLcqOfvXDt143KFsiXvzvVr9eXVnbLipio8t1NJbJGshgPzJPAAc76koFXf0YXYYsU9A7JqeNjbdUfq2nH11NGqgipJK0fixdrSdqv+fleHUqvC68v6upqqqorvK26ca7tb0FFXV1V5vepWC6fRE9knxtxlVT0O4zxrrUZG4q6UF/9YWXKlpuzC7Ws3WqsLG+92Iha3wn3JeL2jvvBWEZ4mFqubz7XeIUeAijif31Zew+MyWbXwGFs6wdjBdp26mrfpwCeYeSuQuQsJNRbFiZJLuNVajcoa1f1q9X08sZHrlXi+ayfOBnHz5dWUNLFqt0zeYVJJzgXBS0+z0QQbcIkoheesrMnMsbC+Y1mW4cAlK8OxLG8zGAy8wYRgw5Jo4C0sQrJ7TZwJzO5g7yVOE6TWohaPFHAiqKBQqyS68ZeQmjdrdXgVJRIHruCFCqetw4MaiIwggrJLbQUxo73LxmolqwlJagEOhQaZPhFE4KZVgzoPwmYzHB+A19VWu6BD/H0W7MswZ2jSdeKXgpM34uyPg9lkWyePOwPS2jkib0Ng/0SEnAoG/FQxNlCDaC0mfIe1WFVaTbOyXSBvAZfxcDSQneUsOE6LrhO/XcEx+I1ddkun2QCp4ZWoU7oLJ78RiwkGP26Ft3SKeN2HeTLDwIIJisKzRL5B5E0a2FAFej2ciJpliIkf5ETFMkYBksX3jeRIJrwqokIosw1cg2gYLe60ZHu+rUXRhlfgOsFMj+RQWRmdaMGRcT1bwL0FCMPAXE+Es9xFHqwTOxg9eHWW3AAs3mkj8FsXT1obiuSS/jkFaxJZ6cDklCCJxodcgh0VSKGMRKxFxZYgDSISMoccyClfoUkRfVa3GQxP0nFIpGxk/zs4faXKF4jAkou2Ou0JcBHhECfCwZiYwDpNksBniB2Mq1wOj+gFBnfkouJsaq9GL3gnKS+Iw0hA+HmY+FMmKkiyC150qg2IYEyCvdcgZAKxGUQmG8+NRMaGiFYR+jG1GwNbNIeE2fFqWgwqLLVT0SgRRxEBm0QE9EThBFI65x8/u+DFEvFXRgI0PegbpKVcbUfrnyM3H14++n8AC6TPTsk7FQb2DNAL0WWNSyuHHAJc2gCQM9KJqLSSSqKR0+0PjSy55HIiYAiSJPoZYG+kkCCJJg/2VEpAtZEeDT/pXiLSsHaySY3yBgCWM2X6UviPA6ElREMgoyexYbMG6DQlh0bBpVcARkku13tF8FoGJZWcBbSRsIVkGIftzqegaFQnQYiGHTVAKoHepJJkmogjt1A1FB/wUjjZsocugUCY/Etl5ZRHAdKdP0k9AK5c5Opdv0Cas/Kpyo4n/7uajwLLUYcPQ70DC7Jo/d0L8kIhDw6xCUcRqO6M9Cc7SLSJ/JmiCrqMs0K7ax+KTJpdhN4M9QEd3Q7DGMj3QRTuQCLlCUSXYieCb4vTRool4KMIoAFa25S10Ea19igR57RzgnhW+OQdCpXuy5VzV+ahXUVgPBbAPuhPHEoCgksTcXtHs2RxpuZoXgcguiuNAkukrI58kpITfIC9DZyUSjsJGDOKIr54qhukrh+pS3O7A0/wLEmThh0/XXj6bWAhoqHmQP8LshVIgPQhmD8QhYQj/w9DvQOLdObfuwAlMAbDXnS6lwFMaUSq5IduJZADHaBHksjAL0gNOyraoRREMCwQx56gSwBAwuMgeYc9BKDIoL0HmsrJKR1mxs6ByUr5peRgkIiwLt7Z7ehTMKWiMOKBuzjmfHQkALN7iNmz19h6vI7mH4Blt1PlCc6YCKWGTzjTBdQpJKKzyX61TWklAH8iDS+QADQlZagSBGiGedITaLnoRbPkSgTik00INA7FmY0UCspFgfVzIgMkvJAAiHRuooYFb+ak7SBrzuYjTWL/nzR6p96BJXWPub9+EUzQuI5+4uw4jpv0f1fmXLXc/cNB5BFizOy8T1Jz3OzOiSuF7kcJ/fImCfWMTFNwhAiXFXre+TUo9Ly6iSwRSD5p6RzlJekTLvSz2A76rQQdAfLV8+bvXD3juB6EgpAQDTt+9krwuKuNSEGAXIE/SL0Dy0Me+gPkAZaH3EIeYHnILeQBlofcQh5gecgt5AGWh9xCHmB5yC3kAZaH3EIeYHnILeQBlofcQh5gecgt5AGWh9xCHmB5yC3kAZaH3EIeYHnILfRf+SVr9H1nKXsAAAAASUVORK5CYII=>