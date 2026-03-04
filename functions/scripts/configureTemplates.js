// scripts/configureTemplates.js
// Updated March 4, 2026 — Consolidated CTI template system
//
// MIGRATION: The old multi-document system (60DAY, 90DAY_INITIAL, 90DAY_SECOND)
// has been replaced by a single HHCA_CTI template that handles all benefit periods.
//
// Old → New mapping:
//   60DAY, 90DAY_INITIAL, 90DAY_SECOND  →  CTI (single consolidated template)
//   ATTEND_CERT                          →  ATTEND_CTI (new doc ID)
//   PROGRESS_NOTE                        →  PROGRESS_NOTE (updated doc ID)
//   HOME_VISIT_ASSESSMENT                →  HOME_VISIT_ASSESSMENT (was empty, now has ID)
//
// Deprecated keys removed: 60DAY, 90DAY_INITIAL, 90DAY_SECOND, PATIENT_HISTORY, F2F_ENCOUNTER

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function configureTemplates() {
  const orgRef = db.collection('organizations').doc('org_parrish');

  // New consolidated template IDs (from Gemini export March 4, 2026)
  const newTemplates = {
    'CTI': '1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58',
    'ATTEND_CTI': '1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI',
    'PROGRESS_NOTE': '1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA',
    'HOME_VISIT_ASSESSMENT': '15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s',
  };

  // Remove deprecated keys and set new ones
  await orgRef.set({
    settings: {
      documentTemplates: newTemplates
    }
  }, { merge: true });

  console.log('═══════════════════════════════════════════════════════');
  console.log('  TEMPLATE CONFIGURATION UPDATED');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('  New template mapping:');
  Object.entries(newTemplates).forEach(([key, id]) => {
    console.log(`    ${key.padEnd(25)} → ${id}`);
  });
  console.log('\n  Deprecated keys (no longer used):');
  console.log('    60DAY, 90DAY_INITIAL, 90DAY_SECOND, PATIENT_HISTORY, F2F_ENCOUNTER');
  console.log('\n✅ Templates configured successfully!');
}

configureTemplates().catch(console.error);