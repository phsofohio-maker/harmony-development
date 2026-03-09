/**
 * scripts/cleanupTestUsers.js
 * Remove test user accounts from Firebase Auth and Firestore
 *
 * USAGE:
 *   Dry run:  node scripts/cleanupTestUsers.js
 *   Execute:  node scripts/cleanupTestUsers.js --confirm
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

const DRY_RUN = !process.argv.includes('--confirm');
const ORG_ID = 'org_parrish';

// Real accounts that are NEVER deleted
const KEEP_LIST = [
  'kobet@parrishhealthsystems.org',
  'reneesha@parrishhealthsystems.org',
  'tajuanna@parrishhealthsystems.org',
];

async function cleanup() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(DRY_RUN
    ? '  DRY RUN — no accounts will be deleted'
    : '  LIVE RUN — deleting test accounts');
  console.log('═══════════════════════════════════════════════════════\n');

  // List all Firebase Auth users
  const listResult = await auth.listUsers(1000);
  const users = listResult.users;

  // Load Firestore user docs for cross-reference
  const usersSnapshot = await db.collection('users').get();
  const firestoreUsers = {};
  usersSnapshot.forEach((doc) => {
    firestoreUsers[doc.id] = doc.data();
  });

  const keepUsers = [];
  const deleteUsers = [];

  for (const user of users) {
    const email = user.email || '';
    const isKeep = KEEP_LIST.some((keepEmail) =>
      email.toLowerCase() === keepEmail.toLowerCase()
    );
    const firestoreData = firestoreUsers[user.uid] || {};

    const userInfo = {
      uid: user.uid,
      email,
      role: firestoreData.role || 'unknown',
      createdAt: user.metadata.creationTime,
      hasFirestoreDoc: !!firestoreUsers[user.uid],
    };

    if (isKeep) {
      keepUsers.push(userInfo);
    } else {
      deleteUsers.push(userInfo);
    }
  }

  console.log(`Found ${users.length} total Auth users:\n`);

  console.log('KEEP (real accounts):');
  if (keepUsers.length === 0) {
    console.log('  (none found — check KEEP_LIST emails)');
  }
  keepUsers.forEach((u) => {
    console.log(`  ✓ ${u.email.padEnd(40)} role: ${u.role.padEnd(10)} uid: ${u.uid}`);
  });

  console.log('\nDELETE (test accounts):');
  if (deleteUsers.length === 0) {
    console.log('  (none found — all accounts are in keep list)');
  }
  deleteUsers.forEach((u) => {
    console.log(`  ✗ ${u.email.padEnd(40)} role: ${u.role.padEnd(10)} uid: ${u.uid}  created: ${u.createdAt}`);
  });
  console.log('');

  if (deleteUsers.length === 0) {
    console.log('No test accounts to delete.');
    return;
  }

  if (DRY_RUN) {
    console.log(`Would delete ${deleteUsers.length} test account(s).`);
    console.log('To execute deletions, run: node scripts/cleanupTestUsers.js --confirm');
    return;
  }

  // Double safety: confirm even with --confirm flag
  console.log(`About to delete ${deleteUsers.length} account(s). Proceeding in 3 seconds...`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  let deletedAuth = 0;
  let deletedFirestore = 0;
  let deletedInvites = 0;

  for (const user of deleteUsers) {
    // Delete from Firebase Auth
    try {
      await auth.deleteUser(user.uid);
      console.log(`  Deleted Auth: ${user.email} (${user.uid})`);
      deletedAuth++;
    } catch (err) {
      console.error(`  Failed to delete Auth user ${user.email}: ${err.message}`);
    }

    // Delete Firestore user doc
    if (user.hasFirestoreDoc) {
      await db.collection('users').doc(user.uid).delete();
      console.log(`  Deleted Firestore user doc: ${user.uid}`);
      deletedFirestore++;
    }

    // Delete pending invites for this email
    const invitesSnapshot = await db
      .collection(`organizations/${ORG_ID}/pendingInvites`)
      .where('email', '==', user.email)
      .get();

    for (const inviteDoc of invitesSnapshot.docs) {
      await inviteDoc.ref.delete();
      console.log(`  Deleted invite: ${inviteDoc.id} (${user.email})`);
      deletedInvites++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Summary:');
  console.log(`    Auth accounts deleted: ${deletedAuth}`);
  console.log(`    Firestore user docs deleted: ${deletedFirestore}`);
  console.log(`    Pending invites deleted: ${deletedInvites}`);
  console.log('═══════════════════════════════════════════════════════');
}

cleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
