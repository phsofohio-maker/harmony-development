/**
 * Harmony Health Care Assistant
 * Patient Service - Firestore Operations with Benefit Period Support
 * 
 * FIXED: Added safeToDate() helper to handle both Timestamp and string dates
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculatePatientCompliance } from './certificationCalculations';

// ============ HELPER FUNCTIONS ============

/**
 * Safely convert a value to a Date object
 * Handles: Firestore Timestamp, Date object, string, null/undefined
 */
function safeToDate(value) {
  if (!value) return null;
  
  // If it's a Firestore Timestamp (has toDate method)
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }
  
  // If it's a string or number, try to parse it
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    // Check if valid date
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

/**
 * Safely convert a value to a Firestore Timestamp
 */
function safeToTimestamp(value) {
  if (!value) return null;
  
  // If it's already a Timestamp
  if (value instanceof Timestamp) {
    return value;
  }
  
  // If it has toDate (is a Timestamp-like object)
  if (value && typeof value.toDate === 'function') {
    return value;
  }
  
  // Convert to Date first, then to Timestamp
  const date = safeToDate(value);
  if (date) {
    return Timestamp.fromDate(date);
  }
  
  return null;
}

// ============ PATIENT SCHEMA ============

/**
 * Patient document schema for Firestore
 * Path: organizations/{orgId}/patients/{patientId}
 */
export const createPatientSchema = (data) => ({
  // Basic Info
  name: data.name || '',
  mrNumber: data.mrNumber || '',
  dateOfBirth: safeToTimestamp(data.dateOfBirth),
  
  // Admission Info
  admissionDate: safeToTimestamp(data.admissionDate),
  startOfCare: safeToTimestamp(data.startOfCare),
  
  // Benefit Period Tracking
  startingBenefitPeriod: parseInt(data.startingBenefitPeriod) || 1,
  isReadmission: data.isReadmission || false,
  priorHospiceDays: parseInt(data.priorHospiceDays) || 0,
  
  // F2F Tracking
  f2fRequired: data.f2fRequired || false,
  f2fCompleted: data.f2fCompleted || false,
  f2fDate: safeToTimestamp(data.f2fDate),
  f2fPhysician: data.f2fPhysician || '',
  
  // HUV Tracking
  huv1Completed: data.huv1Completed || false,
  huv1Date: safeToTimestamp(data.huv1Date),
  huv2Completed: data.huv2Completed || false,
  huv2Date: safeToTimestamp(data.huv2Date),
  
  // Physician Info
  attendingPhysician: data.attendingPhysician || '',
  
  // Status
  status: data.status || 'active',
  dischargeDate: safeToTimestamp(data.dischargeDate),
  dischargeReason: data.dischargeReason || '',
  
  // Metadata
  createdAt: data.createdAt || serverTimestamp(),
  updatedAt: serverTimestamp(),
  createdBy: data.createdBy || '',
  updatedBy: data.updatedBy || ''
});

/**
 * Convert Firestore document to patient object with calculations
 */
export const docToPatient = (doc) => {
  const data = doc.data();
  
  // Convert all date fields safely
  const patient = {
    id: doc.id,
    name: data.name || '',
    mrNumber: data.mrNumber || '',
    dateOfBirth: safeToDate(data.dateOfBirth),
    admissionDate: safeToDate(data.admissionDate),
    startOfCare: safeToDate(data.startOfCare),
    
    // Benefit Period fields
    startingBenefitPeriod: data.startingBenefitPeriod || 1,
    isReadmission: data.isReadmission || false,
    priorHospiceDays: data.priorHospiceDays || 0,
    
    // F2F fields
    f2fRequired: data.f2fRequired || false,
    f2fCompleted: data.f2fCompleted || false,
    f2fDate: safeToDate(data.f2fDate),
    f2fPhysician: data.f2fPhysician || '',
    
    // HUV fields
    huv1Completed: data.huv1Completed || false,
    huv1Date: safeToDate(data.huv1Date),
    huv2Completed: data.huv2Completed || false,
    huv2Date: safeToDate(data.huv2Date),
    
    // Other fields
    attendingPhysician: data.attendingPhysician || '',
    status: data.status || 'active',
    dischargeDate: safeToDate(data.dischargeDate),
    dischargeReason: data.dischargeReason || '',
    
    createdAt: safeToDate(data.createdAt),
    updatedAt: safeToDate(data.updatedAt)
  };
  
  // Calculate compliance data
  patient.compliance = calculatePatientCompliance(patient);
  
  return patient;
};

// ============ CRUD OPERATIONS ============

/**
 * Get all patients for an organization
 */
export async function getPatients(orgId, options = {}) {
  const { 
    status = 'active', 
    includeCalculations = true,
    orderByField = 'name'
  } = options;
  
  try {
    const patientsRef = collection(db, 'organizations', orgId, 'patients');
    let q;
    
    if (status === 'all') {
      q = query(patientsRef, orderBy(orderByField));
    } else {
      q = query(patientsRef, where('status', '==', status), orderBy(orderByField));
    }
    
    const snapshot = await getDocs(q);
    const patients = snapshot.docs.map(docToPatient);
    
    // Sort by urgency if calculations included
    if (includeCalculations) {
      patients.sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
        const aUrgency = a.compliance?.overallUrgency || 'normal';
        const bUrgency = b.compliance?.overallUrgency || 'normal';
        return urgencyOrder[aUrgency] - urgencyOrder[bUrgency];
      });
    }
    
    return patients;
  } catch (error) {
    console.error('Error getting patients:', error);
    throw error;
  }
}

/**
 * Get a single patient by ID
 */
export async function getPatient(orgId, patientId) {
  try {
    const patientRef = doc(db, 'organizations', orgId, 'patients', patientId);
    const snapshot = await getDoc(patientRef);
    
    if (!snapshot.exists()) {
      throw new Error('Patient not found');
    }
    
    return docToPatient(snapshot);
  } catch (error) {
    console.error('Error getting patient:', error);
    throw error;
  }
}

/**
 * Add a new patient
 */
export async function addPatient(orgId, patientData, userId) {
  try {
    // Determine if F2F is required based on period and readmission status
    const startingPeriod = parseInt(patientData.startingBenefitPeriod) || 1;
    const isReadmission = patientData.isReadmission || false;
    const f2fRequired = startingPeriod >= 3 || isReadmission;
    
    const patient = createPatientSchema({
      ...patientData,
      f2fRequired,
      createdBy: userId,
      updatedBy: userId
    });
    
    const patientsRef = collection(db, 'organizations', orgId, 'patients');
    const docRef = await addDoc(patientsRef, patient);
    
    return { id: docRef.id, ...patient };
  } catch (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
}

/**
 * Update a patient
 */
export async function updatePatient(orgId, patientId, updates, userId) {
  try {
    const patientRef = doc(db, 'organizations', orgId, 'patients', patientId);
    
    // Recalculate F2F requirement if period or readmission changed
    if ('startingBenefitPeriod' in updates || 'isReadmission' in updates) {
      const currentDoc = await getDoc(patientRef);
      const current = currentDoc.data();
      
      const startingPeriod = updates.startingBenefitPeriod ?? current.startingBenefitPeriod ?? 1;
      const isReadmission = updates.isReadmission ?? current.isReadmission ?? false;
      updates.f2fRequired = startingPeriod >= 3 || isReadmission;
    }
    
    // Convert dates to Timestamps
    const processedUpdates = { ...updates };
    const dateFields = ['admissionDate', 'startOfCare', 'f2fDate', 'huv1Date', 'huv2Date', 'dischargeDate', 'dateOfBirth'];
    
    dateFields.forEach(field => {
      if (field in processedUpdates) {
        processedUpdates[field] = safeToTimestamp(processedUpdates[field]);
      }
    });
    
    processedUpdates.updatedAt = serverTimestamp();
    processedUpdates.updatedBy = userId;
    
    await updateDoc(patientRef, processedUpdates);
    
    return { id: patientId, ...processedUpdates };
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
}

/**
 * Delete a patient (soft delete - set status to archived)
 */
export async function deletePatient(orgId, patientId, userId, hardDelete = false) {
  try {
    const patientRef = doc(db, 'organizations', orgId, 'patients', patientId);
    
    if (hardDelete) {
      await deleteDoc(patientRef);
    } else {
      await updateDoc(patientRef, {
        status: 'archived',
        updatedAt: serverTimestamp(),
        updatedBy: userId
      });
    }
    
    return { success: true, id: patientId };
  } catch (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }
}

// ============ SPECIALIZED QUERIES ============

/**
 * Get patients requiring certification attention
 */
export async function getPatientsNeedingCertification(orgId) {
  const patients = await getPatients(orgId, { status: 'active' });
  
  return patients.filter(p => {
    const cti = p.compliance?.cti;
    if (!cti) return false;
    return cti.urgency === 'critical' || cti.urgency === 'high';
  });
}

/**
 * Get patients requiring F2F encounters
 */
export async function getPatientsNeedingF2F(orgId) {
  const patients = await getPatients(orgId, { status: 'active' });
  
  return patients.filter(p => {
    const cti = p.compliance?.cti;
    return cti?.requiresF2F && !cti?.f2fCompleted;
  }).sort((a, b) => {
    const aOverdue = a.compliance?.cti?.f2fOverdue ? 0 : 1;
    const bOverdue = b.compliance?.cti?.f2fOverdue ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    
    const aDeadline = a.compliance?.cti?.f2fDeadline;
    const bDeadline = b.compliance?.cti?.f2fDeadline;
    return (aDeadline || 0) - (bDeadline || 0);
  });
}

/**
 * Get patients requiring HUV action
 */
export async function getPatientsNeedingHUV(orgId) {
  const patients = await getPatients(orgId, { status: 'active' });
  
  return patients.filter(p => {
    const huv = p.compliance?.huv;
    return huv?.anyOverdue || huv?.anyActionNeeded;
  });
}

/**
 * Get patients in 60-day benefit periods
 */
export async function getPatientsIn60DayPeriods(orgId) {
  const patients = await getPatients(orgId, { status: 'active' });
  
  return patients.filter(p => p.compliance?.cti?.isInSixtyDayPeriod);
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(orgId) {
  const patients = await getPatients(orgId, { status: 'active' });
  
  const stats = {
    totalActive: patients.length,
    upcomingRecerts: 0,
    overdueRecerts: 0,
    in60DayPeriods: 0,
    f2fRequired: 0,
    f2fOverdue: 0,
    huvActionNeeded: 0,
    huvOverdue: 0,
    readmissions: 0,
    byUrgency: { critical: 0, high: 0, medium: 0, normal: 0 }
  };
  
  patients.forEach(p => {
    const cti = p.compliance?.cti;
    const huv = p.compliance?.huv;
    const urgency = p.compliance?.overallUrgency || 'normal';
    
    stats.byUrgency[urgency]++;
    
    if (cti) {
      if (cti.isOverdue) stats.overdueRecerts++;
      else if (cti.daysUntilCertEnd <= 14) stats.upcomingRecerts++;
      
      if (cti.isInSixtyDayPeriod) stats.in60DayPeriods++;
      if (cti.requiresF2F && !cti.f2fCompleted) stats.f2fRequired++;
      if (cti.f2fOverdue) stats.f2fOverdue++;
      if (p.isReadmission) stats.readmissions++;
    }
    
    if (huv) {
      if (huv.anyActionNeeded) stats.huvActionNeeded++;
      if (huv.anyOverdue) stats.huvOverdue++;
    }
  });
  
  return stats;
}

// ============ MARK COMPLETION HELPERS ============

/**
 * Mark F2F as completed
 */
export async function markF2FCompleted(orgId, patientId, f2fDate, physician, userId) {
  return updatePatient(orgId, patientId, {
    f2fCompleted: true,
    f2fDate: f2fDate,
    f2fPhysician: physician
  }, userId);
}

/**
 * Mark HUV1 as completed
 */
export async function markHUV1Completed(orgId, patientId, completedDate, userId) {
  return updatePatient(orgId, patientId, {
    huv1Completed: true,
    huv1Date: completedDate
  }, userId);
}

/**
 * Mark HUV2 as completed
 */
export async function markHUV2Completed(orgId, patientId, completedDate, userId) {
  return updatePatient(orgId, patientId, {
    huv2Completed: true,
    huv2Date: completedDate
  }, userId);
}

export default {
  getPatients,
  getPatient,
  addPatient,
  updatePatient,
  deletePatient,
  getPatientsNeedingCertification,
  getPatientsNeedingF2F,
  getPatientsNeedingHUV,
  getPatientsIn60DayPeriods,
  getDashboardStats,
  markF2FCompleted,
  markHUV1Completed,
  markHUV2Completed
};