/**
 * Harmony Health Care Assistant
 * Organization Service - Firestore Operations for Organization Management
 *
 * Provides schema validation, CRUD helpers, and physician directory
 * management for the organization document.
 */

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ============ SCHEMA DEFAULTS ============

/**
 * Default shape for a new / empty organization document.
 * Used by the onboarding wizard and the migration script.
 */
export const ORG_DEFAULTS = {
  // Identity
  name: '',

  // Agency / Provider info
  agencyName: '',
  providerNumber: '',
  npi: '',
  phone: '',
  fax: '',
  address: '',
  city: '',
  state: '',
  zip: '',

  // Default clinical values
  defaultPhysician: '',
  defaultLevelOfCare: 'Routine',

  // Branding (managed by ThemeContext — listed for completeness)
  branding: {
    primaryColor: '#2563eb',
    logoUrl: null,
  },

  // Email & Notifications
  emailList: [],
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

  // Document template IDs (Google Docs)
  settings: {
    documentTemplates: {
      '60DAY': '',
      '90DAY_INITIAL': '',
      '90DAY_SECOND': '',
      'ATTEND_CERT': '',
      'PROGRESS_NOTE': '',
      'F2F_ENCOUNTER': '',
      'HOME_VISIT_ASSESSMENT': '',
    },
  },

  // Physician directory — array of physician objects
  physicians: [],

  // Onboarding
  onboardingCompleted: false,
  onboardingCompletedAt: null,
};

/**
 * Default shape for a physician entry in the directory.
 */
export const PHYSICIAN_DEFAULTS = {
  name: '',
  npi: '',
  role: 'attending',   // attending | hospice | f2f
  phone: '',
  fax: '',
  email: '',
  address: '',
  isActive: true,
};

// ============ READ ============

/**
 * Fetch the full organization document.
 * Returns null if not found.
 */
export async function getOrganization(orgId) {
  const snap = await getDoc(doc(db, 'organizations', orgId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ============ UPDATE ============

/**
 * Update organization-level fields (general settings, agency info, etc.).
 * Automatically stamps `updatedAt`.
 */
export async function updateOrganization(orgId, updates) {
  const ref = doc(db, 'organizations', orgId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update compliance threshold settings.
 */
export async function updateComplianceSettings(orgId, complianceUpdates) {
  const ref = doc(db, 'organizations', orgId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data().compliance || {} : {};
  await updateDoc(ref, {
    compliance: { ...current, ...complianceUpdates },
    updatedAt: serverTimestamp(),
  });
}

// ============ PHYSICIAN DIRECTORY ============

/**
 * Get the physician directory for an organization.
 * Returns an array (empty if none set).
 */
export async function getPhysicians(orgId) {
  const org = await getOrganization(orgId);
  return org?.physicians || [];
}

/**
 * Add a physician to the directory.
 * Returns the updated physicians array.
 */
export async function addPhysician(orgId, physician) {
  const org = await getOrganization(orgId);
  const physicians = org?.physicians || [];

  const newPhysician = {
    ...PHYSICIAN_DEFAULTS,
    ...physician,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const updated = [...physicians, newPhysician];
  await updateOrganization(orgId, { physicians: updated });
  return updated;
}

/**
 * Update an existing physician entry by id.
 */
export async function updatePhysician(orgId, physicianId, updates) {
  const org = await getOrganization(orgId);
  const physicians = (org?.physicians || []).map((p) =>
    p.id === physicianId ? { ...p, ...updates } : p
  );
  await updateOrganization(orgId, { physicians });
  return physicians;
}

/**
 * Remove a physician from the directory by id.
 */
export async function removePhysician(orgId, physicianId) {
  const org = await getOrganization(orgId);
  const physicians = (org?.physicians || []).filter((p) => p.id !== physicianId);
  await updateOrganization(orgId, { physicians });
  return physicians;
}

/**
 * Get active physicians filtered by role.
 * role: 'attending' | 'hospice' | 'f2f' | undefined (all)
 */
export async function getPhysiciansByRole(orgId, role) {
  const physicians = await getPhysicians(orgId);
  return physicians.filter(
    (p) => p.isActive && (!role || p.role === role)
  );
}
