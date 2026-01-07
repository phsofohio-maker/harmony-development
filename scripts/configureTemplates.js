// scripts/configureTemplates.js
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function configureTemplates() {
  const orgRef = db.collection('organizations').doc('org_parrish');
  
  await orgRef.set({
    settings: {
      documentTemplates: {
        '60DAY': '1CkUx8NCYOwNJEDnVkIQGsl_gRZt_AjD_hlW0ZG0AzTw',
        '90DAY_INITIAL': '1-OFQEG2c2B4v65Rpyr7gn6A3fAqIC4-Qr65BEJWuUTo',
        '90DAY_SECOND': '1IB9I_BOGwweBZJUtu7XDOKwlghQJvC9MF4XAx6Vkjmk',
        'ATTEND_CERT': '1H74TZgRCXL4hdoTBdjXwRIVwGi-QjdAX1wXvBGF9Ee8',
        'PROGRESS_NOTE': '1PObRDB6JVBLvlMgMOw_6owbvucBUJdak58lH2u61YCM',
        'PATIENT_HISTORY': '1MRYBd6soKZMhx8Autzegm78FpGF4mi1a9L2Eva7ORaM',
        'F2F_ENCOUNTER': '1LG1kBdAD9xAbCEJce31gDyaGvHPLs6zhucXPkiQcM4k'
      }
    }
  }, { merge: true });
  
  console.log('✅ Templates configured successfully!');
}

configureTemplates().catch(console.error);