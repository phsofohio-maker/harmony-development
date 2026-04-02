**UI Feedback Implementation Plan**

Interaction Layer Fixes — Toast System, Button States, Silent Error Elimination

Date: April 1, 2026  |  Version: 1.2.x  |  Est. Total Effort: \~6 hours  |  New Files: 1  |  Modified Files: 13

# **What This Plan Does**

This plan fixes the interaction feedback layer across the Harmony dashboard. No new features are added. No data models change. No service layer files are touched.

It addresses three categories of gaps identified in a full page-by-page audit:

| Category | Count | Problem | Tier |
| :---- | :---- | :---- | :---- |
| Silent catch blocks | 7 | Errors logged to console only — user sees nothing | **CRITICAL** |
| alert() calls | 3 | Browser alert dialogs used for error feedback | **CRITICAL** |
| Dead button | 1 | Generate Documents button shows alert() placeholder | **CRITICAL** |
| Missing press states | All btns | Buttons have :hover but no :active — clicks feel unresponsive | **HIGH** |
| No row hover | 3 pages | Clickable table rows have no visual indicator | **HIGH** |
| No unsaved guard | 2 modals | Closing modals with changed data loses work silently | **MEDIUM** |
| No delete spinner | 2 pages | Delete buttons lack loading state — double-click risk | **LOW** |

# **Out of Scope**

The following files and systems are NOT touched by this plan:

**Service layer:** src/services/\* — no changes to backend logic or data access

**Auth system:** src/contexts/AuthContext.jsx, src/lib/firebase.js — untouched

**Cloud Functions:** functions/\* — no backend changes

**Firebase config:** firebase.json, firestore.rules, storage.rules — untouched

**Theme context:** src/contexts/ThemeContext.jsx — we only add CSS, no context changes

**Sound design:** Skipped entirely — no value for clinical staff in medical office settings

**Skeleton screens:** Deferred — current Loader2 spinner pattern is consistent and appropriate

# **Fix Details**

## **Fix 1: Toast Notification System**

| Tier: CRITICAL | Estimate: 1.5 hours | Scope: 1 new file \+ 2 modifications |
| :---- | :---- | :---- |

**Root cause:** Each component independently implements setMessage \+ setTimeout \+ conditional render. No shared notification system exists.

**Implementation:**  
1\. Create src/contexts/ToastContext.jsx — ToastProvider with state management, useToast() hook, and createPortal render layer

2\. Toast types: success (4s auto-dismiss), info (4s), warning (6s), error (persistent until manually dismissed)

3\. Max 3 visible toasts, newest on top, dedup within 1 second

4\. Uses existing CSS variables (--color-success, \--color-error, etc.) and STATUS\_ICONS from constants/icons.js

5\. Add toast CSS classes to src/styles/theme.css (.toast-stack, .toast, .toast-{type}, @keyframes toast-in)

6\. Wrap app content with \<ToastProvider\> in src/App.jsx — same pattern as existing AuthContext/ThemeContext

**Files affected:**

| File | Action |
| :---- | :---- |
| src/contexts/ToastContext.jsx | **CREATE** |
| src/styles/theme.css | **MODIFY** |
| src/App.jsx | **MODIFY** |

## **Fix 2: Button & Card Active States**

| Tier: HIGH | Estimate: 30 minutes | Scope: CSS only — 1 file |
| :---- | :---- | :---- |

**Root cause:** The :active pseudo-class was never added to button utility classes. Clicks have hover feedback but no press feedback.

**Implementation:**  
1\. Add .btn-primary:active:not(:disabled) { transform: scale(0.97) } to theme.css

2\. Add .btn-secondary:active:not(:disabled) with same transform

3\. Add new .btn-danger class (background: \--color-error, white text, hover/active/disabled states)

4\. Add .card:active { transform: scale(0.995) }

5\. Add .row-clickable:hover { background: \--color-gray-50 } and :active { background: \--color-gray-100 }

**Files affected:**

| File | Action |
| :---- | :---- |
| src/styles/theme.css | **MODIFY** |

## **Fix 3: Wire Toasts to All Silent Operations**

| Tier: CRITICAL | Estimate: 1.5 hours | Scope: 7 component files |
| :---- | :---- | :---- |

**Root cause:** 3 browser alert() calls and 7 console-only catch blocks mean users get no feedback on success or failure for critical operations.

**Implementation:**  
1\. Dashboard.jsx: Replace alert('Failed to delete patient') with toast.error()

2\. PatientsPage.jsx: Replace alert('Failed to delete patient') with toast.error()

3\. HUVPage.jsx: Replace alert() with toast.error(); add toast.success() when visit marked complete

4\. CertificationsPage.jsx: Replace alert() placeholder with toast.info('Coming soon')

5\. HomeVisitsPage.jsx: Add toast.error() to 2 silent catch blocks (load patients \~line 62, load visits \~line 94\)

6\. DocumentsPage.jsx: Add toast.error() to 1 silent catch block (load assessments \~line 143\)

7\. NotificationsPage.jsx: Add toast.error() to 4 silent catch blocks (add email, remove email, toggle setting, test email) \+ toast.success() for successful add/remove

**Files affected:**

| File | Action |
| :---- | :---- |
| src/components/Dashboard.jsx | **MODIFY** |
| src/components/PatientsPage.jsx | **MODIFY** |
| src/components/HUVPage.jsx | **MODIFY** |
| src/components/CertificationsPage.jsx | **MODIFY** |
| src/components/HomeVisitsPage.jsx | **MODIFY** |
| src/components/DocumentsPage.jsx | **MODIFY** |
| src/components/NotificationsPage.jsx | **MODIFY** |

## **Fix 4: Dead Button Fix**

| Tier: CRITICAL | Estimate: 15 minutes | Scope: 1 file (overlaps with Fix 3\) |
| :---- | :---- | :---- |

**Root cause:** The Generate Documents button in CertificationsPage fires an alert() placeholder — it does nothing useful.

**Implementation:**  
1\. Option A (preferred): Wire onClick to navigate to the Documents page via onNavigate('documents')

2\. Option B (if doc gen not ready): Disable the button with title='Document generation coming soon'

**Files affected:**

| File | Action |
| :---- | :---- |
| src/components/CertificationsPage.jsx | **MODIFY** |

## **Fix 5: Table Row Hover States**

| Tier: HIGH | Estimate: 30 minutes | Scope: 3 component files |
| :---- | :---- | :---- |

**Root cause:** Patient rows in PatientsPage, CertificationsPage, and HUVPage are clickable but show no visual indication.

**Implementation:**  
1\. Add className='row-clickable' to \<tr\> elements that have onClick handlers

2\. CSS from Fix 2 (.row-clickable:hover and :active) provides the visual feedback

3\. No new CSS needed — just adding the class name to existing JSX

**Files affected:**

| File | Action |
| :---- | :---- |
| src/components/PatientsPage.jsx | **MODIFY** |
| src/components/CertificationsPage.jsx | **MODIFY** |
| src/components/HUVPage.jsx | **MODIFY** |

## **Fix 6: Dirty-State Guards**

| Tier: MEDIUM | Estimate: 1.5 hours | Scope: 2 component files |
| :---- | :---- | :---- |

**Root cause:** PatientModal and HomeVisitAssessment can be closed (overlay click or X) while form data has been changed, discarding work with no warning.

**Implementation:**  
1\. On mount, snapshot form data into initialData state

2\. On close attempt, compare current formData to initialData via JSON.stringify

3\. If dirty: window.confirm('You have unsaved changes. Discard?') — blocks close if user cancels

4\. If clean: close silently as before

5\. Uses window.confirm() intentionally — it is blocking (prevents data loss) and requires zero new UI. Safety over aesthetics for a clinical app.

**Files affected:**

| File | Action |
| :---- | :---- |
| src/components/PatientModal.jsx | **MODIFY** |
| src/components/HomeVisitAssessment.jsx | **MODIFY** |

## **Fix 7: Delete Button Loading States**

| Tier: LOW | Estimate: 30 minutes | Scope: 2 component files |
| :---- | :---- | :---- |

**Root cause:** Delete buttons in PatientModal and remove-email buttons in SettingsPage don't disable or show spinners during async operations.

**Implementation:**  
1\. PatientModal: Add deleting state. On click, set deleting=true, disable button, show Loader2 spinner \+ 'Deleting...' text. Reset in finally block.

2\. SettingsPage: Add disabled state to remove-email buttons while any save operation is in progress

3\. Prevents double-click firing duplicate delete requests

**Files affected:**

| File | Action |
| :---- | :---- |
| src/components/PatientModal.jsx | **MODIFY** |
| src/components/SettingsPage.jsx | **MODIFY** |

# **Complete File Change Manifest**

Every file this plan touches, and nothing else.

| File Path | Action | Fix \# | Purpose |
| :---- | :---- | :---- | :---- |
| src/contexts/ToastContext.jsx | **CREATE** | 1 | Toast provider \+ hook \+ render |
| src/styles/theme.css | **MODIFY** | 1, 2 | Toast CSS \+ active states |
| src/App.jsx | **MODIFY** | 1 | Wrap with ToastProvider |
| src/components/Dashboard.jsx | **MODIFY** | 3 | alert() → toast |
| src/components/PatientsPage.jsx | **MODIFY** | 3, 5 | alert() → toast \+ row hover |
| src/components/HUVPage.jsx | **MODIFY** | 3, 5 | alert() → toast \+ row hover |
| src/components/CertificationsPage.jsx | **MODIFY** | 3, 4, 5 | alert() → toast \+ dead btn \+ row hover |
| src/components/HomeVisitsPage.jsx | **MODIFY** | 3 | 2 silent catch → toast |
| src/components/DocumentsPage.jsx | **MODIFY** | 3 | 1 silent catch → toast |
| src/components/NotificationsPage.jsx | **MODIFY** | 3 | 4 silent catch \+ 2 success → toast |
| src/components/PatientModal.jsx | **MODIFY** | 6, 7 | Dirty guard \+ delete spinner |
| src/components/HomeVisitAssessment.jsx | **MODIFY** | 6 | Dirty-state guard |
| src/components/SettingsPage.jsx | **MODIFY** | 7 | Remove-email disabled state |

**Total: 1 new file, 13 modified files. Zero service layer, auth, or backend changes.**

# **Execution Order**

Fixes must be implemented in this order due to dependencies:

| Order | Fix | Depends On | Effort | Risk |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Fix 2: Button/Card CSS | None | 30 min | None — CSS only |
| 2 | Fix 1: Toast System | None | 1.5 hrs | Low |
| 3 | Fix 3: Wire Toasts | Fix 1 | 1.5 hrs | Low |
| 4 | Fix 4: Dead Button | Fix 1 | 15 min | None |
| 5 | Fix 5: Row Hovers | Fix 2 | 30 min | None |
| 6 | Fix 6: Dirty-State Guards | None | 1.5 hrs | Low-Med |
| 7 | Fix 7: Delete Loading States | Fix 1 (for toasts) | 30 min | None |

# **Verification Checklist**

Test each item after implementation. Check the box when verified. Items grouped by fix.

### **Fix 1 — Toast System**

*   Open any page. Run toast.success('Test') from browser console (or trigger from a component). Green toast appears top-right, auto-dismisses in 4 seconds.

*   Trigger toast.error('Test'). Red toast appears and does NOT auto-dismiss. Click X to close manually.

*   Fire 4+ toasts rapidly. Only 3 visible at once; oldest drops off.

*   Fire the same toast message twice within 1 second. Dedup prevents duplicate.

### **Fix 2 — Button & Card Active States**

*   Click any .btn-primary button — visible scale-down on press (0.97 transform).

*   Click any .btn-secondary button — same press feedback.

*   Click a disabled button — no transform, cursor shows not-allowed.

*   Click a .card element — subtle scale-down (0.995).

### **Fix 3 — Wire Toasts to Silent Operations**

*   Dashboard: Trigger patient delete failure (e.g., disconnect network). Red toast appears, NO browser alert() dialog.

*   PatientsPage: Same delete failure test. Red toast, no alert().

*   HUVPage: Mark a visit complete successfully. Green success toast appears.

*   HUVPage: Trigger mark-complete failure. Red error toast, no alert().

*   CertificationsPage: Click Generate Documents. Either navigates to Documents page or shows info toast — no alert().

*   HomeVisitsPage: Trigger patient load failure. Red toast appears (previously silent).

*   HomeVisitsPage: Trigger visit history load failure. Red toast appears (previously silent).

*   DocumentsPage: Trigger assessment load failure. Red toast appears (previously silent).

*   NotificationsPage: Trigger add-email failure. Red toast appears (previously silent).

*   NotificationsPage: Trigger remove-email failure. Red toast appears (previously silent).

*   NotificationsPage: Trigger toggle-setting failure. Red toast appears (previously silent).

*   NotificationsPage: Trigger test-email failure. Red toast appears (previously silent).

*   NotificationsPage: Successfully add an email. Green success toast appears.

*   NotificationsPage: Successfully remove an email. Green success toast appears.

### **Fix 4 — Dead Button**

*   CertificationsPage: Generate Documents button is either functional or visibly disabled with tooltip. No alert() popup.

### **Fix 5 — Table Row Hover States**

*   PatientsPage: Hover over a patient row. Background highlights to gray.

*   CertificationsPage: Hover over certification row. Background highlights.

*   HUVPage: Hover over HUV row. Background highlights.

*   Click any highlighted row. Brief darker highlight on press, then action fires.

### **Fix 6 — Dirty-State Guards**

*   PatientModal: Open a patient, change a field, click overlay/X. Confirm dialog appears asking about unsaved changes.

*   PatientModal: Open a patient, change nothing, close. No confirm dialog — closes silently.

*   HomeVisitAssessment: Start editing, try to close. Confirm dialog appears.

*   HomeVisitAssessment: Open without edits, close. No dialog.

### **Fix 7 — Delete Button Loading States**

*   PatientModal: Click Delete. Button shows spinner \+ 'Deleting...' text and is disabled during operation.

*   PatientModal: Double-click Delete rapidly. Only one request fires (button disabled after first click).

*   SettingsPage: Click remove-email while a save is in progress. Button is disabled.

**Final Sign-Off**

*   All 34 verification items pass  
*   npm run build succeeds with zero errors  
*   No browser alert() calls remain in codebase (grep \-rn "alert(" src/)  
*   No silent catch blocks remain (grep \-rn "console.error" src/ — each should have a corresponding toast call)