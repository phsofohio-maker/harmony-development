// scripts/configureTemplates.js
// Updated for v1.2.1 — Canonical document template keys (5 templates)
//
// Template key mapping:
//   CTI                   — CTI Narrative (all periods)
//   ATTEND_CTI            — Attending Physician CTI
//   PROGRESS_NOTE         — Clinical Progress Note
//   PHYSICIAN_HP          — Physician H&P
//   HOME_VISIT_ASSESSMENT — Home Visit Assessment

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
    'CTI': '1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58',
    'ATTEND_CTI': '1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI',
    'PROGRESS_NOTE': '1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA',
    'PHYSICIAN_HP': '1p7Qoik9VQq0AdHiEtiKOLLsyGV5Xldp9qqe-qOyRJB8',
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
