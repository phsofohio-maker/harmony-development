// scripts/configureTemplates.js
// Updated for v1.2.1 — Canonical document template keys
//
// Template key mapping (canonical set):
//   60DAY               — CTI 60-Day Narrative (Period 3+)
//   90DAY_INITIAL       — CTI 90-Day Initial (Period 1)
//   90DAY_SECOND        — CTI 90-Day Second (Period 2)
//   ATTEND_CERT         — Attending Physician Certification
//   PROGRESS_NOTE       — Clinical Progress Note
//   F2F_ENCOUNTER       — Face-to-Face Encounter
//   HOME_VISIT_ASSESSMENT — Physician Home Visit Assessment

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function configureTemplates() {
  const orgRef = db.collection('organizations').doc('org_parrish');

  // Canonical template IDs (Google Doc IDs)
  const templates = {
    '60DAY': '1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58',
    '90DAY_INITIAL': '',
    '90DAY_SECOND': '',
    'ATTEND_CERT': '1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI',
    'PROGRESS_NOTE': '1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA',
    'F2F_ENCOUNTER': '',
    'HOME_VISIT_ASSESSMENT': '15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s',
  };

  await orgRef.set({
    settings: {
      documentTemplates: templates
    }
  }, { merge: true });

  console.log('═══════════════════════════════════════════════════════');
  console.log('  TEMPLATE CONFIGURATION UPDATED');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('  Template mapping:');
  Object.entries(templates).forEach(([key, id]) => {
    console.log(`    ${key.padEnd(25)} → ${id || '(not configured)'}`);
  });
  console.log('\n✅ Templates configured successfully!');
}

configureTemplates().catch(console.error);
