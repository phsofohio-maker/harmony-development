  
![][image1]

**HARMONY HEALTH CARE ASSISTANT**

Project Health Report

Version 1.2.2  |  Pre-Production

April 1, 2026

Firebase Project: parrish-harmonyhca  |  Org: org\_parrish

**OVERALL PROJECT HEALTH:     YELLOW**   

*Strong foundation, two critical blockers remain before production deployment*

Prepared for: Kobe T. (Developer/Owner)  |  Parrish Health Systems

# **Executive Summary**

Harmony Health Care Assistant (HHCA) is a multi-tenant SaaS platform that automates Medicare hospice certification compliance tracking for Parrish Health Systems. It replaces a legacy Google Sheets/Apps Script system with a React \+ Firebase application featuring real-time compliance monitoring, clinical assessment workflows, automated notifications, and document generation.

The system is currently at version 1.2.2 in pre-production. The core compliance engine, authentication, dashboard, patient management, clinical assessment form, settings, team management, and notification infrastructure are all functional. Two critical blockers prevent production deployment: (1) Google Drive quota removal from service accounts blocks document generation, and (2) the invite acceptance flow has no frontend route handler.

### **Progress Since Last Report (March 12, 2026\)**

**v1.2.2 Plan Created:** Three independent workstreams identified and documented — Assessment Detail View UI redesign (Track A), Checkbox Logic Architecture (Track B, parked for brainstorm), and Email System Activation (Track C).

**Email System Verified:** Test email function confirmed working. EMAIL\_USER/EMAIL\_PASS secrets configured. Pending: recipient list population and sendInvite.js secrets config verification.

**Invite Flow Gap Identified:** Invite links point to /invite?token=... but the SPA has no route handler for that path. A full invite acceptance page is needed (read token from URL, walk user through signup, call acceptInvite Cloud Function).

**Reneesha Account Issue:** Admin user reneesha@parrishhealthsystems.org cannot view audit trail/notification history. Suspected cause: Firestore collection name mismatch or missing custom claims on her account.

**New Feature Concept:** Scanned assessment upload with OCR/Document AI extraction. Feasibility confirmed — structured form fields (checkboxes, printed text, tables) are highly extractable; handwritten narratives achievable at 80-90% accuracy. Fits cleanly into existing Workflow B architecture. Scoped for post-launch.

# **Architecture Overview**

## **Technology Stack**

| Layer | Technology |
| :---- | :---- |
| **Frontend** | React 18 \+ Vite, Lucide React icons, CSS variables for theming |
| **Auth** | Firebase Auth (email/password), custom claims for orgId \+ role |
| **Database** | Cloud Firestore with multi-tenant org isolation |
| **Backend** | Cloud Functions v2 (Node.js 18\) — onCall, onSchedule, onDocumentCreated |
| **Storage** | Firebase Storage for generated PDFs (signed URL download) |
| **Doc Gen** | Google Docs API (copy → replaceAllText → export PDF) — BLOCKED |
| **Email** | Nodemailer via Gmail SMTP with App Password auth |
| **Hosting** | Firebase Hosting (SPA) — NOT YET DEPLOYED |

## **Multi-Tenant Data Model**

All patient data lives under organizations/{orgId}/patients/{patientId}. Security rules enforce org isolation via custom claims on Firebase Auth tokens. Users carry orgId and role claims, and Firestore rules validate these on every read/write. The three-tier data architecture separates patient demographics (Tier 1, \~25 variables on patient doc), visit/encounter setup (Tier 2, \~15 variables on assessment doc), and per-visit clinical data (Tier 3, \~28 variables on assessment doc) for a total of 68 standardized autofill variables.

## **Key Firestore Collections**

| Path | Purpose |
| :---- | :---- |
| organizations/org\_parrish | Org settings, branding, templates, notification config, physician directory |
| users/{uid} | User profiles with organizationId \+ role |
| organizations/{orgId}/patients/{patientId} | Multi-tenant patient records (Tier 1 data) |
|   .../patients/{id}/visits/{visitId} | Assessment/visit records (Tier 2 \+ 3 data) |
|   .../generatedDocuments/{docId} | Document generation history \+ download URLs |
|   .../pendingInvites/{inviteId} | Team invitation records with secure tokens |
|   .../emailHistory/{emailId} | Notification/email audit log |

# **Component Inventory**

## **Frontend Components (React)**

| Component | Status | Notes |
| :---- | :---- | :---- |
| LoginForm.jsx | **Working** | Firebase Auth email/password |
| App.jsx | **Working** | Page routing via state (no react-router), sidebar layout |
| Sidebar.jsx | **Working** | Navigation with collapse, active state, role gating |
| Dashboard.jsx | **Working** | Scorecards, patient table, urgent attention panel |
| Scorecards.jsx | **Working** | 4 cards: Active Patients, Certs Due, F2F Required, 60-Day Periods |
| PatientTable.jsx | **Working** | Sortable, filterable patient list with search |
| PatientModal.jsx | **Bug** | 7-tab edit modal works but overflows on short viewports |
| PatientsPage.jsx | **Working** | Full CRUD for patients with schema validation |
| CertificationsPage.jsx | **Working** | Certification timeline view with filtering |
| HUVPage.jsx | **Working** | HOPE Update Visit tracking with mark-complete flow |
| HomeVisitsPage.jsx | **Working** | Assessment toolkit: patient profile, visit history, new assessment modal |
| HomeVisitAssessment.jsx | **Working** | 6-section clinical form, saves to visits subcollection |
| DocumentsPage.jsx | **Needs Work** | Assessment-based generation flow built, but doc gen blocked by Drive quota |
| SettingsPage.jsx | **Working** | 7 tabs: General, Branding, Team, Physicians, Documents, Notifications, Data |
| NotificationsPage.jsx | **Partial** | Email mgmt UI working; audit trail may have collection name mismatch |
| OnboardingWizard.jsx | **Working** | First-run org setup wizard |
| WelcomeTour.jsx | **Working** | Guided tour for new staff users |

## **Cloud Functions (Node.js v2)**

| Function | Status | Type | Notes |
| :---- | :---- | :---- | :---- |
| setUserClaims | **Deployed** | onCall | Sets orgId \+ role custom claims on auth token |
| updateUserClaims | **Deployed** | onCall | Updates existing user claims |
| refreshUserClaims | **Deployed** | onCall | Force-refreshes claims for token update |
| dailyCertificationCheck | **Deployed** | Scheduled | Daily 9AM EST — checks deadlines, sends alerts |
| weeklySummary | **Deployed** | Scheduled | Weekly compliance summary email |
| generateDocument | **Blocked** | onCall | Google Docs copy/merge/export — blocked by Drive quota |
| sendInvite | **Partial** | onDocCreated | Sends invite email; secrets array may be commented out |
| acceptInvite | **Deployed** | onCall | Processes invitation acceptance |
| testEmail | **Deployed** | onCall | Sends verification email — confirmed working |
| exportPatients | **Deployed** | onCall | CSV data export |
| importPatients | **Deployed** | onCall | CSV data import with schema validation |
| migratePatients | **Deployed** | onCall | Schema migration for legacy patient docs |
| cleanupTempDocs | **Deployed** | Scheduled | Cleans up temp Drive copies after doc generation |
| createInvite | **Deployed** | onCall | Creates invitation with validation and dedup |
| resendInvite | **Deployed** | onCall | Resends expired invitation emails |
| cancelInvite | **Deployed** | onCall | Revokes pending invitations |

## **Services & Configuration**

| File | Status | Notes |
| :---- | :---- | :---- |
| patientService.js | **Working** | Full CRUD, schema validation, docToPatient converter |
| certificationCalculations.js | **Working** | Benefit period engine: 90d/60d cycles, readmissions, F2F logic |
| organizationService.js | **Working** | Org schema defaults, 5 canonical template keys |
| documentService.js | **Needs Work** | Has useGenericTemplate fallback to remove after Drive fix |
| lib/googleDocsGenerator.js | **Blocked** | Google Docs copy/merge/export — needs domain-wide delegation |
| firestore.rules | **Deployed** | Multi-tenant with org isolation, role-based access |
| firebase.json | **Configured** | Firestore, Functions, Hosting (SPA rewrites), Storage |

# **Known Issues & Blockers**

## **Critical (Blocks Production)**

| \# | Issue | Remediation |
| :---- | :---- | :---- |
| **1** | **Drive quota blocks document generation** | Google removed all Drive quota from service accounts (April 2025). Domain-wide delegation required: SA impersonates notifications@harmonyhca.org. Kobe must confirm Workspace admin access, then enable delegation in admin.google.com. Code change is minimal (add subject param to GoogleAuth). Documented in Drive Quota Fix v2 Plan. |
| **2** | **Invite acceptance flow has no frontend route** | sendInvite generates links to /invite?token=...\&org=... but the SPA uses state-based routing (no react-router). Clicking the link loads the app but nothing handles the URL params. Needs: an invite acceptance page that reads the token, walks user through signup/signin, and calls the acceptInvite Cloud Function. |
| **3** | **Firebase Hosting not deployed — no live URL** | Run: npm run build && firebase deploy \--only hosting. Will produce https://parrish-harmonyhca.web.app |

## **High (Affects Usability)**

| \# | Issue | Remediation |
| :---- | :---- | :---- |
| **4** | Reneesha cannot view audit trail | Likely cause: custom claims missing or Firestore collection name mismatch (emailHistory vs notificationHistory). Need to inspect her Firebase Auth claims and Firestore user doc, then fix if needed. |
| **5** | PatientModal overflow on short viewports | CSS fix: min-height: 0 on flex child to enable independent scrolling |
| **6** | sendInvite secrets array may be commented out | Verify secrets: \[emailUser, emailPass\] in sendInvite.js config and redeploy |
| **7** | Email recipients (emailList) not populated in org settings | After email secrets confirmed, add recipients via Settings → Notifications |

## **Medium (Feature Gaps)**

| \# | Feature Gap | Status / Plan |
| :---- | :---- | :---- |
| **8** | Assessment detail view — flat/unpolished | v1.2.2 Track A — UI-only redesign with card-based sections, vitals indicators, ADL chips. Ready for Claude Code execution. |
| **9** | Checkbox logic architecture (23 groups) | v1.2.2 Track B — PARKED. resolveCheckbox() function confirmed. Kobe brainstorming short-label list before implementation. |
| **10** | Cloud Function email logging to emailHistory | dailyCertificationCheck and weeklySummary need to write log entries to emailHistory collection after sending. NotificationsPage already reads this collection. |
| **11** | Physician Directory with autocomplete | Deferred — 1.2.0 Phase 4 feature. Schema \+ service ready. |
| **12** | RxNav medication \+ ICD-10 diagnosis autocomplete | Deferred — 1.2.0 Phase 2 feature. NIH Clinical Table Search API. |
| **13** | Scanned assessment upload with OCR extraction | New concept — feasibility confirmed. Post-launch feature using Google Document AI. |

# **What’s Working Well**

### **Certification Compliance Engine**

Benefit period continuity logic correctly handles 90-day (Periods 1-2) and 60-day (Period 3+) cycles, readmissions, F2F requirements, and period transitions. This is the core value proposition and it is production-solid.

### **Multi-Tenant Security**

Firestore rules enforce strict org isolation via custom claims. Users from org\_A cannot read org\_B data. Role-based access (owner/admin/staff/viewer) enforced at both rule and UI level.

### **Dashboard & Scorecards**

Real-time compliance visibility with 4 scorecard tiles, filterable patient views, urgency indicators, and upcoming deadline tracking. Clean, modern aesthetic.

### **Home Visit Assessment Form**

Complete 6-section clinical form (Visit Info, Vitals, Functional Status, Symptoms, Care Plan, Notes) saving structured data to Firestore visits subcollection. Data model is clean and maps directly to the 68 autofill variables.

### **Settings & Team Management**

Full org configuration UI with 7 tabs including Documents tab for template URL management. Proper role gating. Branding customization (logo \+ primary color). Team invites with secure token links.

### **Notification Infrastructure**

Email transport (nodemailer/Gmail SMTP) tested and confirmed working. Scheduled Cloud Functions for daily cert alerts and weekly summaries deployed. Test email function operational.

### **Onboarding Experience**

New orgs get a setup wizard; new staff get a guided welcome tour. Professional first-run experience designed for multi-tenant SaaS.

# **Document Generation System**

## **Template Inventory (5 Canonical Google Docs)**

| Template Key | Document Name | Google Doc ID |
| :---- | :---- | :---- |
| **CTI** | CTI 60-Day Narrative | 1Fnxxx...CC58 |
| **ATTEND\_CTI** | Attending Physician CTI | 1jkHOS...d5LI |
| **PROGRESS\_NOTE** | Clinical Progress Note | 1f4PK0...nPVA |
| **PHYSICIAN\_HP** | Physician H\&P | 1p7Qoi...RJB8 |
| **HOME\_VISIT\_ASSESSMENT** | Home Visit Assessment | 15sQKv...iY0s |

Templates are shared with harmony-docs-generator@parrish-harmonyhca.iam.gserviceaccount.com at Editor permission. The generation pipeline copies a template, runs replaceAllText for all 68 merge variables ({{VARIABLE}} pattern), exports as PDF, uploads to Firebase Storage, and deletes the temp copy.

## **Autofill Variable Architecture**

68 standardized merge variables across 3 tiers. Tier 1 (\~25 variables) pulls from the patient record. Tier 2 (\~15 variables) pulls from visit/encounter setup on the assessment doc. Tier 3 (\~28 variables) pulls from per-visit clinical data on the assessment doc. 23 checkbox groups use the resolveCheckbox() utility to render inline ☑/☐ strings.

## **Generation Pipeline Status**

**BLOCKED** — The generateDocument Cloud Function cannot create temporary Google Doc copies because Google removed all Drive storage quota from service accounts in April 2025\. The fix requires domain-wide delegation (Option A in the Drive Quota Fix v2 Plan): the service account impersonates notifications@harmonyhca.org using a ***subject*** parameter on GoogleAuth. The code change is \~5 lines. The blocker is Kobe confirming Workspace admin access to admin.google.com to authorize delegation scopes.

# **IAM & Infrastructure**

## **Service Account Roles**

Service account: 1062012852590-compute@developer.gserviceaccount.com

| IAM Role | Purpose |
| :---- | :---- |
| roles/firebaseauth.admin | Manage Firebase Auth users and custom claims |
| roles/datastore.user | Read/write Firestore data from Cloud Functions |
| roles/editor | Comprehensive project access (includes Storage, Functions) |
| roles/iam.serviceAccountTokenCreator | Required for domain-wide delegation (impersonation) |
| roles/run.invoker | Invoke Cloud Run services (Cloud Functions v2 runtime) |
| roles/eventarc.eventReceiver | Receive Eventarc events for onDocumentCreated triggers |

## **Key Stakeholders**

| Name | Email | Role |
| :---- | :---- | :---- |
| Kobe T. | kobet@parrishhealthsystems.org | Developer/Owner |
| Darrius | — | Team member, continuity recipient |
| Reneesha | reneesha@parrishhealthsystems.org | Admin stakeholder |
| Tajuanna | tajuanna@parrishhealthsystems.org | Notification recipient |

# **Implementation Roadmap**

## **Completed (v1.0 → v1.2.1)**

Firebase project setup, authentication, multi-tenant security rules. Core patient CRUD with full schema and benefit period continuity engine. Dashboard with scorecards, patient table, urgency indicators. Sidebar navigation, settings page (7 tabs), notification system. Cloud Functions: user claims, cert checks, weekly summary, email test, invite system. Patient import/export, data migration. Onboarding wizard, welcome tour, org-level branding. Home Visit Assessment form (6-section clinical data entry). Template consolidation from 7 to 5 canonical Google Docs. Two-track pre-production execution plan (Track A: 22 Claude Code steps, Track B: 15 Kobe manual items). Settings Documents tab for admin template management. HomeVisitsPage assessment toolkit/dashboard.

## **In Progress (v1.2.2)**

| Track | Status | Description |
| :---- | :---- | :---- |
| A: Assessment Detail View UI | **Not Started** | Card-based redesign of assessment view modal in HomeVisitsPage. 8 implementation steps. Ready for Claude Code. |
| B: Checkbox Logic Architecture | **Parked** | 23 checkbox groups, resolveCheckbox() confirmed. Waiting for Kobe to finalize short-label brainstorm. |
| C: Email System Activation | **Partial** | Secrets set, test email works. Pending: sendInvite.js secrets verify, recipient list population, emailHistory logging. |

## **Pending Work (Pre-Production Plan)**

The pre-production plan (Track A: 22 Claude Code steps across 5 phases, Track B: 15 Kobe manual items) remains the primary execution roadmap. Key phases:

**Phase 1:** Bug fixes, template migration (7→5 templates), variable naming, PatientModal overflow, emoji cleanup, legacy key deletion.

**Phase 2:** Settings Documents tab (complete), Home Visits toolkit (complete), knownHazards field.

**Phase 3:** Google Docs API switch (BLOCKED by Drive quota), DocumentsPage redesign, assessmentId wiring.

**Phase 4:** PDFKit removal, sendInvite secrets, final lint/build.

**Phase 5:** Test data cleanup (Firestore dummy patients \+ Firebase Auth test users).

## **On the Horizon (Post-Launch)**

| Feature | Description |
| :---- | :---- |
| Scanned Assessment Upload \+ OCR | Upload paper assessments, extract data via Google Document AI, pre-fill review form. Feasibility confirmed for structured fields (high accuracy) and handwritten narratives (\~80-90% accuracy). |
| URL-based Routing (react-router) | Replace state-based page routing with proper URL routing. Enables deep links, invite acceptance, and browser navigation. |
| Physician Directory \+ Autocomplete | CMS NPPES Registry integration for NPI lookup. Reduces repetitive data entry. |
| RxNav \+ ICD-10 Autocomplete | NIH Clinical Table Search Service for medications and diagnosis codes. |
| Patient Chart View | Read-only comprehensive patient summary with assessment history. |
| Multi-Org SaaS Expansion | Onboard additional hospice organizations beyond Parrish Health Systems. |

# **Key Technical Decisions (Final)**

These decisions are finalized and should not be re-debated in future sessions.

| Decision | Choice | Rationale |
| :---- | :---- | :---- |
| **Platform** | Firebase (Auth, Firestore, Functions v2, Storage, Hosting) | Better dev velocity and scalability vs. WordPress/GCP |
| **Frontend** | React \+ Vite (state routing) | Simple for current scope, react-router planned post-launch |
| **Multi-Tenancy** | Custom claims (orgId \+ role) | Enforced in Firestore rules. Scales to multiple orgs. |
| **Doc Generation** | Google Docs API (copy/merge/export) | Templates are already Google Docs. Orgs control design without code changes. Replaced PDFKit. |
| **Template Keys** | 5 canonical keys (CTI, ATTEND\_CTI, PROGRESS\_NOTE, PHYSICIAN\_HP, HOME\_VISIT\_ASSESSMENT) | Consolidated from 7\. Legacy keys (60DAY, 90DAY\_INITIAL, etc.) deleted. |
| **Data Architecture** | 3-tier: patient doc, assessment setup, clinical data | Visit-centric model enables assessment history and per-visit doc generation. |
| **Drive Quota Fix** | Domain-wide delegation (Option A) | SA impersonates notifications@harmonyhca.org. No Workspace Business plan needed. Minimal code change. |
| **Checkbox Logic** | Inline resolved strings (1 placeholder per group) | Keeps total merge variables at \~68 vs 100+. resolveCheckbox() already supports this. |
| **Email Transport** | Gmail SMTP via nodemailer \+ App Password | Simple, no third-party email service needed. |
| **ADC for Functions** | Application Default Credentials | Deployed Cloud Functions use ADC automatically. No key files needed at runtime. |

# **Key Learnings & Principles**

**Drive quota is a platform-level constraint:** purgeDrive.js never resolved the document generation error because the root cause was Google’s April 2025 policy change removing all Drive quota from service accounts — not accumulated files. Domain-wide delegation is the correct architectural fix.

**ADC for deployed functions:** Deployed Cloud Functions use Application Default Credentials automatically via new google.auth.GoogleAuth({ scopes: \[...\] }) — no GOOGLE\_SERVICE\_ACCOUNT\_KEY env var or key file needed at runtime. Key files are only for local scripts outside Google Cloud.

**Google Docs paste safety:** Pasting tables into Google Doc templates as unlinked native tables (Ctrl+Shift+V) is safe for replaceAllText autofill. Linked Sheets embeds break the script since placeholders aren’t accessible as document text.

**Callable vs. HTTP functions:** Use Firebase onCall for client-side calls — it handles CORS automatically. onRequest requires manual CORS configuration that is unreliable across dev environments.

**Multi-tenant Firestore path:** Patients live at organizations/{orgId}/patients/{patientId}, not root patients/{patientId} — a past source of Cloud Function bugs.

**Template variable naming:** Merge variable naming inconsistencies across templates (e.g., DIAGNOSIS1 vs DIAGNOSIS\_1, CD\_1/CD\_2 vs CDATE1/CDATE2) must be resolved during implementation; templates are the source of truth.

**replaceAllText is global:** The Google Docs API replaces ALL instances of a placeholder. Templates using the same placeholder multiple times (once per checkbox option) need unique per-option keys to avoid all instances receiving the same value.

# **Recommended Next Actions**

## **Immediate Priority (Unblock Production)**

**1\. Resolve Drive quota blocker:** Kobe confirms Workspace admin access to admin.google.com for harmonyhca.org domain. If confirmed, enable domain-wide delegation on the service account and authorize Docs \+ Drive scopes. Code change is \~5 lines. This unblocks ALL document generation.

**2\. Build invite acceptance page:** Read token \+ org from URL params on app load, present signup/signin form, call acceptInvite Cloud Function. Critical for onboarding new clinical staff.

**3\. Fix Reneesha’s account:** Inspect custom claims and Firestore user doc. Fix collection name mismatch if present. Ensure admin access to audit trail/notification history.

## **Short-Term (Complete v1.2.2)**

**4\. Execute Track A — Assessment Detail View:** Card-based redesign of view modal. 8 steps, pure UI, ready for Claude Code.

**5\. Complete email system activation:** Verify sendInvite.js secrets, populate emailList, add emailHistory logging to Cloud Functions.

**6\. Deploy to Firebase Hosting:** npm run build && firebase deploy \--only hosting for live URL.

## **Medium-Term (Post-Launch)**

**7\. Finalize checkbox short-labels:** Complete brainstorm on Track B, implement resolveAllCheckboxes for all 23 groups.

**8\. Execute pre-production cleanup:** Phase 5 test data cleanup scripts (Firestore dummy patients, Firebase Auth test users).

**9\. Scoped assessment upload with OCR:** Enable Document AI API, build upload \+ extraction Cloud Function, review UI for scanned assessments.

*End of Report*  
Generated April 1, 2026  |  HHCA Project Health Report v4

[image1]: <data:image/png;base64,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>