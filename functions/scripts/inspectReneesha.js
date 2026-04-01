/**
 * scripts/inspectReneesha.js
 *
 * Diagnoses and fixes Reneesha's Firebase Auth custom claims and Firestore user doc.
 *
 * USAGE: node scripts/inspectReneesha.js [--fix]
 *   --fix   Apply corrections automatically (set claims + update Firestore doc)
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

const TARGET_EMAIL = 'reneesha@parrishhealthsystems.org';
const EXPECTED_ORG_ID = 'org_parrish';
const EXPECTED_ROLE = 'admin';

const FIX_MODE = process.argv.includes('--fix');
const CREATE_MODE = process.argv.includes('--create');

async function inspect() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RENEESHA ACCOUNT INSPECTION');
  console.log(`  Mode: ${CREATE_MODE ? 'CREATE ACCOUNT' : FIX_MODE ? 'DIAGNOSE + FIX' : 'DIAGNOSE ONLY'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const issues = [];

  // ── 1. Look up user in Firebase Auth ──────────────────────────
  console.log(`Looking up ${TARGET_EMAIL} in Firebase Auth...`);
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(TARGET_EMAIL);
    console.log(`  UID:          ${userRecord.uid}`);
    console.log(`  Email:        ${userRecord.email}`);
    console.log(`  Display Name: ${userRecord.displayName || '(not set)'}`);
    console.log(`  Created:      ${userRecord.metadata.creationTime}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('  Not found in Firebase Auth.\n');

      if (!CREATE_MODE) {
        console.log('  Reneesha has no Firebase Auth account yet.');
        console.log('  Run with --create to create one:');
        console.log('    node scripts/inspectReneesha.js --create\n');
        process.exit(1);
      }

      // ── CREATE account ──────────────────────────────────────────
      const crypto = require('crypto');
      const tempPassword = 'Harmony@' + crypto.randomBytes(4).toString('hex');

      console.log('  Creating Firebase Auth account...');
      userRecord = await auth.createUser({
        email: TARGET_EMAIL,
        displayName: 'Reneesha',
        password: tempPassword,
      });
      console.log(`  Created UID: ${userRecord.uid}`);

      console.log('  Setting custom claims...');
      await auth.setCustomUserClaims(userRecord.uid, { orgId: EXPECTED_ORG_ID, role: EXPECTED_ROLE });

      console.log('  Creating Firestore user doc...');
      await db.collection('users').doc(userRecord.uid).set({
        email: TARGET_EMAIL,
        displayName: 'Reneesha',
        organizationId: EXPECTED_ORG_ID,
        role: EXPECTED_ROLE,
        customClaimsSet: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log('\n  Account created successfully.');
      console.log(`\n  Temporary password: ${tempPassword}`);
      console.log('  Give Reneesha this password to log in for the first time.');
      console.log('  She should change it immediately after logging in.\n');
      console.log('═══════════════════════════════════════════════════════\n');
      process.exit(0);
    }

    console.error(`\n  ERROR: ${err.message}`);
    process.exit(1);
  }

  const uid = userRecord.uid;

  // ── 2. Check custom claims ─────────────────────────────────────
  console.log('\n── Custom Claims ─────────────────────────────────────────');
  const claims = userRecord.customClaims || {};
  console.log(`  Raw claims: ${JSON.stringify(claims)}`);

  const claimsOk = claims.orgId === EXPECTED_ORG_ID && claims.role === EXPECTED_ROLE;

  if (claims.orgId === EXPECTED_ORG_ID) {
    console.log(`  orgId:  ${claims.orgId}`);
  } else {
    console.log(`  orgId:  ${claims.orgId || '(missing)'}  ← expected '${EXPECTED_ORG_ID}'`);
    issues.push('custom_claims_orgId');
  }

  if (claims.role === EXPECTED_ROLE) {
    console.log(`  role:   ${claims.role}`);
  } else {
    console.log(`  role:   ${claims.role || '(missing)'}  ← expected '${EXPECTED_ROLE}'`);
    issues.push('custom_claims_role');
  }

  // ── 3. Check Firestore user doc ────────────────────────────────
  console.log('\n── Firestore users/{uid} doc ─────────────────────────────');
  const userDoc = await db.collection('users').doc(uid).get();

  let firestoreOk = false;
  if (!userDoc.exists) {
    console.log('  ERROR: Document does not exist in users collection.');
    issues.push('firestore_doc_missing');
  } else {
    const data = userDoc.data();
    console.log(`  organizationId:  ${data.organizationId || '(missing)'}`);
    console.log(`  role:            ${data.role || '(missing)'}`);
    console.log(`  customClaimsSet: ${data.customClaimsSet ?? '(missing)'}`);
    console.log(`  email:           ${data.email || '(missing)'}`);

    if (data.organizationId !== EXPECTED_ORG_ID) {
      console.log(`  organizationId expected '${EXPECTED_ORG_ID}'`);
      issues.push('firestore_orgId');
    }
    if (data.role !== EXPECTED_ROLE) {
      console.log(`  role expected '${EXPECTED_ROLE}'`);
      issues.push('firestore_role');
    }
    if (!data.customClaimsSet) {
      issues.push('firestore_customClaimsSet');
    }
    firestoreOk = data.organizationId === EXPECTED_ORG_ID && data.role === EXPECTED_ROLE && !!data.customClaimsSet;
  }

  // ── 4. Summary ─────────────────────────────────────────────────
  console.log('\n── Summary ───────────────────────────────────────────────');
  if (issues.length === 0) {
    console.log('  Everything looks correct. No fixes needed.');
    console.log('  If Reneesha still cannot access the app, have her sign out and back in.');
    process.exit(0);
  }

  console.log(`  Issues found: ${issues.join(', ')}`);

  if (!FIX_MODE) {
    console.log('\n  Run with --fix to apply corrections:');
    console.log('    node scripts/inspectReneesha.js --fix\n');
    process.exit(1);
  }

  // ── 5. Apply fixes ─────────────────────────────────────────────
  console.log('\n── Applying Fixes ────────────────────────────────────────');

  // Fix custom claims
  if (issues.some(i => i.startsWith('custom_claims'))) {
    console.log('  Setting custom claims...');
    await auth.setCustomUserClaims(uid, { orgId: EXPECTED_ORG_ID, role: EXPECTED_ROLE });
    console.log(`  Custom claims set: orgId=${EXPECTED_ORG_ID}, role=${EXPECTED_ROLE}`);
  }

  // Fix Firestore doc
  if (issues.some(i => i.startsWith('firestore'))) {
    if (issues.includes('firestore_doc_missing')) {
      console.log('  Creating missing Firestore user doc...');
      await db.collection('users').doc(uid).set({
        email: TARGET_EMAIL,
        organizationId: EXPECTED_ORG_ID,
        role: EXPECTED_ROLE,
        customClaimsSet: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    } else {
      console.log('  Updating Firestore user doc...');
      await db.collection('users').doc(uid).update({
        organizationId: EXPECTED_ORG_ID,
        role: EXPECTED_ROLE,
        customClaimsSet: true,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    console.log('  Firestore doc updated.');
  }

  console.log('\n  All fixes applied.');
  console.log('\n  IMPORTANT: Reneesha must sign out and sign back in for');
  console.log('  the new claims to take effect on her ID token.\n');
  console.log('═══════════════════════════════════════════════════════\n');
}

inspect().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
