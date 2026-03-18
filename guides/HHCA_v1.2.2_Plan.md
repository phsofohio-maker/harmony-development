

| HHCA Implementation Plan Assessment UI Redesign • Checkbox Logic • Email System Version 1.2.2  —  March 17, 2026  —  Prepared for Claude Code |
| :---- |

**Plan Overview**

This plan covers three workstreams identified during project review. It is designed for Claude Code execution with explicit gates for manual Kobe tasks.

| Track | Owner | Status |
| :---- | :---- | :---- |
| A: Assessment Detail View UI | Claude Code | **CLAUDE CODE** |
| B: Checkbox Logic Architecture | Joint | **BRAINSTORM** |
| C: Email System Activation | Kobe (infra) \+ Claude Code | **KOBE** |

**Track A: Assessment Detail View Redesign**

Problem: The current View modal in HomeVisitsPage.jsx renders assessment data as a flat 3-column grid of plain label:value rows. It lacks the visual hierarchy, card-based layout, and clinical polish present elsewhere in the app (Dashboard scorecards, PatientModal tabs, the assessment input form).

**Scope: UI-only refactor of the viewingVisit modal content. No data model changes. No new API calls.**

**Current State**

* hvp-detail-grid uses CSS grid with 3 equal columns

* Every field rendered as identical hvp-detail-row spans — no visual hierarchy

* No color coding for abnormal vitals, no status badges, no section cards

* Narrative notes displayed in basic pre-wrapped block

**Target State**

Redesign the modal content to match the app’s clinical/modern aesthetic:

1. Compact Patient Header Bar — Patient name, MRN, DOB, visit date, and visit type badge at top of modal. Uses the same style as the HomeVisitsPage patient profile card.

2. Card-Based Sections — Each data group (Visit Info, Vitals, Functional Status, Symptoms, Care Plan, Notes) gets its own bordered card with a colored section header matching the assessment form’s tab style.

3. Vitals Grid with Indicators — Vital signs displayed in a compact 2x4 grid. Abnormal values (e.g., O2 Sat \< 90%, Pain \> 7\) get a subtle red/yellow highlight. Normal values stay neutral.

4. Functional Status as Visual Chips — ADL statuses rendered as small colored chips: green for Independent, yellow for Assist levels, red for Total Dependence. Mobility and fall risk as badge-style indicators.

5. Symptom Presence Grid — Boolean symptoms (pain, nausea, dyspnea, etc.) displayed as a horizontal chip row: present symptoms highlighted, absent ones grayed out. symptomNotes below in a styled text block.

6. Care Plan as Checklist Readout — Goals reviewed / Meds reviewed shown as check/X indicators. Education, interventions, plan changes as labeled text blocks.

7. Narrative Section — narrativeNotes in a styled blockquote card with a left border accent.

**Implementation Steps for Claude Code**

| \# | Task | File(s) |
| :---- | :---- | :---- |
| **A1** | Replace the hvp-detail-grid block inside the viewingVisit modal with a new card-based layout component | HomeVisitsPage.jsx |
| **A2** | Add patient header bar at top of detail modal (reuse hvp-profile-card styles) | HomeVisitsPage.jsx |
| **A3** | Implement vitals grid with conditional highlighting (abnormal thresholds: O2 \< 92%, HR \> 100 or \< 60, Temp \> 100.4, Pain \> 6, RR \> 24\) | HomeVisitsPage.jsx (CSS) |
| **A4** | Implement ADL/functional status as colored chip components | HomeVisitsPage.jsx (CSS) |
| **A5** | Implement symptom presence row (highlighted/grayed chips) | HomeVisitsPage.jsx (CSS) |
| **A6** | Style care plan section with check/X indicators and labeled text blocks | HomeVisitsPage.jsx (CSS) |
| **A7** | Style narrative section as blockquote card with left border accent | HomeVisitsPage.jsx (CSS) |
| **A8** | Responsive: ensure cards stack cleanly on mobile (single column below 768px) | HomeVisitsPage.jsx (CSS) |

| Design Reference: Match the aesthetic of Scorecards.jsx (card containers with subtle shadows), the assessment form’s section tabs, and PatientModal’s tab content areas. Use the app’s existing CSS variables (--color-primary, \--radius-lg, \--border-color, etc.). |
| :---- |

**Track B: Checkbox Logic Architecture**

Problem: The autofill system has 23 checkbox variable groups across the 5 document templates. If each option becomes its own merge placeholder, we’re looking at 80-100+ individual variables — a maintenance nightmare for templates and code.

**Current Checkbox Variable Groups (from XLSX)**

| Variable Group | \# Options | Options |
| :---- | :---- | :---- |
| CBX\_GENDER | 3 | Male, Female, Other |
| CBX\_VISIT\_TYPE | 6 | Routine, Urgent, F2F, Recert, Admission, Discharge |
| CBX\_VISIT\_PURPOSE | 6 | Routine Oversight, Symptom Crisis, Admission, Med Review, GoC, Death Pronouncement |
| CBX\_BENEFIT\_PERIOD | 3 | 1st (90d), 2nd (90d), 3rd+ (60d) |
| CBX\_CERT\_TYPE | 3 | Initial, Recert, N/A |
| CBX\_F2F\_STATUS | 3 | N/A, Required, Completed |
| CBX\_F2F\_ROLE | 3 | MD, NP, Attending |
| CBX\_PROVIDER\_ROLE | 6 | MD, DO, NP, PA, Hospice, Attending |
| CBX\_DX\_RELATED | 2 | Related, Unrelated |
| CBX\_O2\_TYPE | 2 | Room Air, O2 Flow |
| CBX\_ADL\_DEPENDENT | 6 | Bath, Dress, Feed, Toilet, Transfer, Ambulate |
| CBX\_AMBULATION | 4 | Independent, Assist, W/C, Bedbound |
| CBX\_INTAKE | 3 | Normal, Decreased, Minimal/Sips |
| CBX\_PAIN\_RELIEF | 3 | Effective, Partial, Inadequate |
| CBX\_SYMPTOM\_SEVERITY | \~8 | Dyspnea, Nausea, Fatigue, Anxiety, Constipation, Edema, Skin, Insomnia |
| CBX\_EXAM\_WNL | \~10 | HEENT, Resp, CV, GI, GU, Neuro, MSK, Skin, Psych, Lymph |
| CBX\_EXAM\_ABN | \~10 | (same systems as WNL) |
| CBX\_LCD\_CRITERIA | \~6 | Wt loss \>10%, Frequent ER, Declining PPS, Recurrent infections, Progressive disease, Dysphagia |
| CBX\_MED\_CHANGES | 4 | New, Discontinued, Adjusted, None |
| CBX\_LOC | 4 | Routine, Respite, GIP, CHC |
| CBX\_REFERRALS | 4 | Chaplain, SW, Volunteer, Music/Art |
| CBX\_DISCUSSED\_WITH | 4 | Patient, Family, IDG, Case Mgr |

**Recommended Approach: Inline Resolved Strings (Option A)**

Each CBX\_ variable resolves to one string in the template. The resolveCheckbox function already supports this pattern. Example:

| Template placeholder: {{CBX\_F2F\_STATUS}}Resolved output: "☑ N/A  ☐ Required  ☐ Completed" |
| :---- |

This means: 1 placeholder per group in the Google Doc template, not 1 per option. Total merge variables stays at \~68, not 100+.

**Optimization: Use the shortest clinically acceptable labels to prevent line wrapping in the Google Doc tables:**

| Group | Current Labels | Short Labels |
| :---- | :---- | :---- |
| CBX\_AMBULATION | Independent, Assist, Wheelchair, Bedbound | Ind, Assist, W/C, Bed |
| CBX\_ADL\_DEPENDENT | Bathing, Dressing, Feeding, Toileting, Transferring, Ambulating | Bath, Dress, Feed, Toilet, Transfer, Amb |
| CBX\_PROVIDER\_ROLE | MD, DO, NP, PA, Hospice, Attending | MD, DO, NP, PA, Hosp, Att |
| CBX\_VISIT\_PURPOSE | Routine Oversight, Symptom Crisis, Admission, Medication Review, GoC, Death Pronouncement | Routine, Crisis, Admit, MedRev, GoC, Death |
| CBX\_LCD\_CRITERIA | Weight loss \>10%, Frequent ER, Declining PPS, Recurrent infections, Progressive disease, Dysphagia | Wt\>10%, ER freq, PPS↓, Recur inf, Prog dx, Dysph |

| STATUS: PARKED. Kobe wants to brainstorm further before finalizing the label list. The resolveCheckbox architecture is confirmed. When ready, Claude Code will: (1) finalize the short-label list for all 23 groups, (2) build the checkbox field definitions map, (3) update prepareMergeData to call resolveAllCheckboxes. |
| :---- |

**Track C: Email System Activation**

The email code is fully written and deployed. The system is non-functional due to missing infrastructure configuration that only Kobe can complete.

**Architecture (Already Built)**

* sendInvite.js — Firestore onDocumentCreated trigger on organizations/{orgId}/pendingInvites/{inviteId}. Sends invitation email with secure token link. 7-day expiry.

* testEmail.js — Callable function for verifying email config from Settings → Notifications.

* manageInvites.js — Callable functions: createInvite, resendInvite, cancelInvite. Validation, dedup, role checks all built.

* NotificationsPage.jsx — UI for managing email recipients list, adding/removing addresses, and triggering test emails.

* Transport: Gmail via nodemailer with App Password authentication.

**Three Blockers (All Manual / Kobe Tasks)**

| \# | Blocker | Fix | Owner |
| :---- | :---- | :---- | :---- |
| **C1** | EMAIL\_USER / EMAIL\_PASS secrets not set in Firebase | Create a dedicated Gmail address (e.g., notifications@harmonyhca.org or a plain Gmail). Enable 2FA. Generate App Password (Google Account → Security → 2-Step Verification → App Passwords). Then run: firebase functions:secrets:set EMAIL\_USER and firebase functions:secrets:set EMAIL\_PASS | **KOBE** |
| **C2** | sendInvite.js secrets array may be commented out | Verify the secrets: \[emailUser, emailPass\] parameter is present in the onDocumentCreated config object. If commented out, uncomment and redeploy: firebase deploy \--only functions:sendInvite | **CLAUDE CODE** |
| **C3** | emailList in org settings is empty | After C1 is done, go to Settings → Notifications in the app. Add recipient email addresses. Click “Send Test Email” to verify end-to-end. | **KOBE** |

**Kobe’s Email Setup Checklist**

Reference: DEPLOYMENT.md in the project root has the exact commands. Here’s the step-by-step:

1. Create or designate a Gmail account for sending (e.g., harmony.notifications@gmail.com)

2. Log into that Gmail account → Google Account → Security → enable 2-Step Verification

3. After 2FA is enabled: Google Account → Security → 2-Step Verification → App Passwords → generate a new App Password (select “Mail”). Copy the 16-character code.

4. In your terminal (with Firebase CLI logged in): firebase functions:secrets:set EMAIL\_USER → enter the Gmail address

5. firebase functions:secrets:set EMAIL\_PASS → paste the 16-character App Password (not the regular Gmail password)

6. Tell Claude Code to verify sendInvite.js secrets config and redeploy functions

7. Open the app → Settings → Notifications → add recipient emails → click “Send Test Email”

8. If test email arrives, the system is live. Try sending a team invite from Settings → Team.

| IMPORTANT: The App Password is a 16-character code like “abcd efgh ijkl mnop”. It is NOT your regular Gmail password. Regular passwords will be rejected by Google’s SMTP servers. |
| :---- |

**Execution Order & Dependencies**

These tracks are independent and can be worked in parallel. Recommended priority:

| \# | Track | Depends On | Can Start | Effort |
| :---- | :---- | :---- | :---- | :---- |
| **1** | A: Assessment Detail View | Nothing | Immediately | Medium (UI refactor) |
| **2** | C: Email Activation | C1 (Kobe setup) | When Kobe signals ready | Small (verify \+ redeploy) |
| **3** | B: Checkbox Logic | Kobe brainstorm decision | After Kobe confirms approach | Medium-Large (23 groups) |

**Handoff Instructions for Claude Code**

When starting a Claude Code session with this plan:

1. Share this document as a project file or paste the relevant track section

2. For Track A: Say “Implement Track A from the HHCA v1.2.2 plan — redesign the assessment detail view modal in HomeVisitsPage.jsx”

3. For Track C: Say “Verify sendInvite.js secrets config and redeploy — I’ve completed the EMAIL\_USER/EMAIL\_PASS setup”

4. For Track B: Say “Let’s finalize the checkbox short-label list and implement resolveAllCheckboxes” — but only after you’ve decided on the approach

**Existing Blockers (Unchanged from Health Report)**

These are NOT part of this plan but remain active:

* Drive Quota Blocker — Google removed Drive quota from service accounts. Domain-wide delegation needed for document generation. Requires Workspace admin access confirmation.

* Firebase Hosting — Not yet deployed. Needs npm run build && firebase deploy \--only hosting.

* PatientModal overflow bug — CSS fix from 1.2.1 Step 1.2 still pending.