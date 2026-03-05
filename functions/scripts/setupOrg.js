const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json'); // You'll need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const ORG_ID = 'org_parrish';

async function setupOrganization() {
  console.log(`Configuring ${ORG_ID}...`);

  const orgRef = db.collection('organizations').doc(ORG_ID);
  
  // 1. Configure Email List (Fixes Report Issue #2)
  // This is required for dailyCertificationCheck and weeklySummary
  await orgRef.set({
    name: 'Parrish Health Systems',

    // Agency / Provider info
    agencyName: '',
    providerNumber: '',
    npi: '',
    phone: '',
    fax: '',
    address: '',
    city: '',
    state: 'OH',
    zip: '',

    // Defaults
    defaultPhysician: '',
    defaultLevelOfCare: 'Routine',

    emailList: ['phsofohio@gmail.com'], // CHANGE THIS to your actual email
    notifyDaysBefore: 5,
    notifications: {
      dailyCertAlerts: true,
      weeklySummary: true,
      huvDailyReport: true,
      f2fAlerts: true,
    },

    // Compliance thresholds
    compliance: {
      certPeriodDays: 60,
      f2fWindowDays: 30,
      huvWindowDays: 5,
    },

    // Document Templates (Required for generateCertificationDocs)
    settings: {
      documentTemplates: {
        '60DAY': '1FnxxzzMt3XEc-YH08lY6vRxTTwRInUOvVuWq5jkCC58',
        '90DAY_INITIAL': '',
        '90DAY_SECOND': '',
        'ATTEND_CERT': '1jkHOS-go3-EKo0icVuXNhHmWDFXEcNACpCfkzKXd5LI',
        'PROGRESS_NOTE': '1f4PK03KzaY_0gWwYD0SDTxE4aV68taxVVZQGpsnnPVA',
        'F2F_ENCOUNTER': '',
        'HOME_VISIT_ASSESSMENT': '15sQKvpwPm8mEC0NG7DWqWprHxhy2Lss1B8WbSg7iY0s',
      }
    },

    // Physician directory
    physicians: [],
  }, { merge: true });

  console.log('✅ Organization configuration updated successfully.');
}

setupOrganization().catch(console.error);