/**
 * Format Adapters — date, name, NPI, and phone formatters for document generation
 *
 * Every function returns '' for null/undefined/invalid input — never throws.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ============ DATE ============

/**
 * Format a date value to a string.
 *
 * @param {*} value   - Firestore Timestamp, JS Date, ISO string, or null
 * @param {string} format - 'MM/DD/YYYY' | 'MONTH DD, YYYY' | 'YYYY-MM-DD'
 * @returns {string}
 */
function formatDate(value, format = 'MM/DD/YYYY') {
  const date = toDate(value);
  if (!date) return '';

  const y = date.getFullYear();
  const m = date.getMonth();        // 0-indexed
  const d = date.getDate();
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');

  switch (format) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${y}`;
    case 'MONTH DD, YYYY':
      return `${MONTH_NAMES[m]} ${d}, ${y}`;
    case 'YYYY-MM-DD':
      return `${y}-${mm}-${dd}`;
    default:
      return `${mm}/${dd}/${y}`;
  }
}

/**
 * Internal helper: coerce any date-like value to a JS Date.
 */
function toDate(value) {
  if (!value) return null;
  // Firestore Timestamp
  if (typeof value.toDate === 'function') return value.toDate();
  // Already a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  // String or number
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ============ NAME ============

/**
 * Format a patient name.
 *
 * @param {string} first
 * @param {string} last
 * @param {'FULL'|'LAST_FIRST'} format
 * @returns {string}
 */
function formatName(first, last, format = 'FULL') {
  const f = (first || '').trim();
  const l = (last || '').trim();

  if (!f && !l) return '';
  if (!f) return l;
  if (!l) return f;

  switch (format) {
    case 'LAST_FIRST':
      return `${l}, ${f}`;
    case 'FULL':
    default:
      return `${f} ${l}`;
  }
}

// ============ NPI ============

/**
 * Validate and return a 10-digit NPI string.
 * Returns '' if invalid.
 */
function formatNpi(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 10 ? digits : '';
}

// ============ PHONE ============

/**
 * Normalize a phone number to (555) 123-4567 format.
 * Handles 10-digit, 11-digit (strips leading 1), formatted, dashes, spaces.
 * Returns '' for null/undefined/invalid.
 */
function formatPhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');

  let normalized;
  if (digits.length === 10) {
    normalized = digits;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    normalized = digits.slice(1);
  } else {
    return '';
  }

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

// ============ BATCH FORMATTER ============

/**
 * Field-to-formatter mapping used by resolveAllFormats.
 *
 * Key: the output merge-field name (e.g. 'DOB')
 * Value: { source, formatter, args }
 *   - source:    property path on raw data (dot-notation)
 *   - formatter: one of the format functions above
 *   - args:      extra args passed after the value
 */
const FIELD_FORMAT_MAP = {
  // Patient dates
  DOB:             { source: 'dob',            formatter: formatDate, args: ['MM/DD/YYYY'] },
  ADMISSION_DATE:  { source: 'admissionDate',  formatter: formatDate, args: ['MM/DD/YYYY'] },
  ELECTION_DATE:   { source: 'electionDate',   formatter: formatDate, args: ['MM/DD/YYYY'] },
  CDATE_START:     { source: 'certStartDate',  formatter: formatDate, args: ['MM/DD/YYYY'] },
  CDATE_END:       { source: 'certEndDate',    formatter: formatDate, args: ['MM/DD/YYYY'] },
  F2F_DATE:        { source: 'f2fDate',        formatter: formatDate, args: ['MM/DD/YYYY'] },

  // Assessment date
  SELECT_DATE:     { source: 'visitDate',      formatter: formatDate, args: ['MM/DD/YYYY'] },

  // Diagnosis onset dates
  DX_DATE_1: { source: 'diagnoses.0.onsetDate', formatter: formatDate, args: ['MM/DD/YYYY'] },
  DX_DATE_2: { source: 'diagnoses.1.onsetDate', formatter: formatDate, args: ['MM/DD/YYYY'] },
  DX_DATE_3: { source: 'diagnoses.2.onsetDate', formatter: formatDate, args: ['MM/DD/YYYY'] },
  DX_DATE_4: { source: 'diagnoses.3.onsetDate', formatter: formatDate, args: ['MM/DD/YYYY'] },
  DX_DATE_5: { source: 'diagnoses.4.onsetDate', formatter: formatDate, args: ['MM/DD/YYYY'] },
  DX_DATE_6: { source: 'diagnoses.5.onsetDate', formatter: formatDate, args: ['MM/DD/YYYY'] },

  // Names
  PATIENT_NAME:              { source: '_name',  formatter: null },   // handled specially
  ATTENDING_PHYSICIAN_NAME:  { source: 'attendingPhysician.name', formatter: null },
  F2F_PROVIDER_NAME:         { source: 'f2fPhysician', formatter: null },

  // NPIs
  ATTENDING_PHYSICIAN_NPI: { source: 'attendingPhysician.npi', formatter: formatNpi },
  F2F_PROVIDER_NPI:        { source: 'f2fProviderNpi',        formatter: formatNpi },
  PROVIDER_NPI:            { source: 'providerNpi',           formatter: formatNpi },
  HOSPICE_NPI:             { source: '_org.npi',              formatter: formatNpi },

  // Phones
  PATIENT_PHONE:             { source: 'patientPhone',              formatter: formatPhone },
  ATTENDING_PHYSICIAN_PHONE: { source: 'attendingPhysician.phone',  formatter: formatPhone },
};

/**
 * Resolve a dot-notation path on an object.
 * e.g. resolve(obj, 'attendingPhysician.npi') → obj.attendingPhysician.npi
 */
function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    // Support array index notation: "diagnoses.0.onsetDate"
    const idx = Number(key);
    return !isNaN(idx) && Array.isArray(acc) ? acc[idx] : acc[key];
  }, obj);
}

/**
 * Apply all format adapters to a combined data object.
 *
 * @param {Object} data - Merged patient + assessment + org data
 * @returns {Object} Map of formatted field values
 */
function resolveAllFormats(data) {
  if (!data) return {};

  const result = {};

  for (const [fieldName, def] of Object.entries(FIELD_FORMAT_MAP)) {
    const rawValue = resolvePath(data, def.source);

    if (!def.formatter) {
      // No formatter — pass through as string
      result[fieldName] = rawValue != null ? String(rawValue) : '';
    } else if (def.args) {
      result[fieldName] = def.formatter(rawValue, ...def.args);
    } else {
      result[fieldName] = def.formatter(rawValue);
    }
  }

  return result;
}

module.exports = {
  formatDate,
  formatName,
  formatNpi,
  formatPhone,
  resolveAllFormats,
  resolvePath,
  FIELD_FORMAT_MAP,
};
