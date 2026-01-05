// Artifact ID: firebase-config
// Branch: 1 (main) (019b4c98...)
// Version: 1
// Command: create
// UUID: 4e913f80-9cdd-4d59-84d4-1423c4bd33c6
// Created: 12/23/2025, 11:12:02 AM
// Change: Created

// ---

// src/lib/firebase.js
// Firebase configuration and initialization

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBzGdm-l11apHUHkioaEQg8vuRA4vTrhis",
  authDomain: "parrish-harmonyhca.firebaseapp.com",
  projectId: "parrish-harmonyhca",
  storageBucket: "parrish-harmonyhca.firebasestorage.app",
  messagingSenderId: "1062012852590",
  appId: "1:1062012852590:web:5e71eb29c86ea3ad3c3db1",
  measurementId: "G-Q9Q5SX1XKJ"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

// Connect to emulators in development (optional)
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.log('🔧 Connected to Firebase emulators');
}

export default app;
