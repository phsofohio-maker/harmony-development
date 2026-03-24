Let me dig into the naming mismatch before writing the plan.Good news — the investigation revealed more than expected. Here's what I found:

**The naming mismatch is real, but it's actually worse than that.** Neither collection is being written to. The Cloud Functions (`dailyCertificationCheck`, `weeklySummary`, `testEmail`) send emails via nodemailer but **never log the send to Firestore**. So `emailHistory` (read by the UI) and `notificationHistory` (read by `verifyDatabase.js`) are both ghost collections — always empty. The "audit trail" panel in NotificationsPage will always show "No emails sent yet" regardless of Reneesha's permissions, because nothing writes there.

On top of that, even if we add the write code, there's no Firestore rule for either collection, so client reads would be denied.

Here's the full plan:

---

## HHCA v1.2.2 — Continuation Plan

**Three tracks, all independent. Track A is a quick verification. Tracks B and C are implementation work for Claude Code.**

---

### Track A: Email System Verification (Kobe)

**Goal:** Confirm email sending works end-to-end, then close out C1/C3.

**Steps:**

1. Open the app → Notifications page
2. Add at least one recipient email (your own, or Reneesha's/Tajuanna's)
3. Click "Send Test Email"
4. Check inbox — if the test email arrives, C1 is done
5. Add all production recipients (Reneesha, Tajuanna, anyone else) — that closes C3

**If test email fails:** Check the browser console for the error message. Common causes: secrets not set (`firebase functions:secrets:set EMAIL_USER` / `EMAIL_PASS`), App Password not generated (needs 2FA enabled first), or function not deployed.

**Status after completion:** Email sending works. The audit trail panel will still be empty — that's expected and gets fixed in Track C.

---

### Track B: Invite Acceptance Flow (Claude Code)

**Goal:** When a user clicks the invite link in their email, they land on a working page that walks them through signup and joins them to the org.

**Current problem:** `sendInvite.js` generates links like `https://parrish-harmonyhca.web.app/invite?token=abc&org=org_parrish`, but the SPA has no route handler for `/invite`. The page loads the app shell and shows the login form with no awareness of the invite context.

**Architecture:**

The app uses state-based routing in `App.jsx` (no react-router). The fix needs to work within that pattern:

1. On app load, check `window.location` for `/invite` path + query params
2. If invite params detected, show an `InviteAcceptPage` instead of normal login
3. `InviteAcceptPage` handles: display org name + role from invite → signup/signin with the invited email → call `acceptInvite` Cloud Function → redirect to dashboard

**Implementation steps (Claude Code):**

**B1 — URL param detection in App.jsx**
- On mount, parse `window.location.pathname` and `URLSearchParams`
- If path is `/invite` and `token` + `org` params exist, set state: `inviteMode: true`, store token and orgId
- Pass invite context down to either a new `InviteAcceptPage` or modify `LoginForm`

**B2 — Create `InviteAcceptPage.jsx`**
- Displays: "You've been invited to join [org name]" with role info
- Two paths: "Create Account" (new user) or "Sign In" (existing Firebase Auth user)
- Create Account: email (pre-filled from invite, read-only ideally), password, display name
- Sign In: email + password (for users who already have a Firebase Auth account)
- After auth succeeds, call `acceptInvite({ token, orgId })`
- On success: clear URL params (use `history.replaceState`), load dashboard
- On error: show clear error message (expired, already used, email mismatch)

**B3 — Validate `acceptInvite` Cloud Function**
- Review `acceptInvite.js` — it looks solid but verify:
  - It creates the `users/{uid}` doc with correct `organizationId` and `role`
  - It sets custom claims (`orgId`, `role`) via `auth.setCustomClaims`
  - It updates the invite doc status to `'accepted'`
- Check if the commented-out `secrets` line matters (it shouldn't — acceptInvite doesn't send email)

**B4 — Firebase Hosting SPA rewrite**
- Verify `firebase.json` has the SPA rewrite rule: `"rewrites": [{ "source": "**", "destination": "/index.html" }]`
- Without this, direct navigation to `/invite?token=...` returns a 404 instead of loading the SPA

**B5 — End-to-end test**
- From Settings → Team, send an invite to a test email
- Click the link in the email
- Complete signup on InviteAcceptPage
- Verify: user lands on dashboard, has correct role, custom claims set, invite status updated to `accepted`

**Acceptance criteria:**
- Invite link loads InviteAcceptPage (not a blank page or generic login)
- New user can create account and auto-join the org
- Existing user can sign in and auto-join the org
- Token validation works (expired/used/mismatch errors shown clearly)
- After acceptance, user has correct custom claims and sees the dashboard
- URL is cleaned up after acceptance (no lingering `?token=` in address bar)

---

### Track C: Audit Trail Fix + Reneesha Account Inspection (Claude Code)

**Goal:** Make the email history panel actually work, and verify Reneesha's account is configured correctly.

**Current problems (from investigation):**

1. **No write code exists.** `dailyCertificationCheck`, `weeklySummary`, and `testEmail` Cloud Functions send emails but never log to Firestore. The history panel will always be empty.
2. **Naming mismatch.** The frontend reads `emailHistory`. The `verifyDatabase.js` script reads `notificationHistory`. Pick one name.
3. **No Firestore rule.** Neither `emailHistory` nor `notificationHistory` has a security rule, so even if data existed, client reads would be denied for non-admin-SDK callers.
4. **Reneesha's account** was seeded programmatically — custom claims may not be set, or `organizationId` in her user doc may be wrong/missing.

**Implementation steps (Claude Code):**

**C1 — Standardize on `emailHistory`**
- The frontend already uses `emailHistory` — that's the source of truth
- Update `verifyDatabase.js` to read from `emailHistory` instead of `notificationHistory`
- Decision: **`emailHistory`** is the canonical collection name

**C2 — Add Firestore rule for `emailHistory`**
- Add under `organizations/{orgId}`:
```
match /emailHistory/{entryId} {
  allow read: if isOrgAdmin(orgId);
  // Cloud Functions write via Admin SDK (bypasses rules)
  allow write: if false;
}
```
- Admin-only read is appropriate — this is operational audit data, not clinical data staff needs

**C3 — Add email logging to Cloud Functions**
- After each successful `transporter.sendMail()` in these functions, write a log entry to `organizations/{orgId}/emailHistory`:
  - `dailyCertificationCheck.js` — log type `certification_alert`
  - `weeklySummary.js` — log type `weekly_summary`
  - `testEmail.js` — log type `test_email`
  - `sendInvite.js` — log type `invite` (optional but nice)
- Log schema:
```json
{
  "type": "certification_alert",
  "subject": "email subject line",
  "recipients": ["email1@...", "email2@..."],
  "success": true,
  "sentAt": Timestamp.now(),
  "triggeredBy": "system" or userId,
  "messageId": "from nodemailer response"
}
```
- This matches what `NotificationsPage.jsx` already expects to render (it reads `type`, `sentAt`, `recipients`, `success`, `subject`)

**C4 — Inspect Reneesha's account**
- Run a diagnostic script (or manual Firestore/Auth check):
  1. Look up `reneesha@parrishhealthsystems.org` in Firebase Auth → get UID
  2. Check custom claims on that UID: does `orgId === 'org_parrish'`? Is `role === 'admin'`?
  3. Check `users/{uid}` Firestore doc: does `organizationId === 'org_parrish'`? Is `role === 'admin'`?
  4. If claims are missing: run `setUserClaims` or `updateUserClaims` to fix
  5. After fix: Reneesha needs to **sign out and back in** for the new claims to take effect on her token

**C5 — Verify end-to-end**
- Log in as Reneesha (or have her log in)
- Navigate to Notifications page
- Confirm: email history panel loads without permission errors
- Send a test email → verify the log entry appears in the history panel
- Confirm: all toggles and recipient management work

**Acceptance criteria:**
- `emailHistory` is the single canonical collection name everywhere
- Firestore rule allows admin/owner read on `emailHistory`
- All email-sending Cloud Functions log to `emailHistory` after successful sends
- NotificationsPage shows real email history data
- Reneesha's account has correct custom claims and can access the audit trail
- `verifyDatabase.js` checks `emailHistory` (not `notificationHistory`)

---

### Execution Order

| Priority | Track | Owner | Depends On | Effort |
|----------|-------|-------|------------|--------|
| 1 | A: Email verification | Kobe | Secrets already set | 5 min |
| 2 | C: Audit trail + Reneesha | Claude Code | Nothing | Medium |
| 3 | B: Invite acceptance flow | Claude Code | Nothing | Medium-Large |

Track C should go first for Claude Code because it unblocks Reneesha and fixes a visible gap. Track B is larger but independent.

---