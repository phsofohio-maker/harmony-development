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
    emailList: ['phsofohio@gmail.com'], // CHANGE THIS to your actual email
    notifications: {
      dailyAlerts: true,
      weeklySummary: true,
      f2fAlerts: true,
      leadDays: 14
    },
    // 2. Configure Document Templates (Required for generateCertificationDocs)
    settings: {
      documentTemplates: {
        '60DAY': '1CkUx8NCYOwNJEDnVkIQGsl_gRZt_AjD_hlW0ZG0AzTw',       // You must replace these with real Google Doc IDs
        '90DAY_INITIAL': '1-OFQEG2c2B4v65Rpyr7gn6A3fAqIC4-Qr65BEJWuUTo',
        '90DAY_SECOND': '1IB9I_BOGwweBZJUtu7XDOKwlghQJvC9MF4XAx6Vkjmk',
        'ATTEND_CERT': '1H74TZgRCXL4hdoTBdjXwRIVwGi-QjdAX1wXvBGF9Ee8',
        'PROGRESS_NOTE': '1PObRDB6JVBLvlMgMOw_6owbvucBUJdak58lH2u61YCM',
        'F2F_ENCOUNTER': '1MRYBd6soKZMhx8Autzegm78FpGF4mi1a9L2Eva7ORaM'
      }
    }
  }, { merge: true });

  console.log('✅ Organization configuration updated successfully.');
}

setupOrganization().catch(console.error);