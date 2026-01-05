/**
 * documentService.js - Document Generation Service
 * 
 * PURPOSE:
 * Handle document generation requests to Cloud Functions
 * and manage document history.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const functions = getFunctions();
const db = getFirestore();

/**
 * Generate certification documents for a patient
 * 
 * @param {string} patientId - Patient document ID
 * @param {string} documentType - Template type (60DAY, 90DAY_INITIAL, etc.)
 * @param {Object} customData - Optional additional merge data
 * @returns {Promise<Object>} Generated document info with download URL
 */
export async function generateDocument(patientId, documentType, customData = {}) {
  try {
    const generateDocs = httpsCallable(functions, 'generateCertificationDocs');
    
    const result = await generateDocs({
      patientId,
      documentType,
      customData
    });

    return result.data;
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(error.message || 'Failed to generate document');
  }
}

/**
 * Generate multiple documents for a patient at once
 * 
 * @param {string} patientId - Patient document ID
 * @param {Array<string>} documentTypes - Array of template types
 * @param {Object} customData - Optional additional merge data
 * @returns {Promise<Array>} Array of generated document results
 */
export async function generateMultipleDocuments(patientId, documentTypes, customData = {}) {
  try {
    const promises = documentTypes.map(type => 
      generateDocument(patientId, type, customData)
    );

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => ({
      documentType: documentTypes[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  } catch (error) {
    console.error('Error generating multiple documents:', error);
    throw error;
  }
}

/**
 * Get document history for an organization
 * 
 * @param {string} orgId - Organization ID
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Array of document history records
 */
export async function getDocumentHistory(orgId, maxResults = 20) {
  try {
    const historyRef = collection(db, 'organizations', orgId, 'documentHistory');
    const q = query(
      historyRef,
      orderBy('generatedAt', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      generatedAt: doc.data().generatedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching document history:', error);
    throw error;
  }
}

/**
 * Get document history for a specific patient
 * 
 * @param {string} orgId - Organization ID
 * @param {string} patientId - Patient document ID
 * @returns {Promise<Array>} Array of document history records
 */
export async function getPatientDocumentHistory(orgId, patientId) {
  try {
    const historyRef = collection(db, 'organizations', orgId, 'documentHistory');
    const q = query(
      historyRef,
      where('patientId', '==', patientId),
      orderBy('generatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      generatedAt: doc.data().generatedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching patient document history:', error);
    throw error;
  }
}

/**
 * Map document types to their required certification periods
 */
export const DOCUMENT_REQUIREMENTS = {
  '60DAY': {
    name: '60-Day Certification',
    periods: [3, 4, 5, 6, 7, 8, 9, 10] // Period 3+
  },
  '90DAY_INITIAL': {
    name: '90-Day Initial Certification',
    periods: [1]
  },
  '90DAY_SECOND': {
    name: '90-Day Second Certification',
    periods: [2]
  },
  'ATTEND_CERT': {
    name: 'Attending Physician Certification',
    periods: [1]
  },
  'PROGRESS_NOTE': {
    name: 'Progress Note',
    periods: [2, 3, 4, 5, 6, 7, 8, 9, 10]
  },
  'PATIENT_HISTORY': {
    name: 'Patient History',
    periods: [1]
  },
  'F2F_ENCOUNTER': {
    name: 'Face-to-Face Encounter',
    periods: [3, 4, 5, 6, 7, 8, 9, 10] // Period 3+ or readmissions
  }
};

/**
 * Get required documents for a patient based on their benefit period
 * 
 * @param {Object} patient - Patient data with compliance info
 * @returns {Array<string>} Array of required document types
 */
export function getRequiredDocuments(patient) {
  const cti = patient.compliance?.cti;
  if (!cti) return [];

  const period = cti.benefitPeriod || 1;
  const isReadmission = patient.isReadmission || false;
  const required = [];

  // Determine certification form type
  if (period === 1) {
    required.push('90DAY_INITIAL', 'ATTEND_CERT', 'PATIENT_HISTORY');
  } else if (period === 2) {
    required.push('90DAY_SECOND', 'PROGRESS_NOTE');
  } else {
    required.push('60DAY', 'PROGRESS_NOTE');
    
    // F2F required for Period 3+ or readmissions
    if (period >= 3 || isReadmission) {
      required.push('F2F_ENCOUNTER');
    }
  }

  return required;
}