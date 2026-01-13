const { initializeApp, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');

// Initialize Firebase Admin
try {
  getApp();
} catch {
  initializeApp();
}

const db = getFirestore();
const admin = getAuth();
const storage = getStorage();

// Secrets
const emailUser = defineSecret('EMAIL_USER');
const emailPass = defineSecret('EMAIL_PASS');

module.exports = {
  db,
  admin,
  storage,
  Timestamp,
  emailUser,
  emailPass
};