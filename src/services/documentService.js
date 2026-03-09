/**
 * documentService.js - Document Generation Service
 * Updated for stateless generation
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

const functions = getFunctions();
const db = getFirestore();

/**
 * Generate a document for a patient.
 * Calls the Cloud Function which uses Google Docs API for generation.
 * Requires the document template to be configured in Settings → Documents.
 */
export async function generateDocument(patientId, documentType, customData = {}) {
  try {
    const generateDocFn = httpsCallable(functions, 'generateDocument');

    const result = await generateDocFn({
      patientId,
      documentType,
      customData,
    });

    return result.data;
  } catch (error) {
    console.error('Error generating document:', error);

    if (error.code === 'functions/permission-denied') {
      throw new Error('You do not have permission to generate documents.');
    }

    if (error.code === 'functions/failed-precondition') {
      throw new Error(error.message || `Template "${documentType}" not configured. Go to Settings → Documents to add it.`);
    }

    throw new Error(error.message || 'Failed to generate document');
  }
}

/**
 * Generate multiple documents at once
 */
export async function generateMultipleDocuments(patientId, documentTypes, customData = {}) {
  const results = await Promise.allSettled(
    documentTypes.map(type => generateDocument(patientId, type, customData))
  );
  
  return results.map((result, index) => ({
    documentType: documentTypes[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason.message : null
  }));
}

/**
 * Get document generation history for a patient
 */
export async function getPatientDocuments(orgId, patientId, maxResults = 20) {
  try {
    const q = query(
      collection(db, 'organizations', orgId, 'generatedDocuments'),
      where('patientId', '==', patientId),
      orderBy('generatedAt', 'desc'),
      limit(maxResults)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      generatedAt: doc.data().generatedAt?.toDate(),
      urlExpiresAt: doc.data().urlExpiresAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching patient documents:', error);
    throw error;
  }
}

/**
 * Get recent documents across all patients
 */
export async function getRecentDocuments(orgId, maxResults = 50) {
  try {
    const q = query(
      collection(db, 'organizations', orgId, 'generatedDocuments'),
      orderBy('generatedAt', 'desc'),
      limit(maxResults)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      generatedAt: doc.data().generatedAt?.toDate(),
      urlExpiresAt: doc.data().urlExpiresAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching recent documents:', error);
    throw error;
  }
}

/**
 * Check if a download URL is still valid
 */
export function isUrlExpired(expiresAt) {
  if (!expiresAt) return true;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry < new Date();
}

/**
 * Get available templates for the organization
 */
export async function getAvailableTemplates(orgId) {
  try {
    const snapshot = await getDocs(
      collection(db, 'organizations', orgId, 'documentTemplates')
    );
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
}