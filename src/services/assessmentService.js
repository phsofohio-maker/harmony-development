/**
 * Harmony Health Care Assistant
 * Assessment Service — CRUD for clinical visit assessments
 *
 * Data lives at: organizations/{orgId}/patients/{patientId}/visits/{visitId}
 *
 * Implements the Tier 2 (encounter setup) + Tier 3 (per-visit clinical data)
 * schema from the HHCA CTI 1.2.0 plan.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ============ HELPERS ============

function safeToDate(value) {
  if (!value) return null;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function safeToTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value && typeof value.toDate === 'function') return value;
  const date = safeToDate(value);
  return date ? Timestamp.fromDate(date) : null;
}

// ============ SCHEMA ============

/**
 * Full default object for a new assessment.
 * Covers Tier 2 (encounter setup) and Tier 3 (clinical data) fields.
 */
export function createAssessmentSchema(data = {}) {
  return {
    // ── Tier 2: Encounter Setup ─────────────────────────────────
    visitDate: data.visitDate || new Date().toISOString().split('T')[0],
    timeIn: data.timeIn || '',
    timeOut: data.timeOut || '',
    providerName: data.providerName || '',
    providerNpi: data.providerNpi || '',
    providerRole: data.providerRole || '',          // MD, DO, NP, PA, Hospice, Attending
    visitType: data.visitType || 'Routine',          // Routine, Urgent, F2F, Recert, Admission
    visitPurpose: Array.isArray(data.visitPurpose) ? data.visitPurpose : [],  // multi-select
    certType: data.certType || '',                   // Initial, Recertification, N/A

    // ── Tier 3: Clinical Narratives ─────────────────────────────
    hpiNarrative: data.hpiNarrative || '',
    comorbidityNarrative: data.comorbidityNarrative || '',
    clinicalNarrative: data.clinicalNarrative || '',

    // ── Tier 3: Vitals & Anthropometrics ────────────────────────
    vitalsBp: data.vitalsBp || '',                   // e.g. "120/80"
    vitalsHr: data.vitalsHr ?? '',
    vitalsResp: data.vitalsResp ?? '',
    vitalsO2: data.vitalsO2 ?? '',
    o2Type: data.o2Type || '',                       // Room Air, Oxygen Flow
    o2Liters: data.o2Liters || '',
    weightCurrent: data.weightCurrent ?? '',
    weightPrior: data.weightPrior ?? '',
    weightUnit: data.weightUnit || 'lbs',

    // ── Tier 3: Functional Status ───────────────────────────────
    ppsCurrent: data.ppsCurrent ?? '',
    ppsPrior: data.ppsPrior ?? '',
    fastCurrent: data.fastCurrent || '',
    adlScoreCurrent: data.adlScoreCurrent || '',     // e.g. "4/6"
    adlDependent: data.adlDependent || {},           // { bathing: true, dressing: true, ... }
    ambulationStatus: data.ambulationStatus || '',   // Independent, Assist, Wheelchair, Bedbound
    intakeStatus: data.intakeStatus || '',           // Normal, Decreased, Minimal/Sips

    // ── Tier 3: Symptom Assessment (ESAS) ───────────────────────
    painScore: data.painScore ?? '',                 // 0-10
    painGoal: data.painGoal ?? '',                   // 0-10
    painRelief: data.painRelief || '',               // Effective, Partial, Inadequate
    symptomSeverity: data.symptomSeverity || {},     // { dyspnea: 'Mild', nausea: 'None', ... }
    symptomNotes: data.symptomNotes || '',

    // ── Tier 3: Physical Exam / ROS ─────────────────────────────
    examWnl: data.examWnl || {},                     // { heent: true, cardio: true, ... }
    examAbn: data.examAbn || {},                     // { respiratory: true, skin: true, ... }
    examFindingsNarrative: data.examFindingsNarrative || '',
    phq2Score: data.phq2Score ?? '',                 // 0-6

    // ── Tier 3: LCD & Eligibility ───────────────────────────────
    lcdCriteria: data.lcdCriteria || {},             // { weightLoss: true, albumin: false, ... }

    // ── Tier 3: Plan of Care & Orders ───────────────────────────
    medChanges: data.medChanges || {},               // { new: false, discontinued: false, ... }
    medChangeDetails: data.medChangeDetails || '',
    ordersDme: data.ordersDme || '',
    locChange: data.locChange || '',
    referrals: data.referrals || {},                 // { chaplain: true, socialWorker: false, ... }
    discussedWith: data.discussedWith || {},          // { patient: true, family: true, ... }

    // ── Metadata ────────────────────────────────────────────────
    patientId: data.patientId || '',
    organizationId: data.organizationId || '',
    createdBy: data.createdBy || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    status: data.status || 'draft',                  // draft | complete | paper | deleted
  };
}

// ============ CRUD OPERATIONS ============

/**
 * Add a new assessment (visit) for a patient.
 * Auto-sets organizationId, createdBy, timestamps, and status.
 */
export async function addAssessment(orgId, patientId, data, userId) {
  const schema = createAssessmentSchema({
    ...data,
    patientId,
    organizationId: orgId,
    createdBy: userId,
    status: 'draft',
  });

  // Convert visitDate to timestamp for Firestore ordering
  if (schema.visitDate && typeof schema.visitDate === 'string') {
    schema.visitDateTs = safeToTimestamp(schema.visitDate);
  }

  schema.createdAt = serverTimestamp();
  schema.updatedAt = serverTimestamp();

  const visitsRef = collection(db, 'organizations', orgId, 'patients', patientId, 'visits');
  const docRef = await addDoc(visitsRef, schema);

  return { id: docRef.id, ...schema };
}

/**
 * Update an existing assessment. Partial update with merge.
 */
export async function updateAssessment(orgId, patientId, assessmentId, data) {
  const visitRef = doc(db, 'organizations', orgId, 'patients', patientId, 'visits', assessmentId);

  const updates = { ...data };

  // Re-compute visitDateTs if visitDate changed
  if (updates.visitDate && typeof updates.visitDate === 'string') {
    updates.visitDateTs = safeToTimestamp(updates.visitDate);
  }

  updates.updatedAt = serverTimestamp();

  await updateDoc(visitRef, updates);
  return { id: assessmentId, ...updates };
}

/**
 * Get a single assessment by ID. Returns null if not found.
 */
export async function getAssessment(orgId, patientId, assessmentId) {
  const visitRef = doc(db, 'organizations', orgId, 'patients', patientId, 'visits', assessmentId);
  const snapshot = await getDoc(visitRef);

  if (!snapshot.exists()) return null;

  return docToAssessment(snapshot);
}

/**
 * List assessments for a patient.
 * @param {Object} options - { status, limit, orderByField }
 */
export async function getAssessments(orgId, patientId, options = {}) {
  const {
    status = null,
    limit: maxResults = 50,
    orderByField = 'visitDate',
    orderDirection = 'desc',
    excludeDeleted = true,
  } = options;

  const visitsRef = collection(db, 'organizations', orgId, 'patients', patientId, 'visits');

  const constraints = [];

  if (status) {
    constraints.push(where('status', '==', status));
  } else if (excludeDeleted) {
    constraints.push(where('status', '!=', 'deleted'));
  }

  // Use visitDateTs for ordering if available, otherwise fall back
  const orderField = orderByField === 'visitDate' ? 'visitDate' : orderByField;
  constraints.push(orderBy(orderField, orderDirection));

  if (maxResults) {
    constraints.push(firestoreLimit(maxResults));
  }

  const q = query(visitsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docToAssessment);
}

/**
 * Soft-delete an assessment (sets status to 'deleted').
 */
export async function deleteAssessment(orgId, patientId, assessmentId) {
  const visitRef = doc(db, 'organizations', orgId, 'patients', patientId, 'visits', assessmentId);
  await updateDoc(visitRef, {
    status: 'deleted',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Complete an assessment. Validates required fields before marking complete.
 * Returns { success: true } or throws with validation errors.
 */
export async function completeAssessment(orgId, patientId, assessmentId) {
  const visitRef = doc(db, 'organizations', orgId, 'patients', patientId, 'visits', assessmentId);
  const snapshot = await getDoc(visitRef);

  if (!snapshot.exists()) {
    throw new Error('Assessment not found');
  }

  const data = snapshot.data();

  // Validate required fields
  const errors = [];
  if (!data.visitDate) errors.push('Visit date is required');
  if (!data.providerName) errors.push('Provider name is required');
  if (!data.visitType) errors.push('Visit type is required');

  if (errors.length > 0) {
    const err = new Error('Validation failed');
    err.validationErrors = errors;
    throw err;
  }

  await updateDoc(visitRef, {
    status: 'complete',
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

// ============ CONVERTER ============

/**
 * Convert a Firestore visit document to a JS assessment object.
 * Provides safe defaults for every field.
 */
export function docToAssessment(docSnapshot) {
  const data = docSnapshot.data();

  return {
    id: docSnapshot.id,

    // Tier 2
    visitDate: data.visitDate || '',
    timeIn: data.timeIn || '',
    timeOut: data.timeOut || '',
    providerName: data.providerName || '',
    providerNpi: data.providerNpi || '',
    providerRole: data.providerRole || '',
    visitType: data.visitType || '',
    visitPurpose: Array.isArray(data.visitPurpose) ? data.visitPurpose : [],
    certType: data.certType || '',

    // Tier 3: Narratives
    hpiNarrative: data.hpiNarrative || '',
    comorbidityNarrative: data.comorbidityNarrative || '',
    clinicalNarrative: data.clinicalNarrative || '',

    // Tier 3: Vitals
    vitalsBp: data.vitalsBp || '',
    vitalsHr: data.vitalsHr ?? '',
    vitalsResp: data.vitalsResp ?? '',
    vitalsO2: data.vitalsO2 ?? '',
    o2Type: data.o2Type || '',
    o2Liters: data.o2Liters || '',
    weightCurrent: data.weightCurrent ?? '',
    weightPrior: data.weightPrior ?? '',
    weightUnit: data.weightUnit || 'lbs',

    // Tier 3: Functional Status
    ppsCurrent: data.ppsCurrent ?? '',
    ppsPrior: data.ppsPrior ?? '',
    fastCurrent: data.fastCurrent || '',
    adlScoreCurrent: data.adlScoreCurrent || '',
    adlDependent: data.adlDependent || {},
    ambulationStatus: data.ambulationStatus || '',
    intakeStatus: data.intakeStatus || '',

    // Tier 3: Symptoms
    painScore: data.painScore ?? '',
    painGoal: data.painGoal ?? '',
    painRelief: data.painRelief || '',
    symptomSeverity: data.symptomSeverity || {},
    symptomNotes: data.symptomNotes || '',

    // Tier 3: Physical Exam
    examWnl: data.examWnl || {},
    examAbn: data.examAbn || {},
    examFindingsNarrative: data.examFindingsNarrative || '',
    phq2Score: data.phq2Score ?? '',

    // Tier 3: LCD
    lcdCriteria: data.lcdCriteria || {},

    // Tier 3: Plan of Care
    medChanges: data.medChanges || {},
    medChangeDetails: data.medChangeDetails || '',
    ordersDme: data.ordersDme || '',
    locChange: data.locChange || '',
    referrals: data.referrals || {},
    discussedWith: data.discussedWith || {},

    // Metadata
    patientId: data.patientId || '',
    organizationId: data.organizationId || '',
    createdBy: data.createdBy || '',
    createdAt: safeToDate(data.createdAt),
    updatedAt: safeToDate(data.updatedAt),
    status: data.status || 'draft',
  };
}
