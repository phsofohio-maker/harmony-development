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
  doc,
  getDoc 
} from 'firebase/firestore';

const functions = getFunctions();
const db = getFirestore();

/**
 * Generate a document for a patient.
 * Uses the stateless Cloud Function. If the template is not found,
 * falls back to a generic layout with all available merge data.
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

    // Parse Firebase function errors
    if (error.code === 'functions/permission-denied') {
      throw new Error('You do not have permission to generate documents.');
    }

    // Fallback: if template not found, retry with useGenericTemplate flag
    if (error.code === 'functions/not-found' || error.message?.includes('Template not found')) {
      console.warn(`Template "${documentType}" not found — retrying with generic layout`);
      try {
        const generateDocFn = httpsCallable(functions, 'generateDocument');
        const fallback = await generateDocFn({
          patientId,
          documentType,
          customData: {
            ...customData,
            useGenericTemplate: true,
          },
        });
        return fallback.data;
      } catch (fallbackErr) {
        console.error('Generic fallback also failed:', fallbackErr);
        throw new Error(`Template "${documentType}" not configured and generic fallback failed.`);
      }
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