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
        '60DAY': '1CkUx8NCYOwNJEDnVkIQGsl_gRZt_AjD_hlW0ZG0AzTw',
        '90DAY_INITIAL': '1-OFQEG2c2B4v65Rpyr7gn6A3fAqIC4-Qr65BEJWuUTo',
        '90DAY_SECOND': '1IB9I_BOGwweBZJUtu7XDOKwlghQJvC9MF4XAx6Vkjmk',
        'ATTEND_CERT': '1H74TZgRCXL4hdoTBdjXwRIVwGi-QjdAX1wXvBGF9Ee8',
        'PROGRESS_NOTE': '1PObRDB6JVBLvlMgMOw_6owbvucBUJdak58lH2u61YCM',
        'F2F_ENCOUNTER': '1MRYBd6soKZMhx8Autzegm78FpGF4mi1a9L2Eva7ORaM',
        'HOME_VISIT_ASSESSMENT': '',
      }
    },

    // Physician directory
    physicians: [],
  }, { merge: true });

  console.log('✅ Organization configuration updated successfully.');
}

setupOrganization().catch(console.error);