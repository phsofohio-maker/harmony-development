/**
 * Checkbox Logic Handler — Unicode checkbox utility for document generation
 *
 * Resolves checkbox field values to ☑ (checked) or ☐ (unchecked) Unicode
 * characters for use in generated PDFs and documents.
 *
 * Supports three modes:
 *   1. Boolean mode:  resolveCheckbox(true)           → '☑'
 *   2. String match:  resolveCheckbox('Male', 'Male') → '☑'
 *   3. Array match:   resolveCheckbox(['A','B'], 'A') → '☑'
 */

const CHECKED = '☑';
const UNCHECKED = '☐';

/**
 * Resolve a single checkbox value.
 *
 * @param {*} value      - The stored value (boolean, string, or array)
 * @param {string} [matchValue] - If provided, check whether value matches this
 * @returns {string} '☑' or '☐'
 */
function resolveCheckbox(value, matchValue) {
  // Null / undefined → unchecked
  if (value == null) return UNCHECKED;

  // No matchValue → boolean mode
  if (matchValue === undefined) {
    return value ? CHECKED : UNCHECKED;
  }

  // Array mode
  if (Array.isArray(value)) {
    return value.includes(matchValue) ? CHECKED : UNCHECKED;
  }

  // String / exact match mode
  return value === matchValue ? CHECKED : UNCHECKED;
}

/**
 * Checkbox field definitions for all 23 CBX_ variables.
 *
 * Each entry maps a CBX_ prefix to:
 *   - sourceField:  the raw data field name
 *   - options:      the set of option values that generate sub-checkboxes
 *                   (if omitted, the field is treated as boolean)
 */
const CHECKBOX_DEFINITIONS = {
  CBX_GENDER: {
    sourceField: 'gender',
    options: ['Male', 'Female', 'Other', 'Unknown'],
  },
  CBX_VISIT_TYPE: {
    sourceField: 'visitType',
    options: ['Routine', 'Urgent', 'F2F', 'Recert', 'Admission'],
  },
  CBX_VISIT_PURPOSE: {
    sourceField: 'visitPurpose',
    options: [
      'Routine Oversight', 'Symptom Crisis', 'Admission',
      'Medication Review', 'Family Conference', 'Recertification',
    ],
  },
  CBX_PROVIDER_ROLE: {
    sourceField: 'providerRole',
    options: ['MD', 'DO', 'NP', 'PA', 'Hospice', 'Attending'],
  },
  CBX_BENEFIT_PERIOD: {
    sourceField: 'currentBenefitPeriod',
    options: ['1st', '2nd', '3rd', '4th+'],
  },
  CBX_CERT_TYPE: {
    sourceField: 'certType',
    options: ['Initial', 'Recertification', 'N/A'],
  },
  CBX_F2F_STATUS: {
    sourceField: 'f2fRequired',
    // boolean mode — no options
  },
  CBX_F2F_ROLE: {
    sourceField: 'f2fProviderRole',
    options: ['MD', 'DO', 'NP', 'PA', 'Hospice', 'Attending'],
  },
  CBX_DX_RELATED: {
    sourceField: '__per_diagnosis__',
    matchValue: 'Related',
  },
  CBX_DX_UNRELATED: {
    sourceField: '__per_diagnosis__',
    matchValue: 'Unrelated',
  },
  CBX_O2_TYPE: {
    sourceField: 'o2Type',
    options: ['Room Air', 'Oxygen Flow'],
  },
  CBX_ADL_DEPENDENT: {
    sourceField: 'adlDependent',
    options: ['Bathing', 'Dressing', 'Feeding', 'Toileting', 'Transferring', 'Continence'],
  },
  CBX_AMBULATION: {
    sourceField: 'ambulationStatus',
    options: ['Independent', 'Assist', 'Wheelchair', 'Bedbound'],
  },
  CBX_INTAKE: {
    sourceField: 'intakeStatus',
    options: ['Normal', 'Decreased', 'Minimal/Sips'],
  },
  CBX_PAIN_RELIEF: {
    sourceField: 'painRelief',
    options: ['Effective', 'Partial', 'Inadequate'],
  },
  CBX_SYMPTOM_SEVERITY: {
    sourceField: 'symptomSeverity',
    options: ['Dyspnea', 'Nausea', 'Fatigue', 'Anxiety', 'Depression', 'Drowsiness', 'Appetite', 'Wellbeing'],
  },
  CBX_EXAM_WNL: {
    sourceField: 'examWnl',
    options: ['HEENT', 'Cardiovascular', 'Respiratory', 'GI', 'GU', 'Musculoskeletal', 'Neurological', 'Skin', 'Psych'],
  },
  CBX_EXAM_ABN: {
    sourceField: 'examAbn',
    options: ['HEENT', 'Cardiovascular', 'Respiratory', 'GI', 'GU', 'Musculoskeletal', 'Neurological', 'Skin', 'Psych'],
  },
  CBX_LCD_CRITERIA: {
    sourceField: 'lcdCriteria',
    options: ['Weight loss >10%', 'Albumin <2.5', 'Recurrent infections', 'Declining functional status', 'Dysphagia', 'Frequent ER visits/hospitalizations'],
  },
  CBX_MED_CHANGES: {
    sourceField: 'medChanges',
    options: ['New', 'Discontinued', 'Adjusted', 'None'],
  },
  CBX_LOC: {
    sourceField: 'locChange',
    options: ['Routine', 'Continuous', 'Respite', 'GIP'],
  },
  CBX_REFERRALS: {
    sourceField: 'referrals',
    options: ['Chaplain', 'Social Worker', 'Volunteer', 'Music/Art Therapy'],
  },
  CBX_DISCUSSED_WITH: {
    sourceField: 'discussedWith',
    options: ['Patient', 'Family', 'IDG', 'Case Manager'],
  },
};

/**
 * Resolve all CBX_ fields in one pass.
 *
 * @param {Object} data - Combined patient + assessment data
 * @returns {Object} Flat map like { 'CBX_GENDER_MALE': '☑', 'CBX_GENDER_FEMALE': '☐', ... }
 */
function resolveAllCheckboxes(data) {
  if (!data) return {};

  const result = {};

  for (const [prefix, def] of Object.entries(CHECKBOX_DEFINITIONS)) {
    // Skip per-diagnosis fields — handled separately in prepareMergeData
    if (def.sourceField === '__per_diagnosis__') continue;

    const rawValue = data[def.sourceField];

    if (!def.options) {
      // Boolean mode
      result[prefix] = resolveCheckbox(rawValue);
      continue;
    }

    // Option-based mode: generate one key per option
    // The raw value can be a string (single-select), array (multi-select),
    // or object with boolean keys (checkbox map like { bathing: true })
    for (const option of def.options) {
      const key = `${prefix}_${option.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;

      if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
        // Object map mode: { bathing: true, dressing: false }
        // Use the option name (lowercase) as key lookup
        const lookupKey = option.toLowerCase().replace(/\s+/g, '_');
        // Try both exact and lowercased key
        const matched = rawValue[option] || rawValue[lookupKey] || false;
        result[key] = resolveCheckbox(matched);
      } else {
        result[key] = resolveCheckbox(rawValue, option);
      }
    }
  }

  return result;
}

module.exports = {
  resolveCheckbox,
  resolveAllCheckboxes,
  CHECKBOX_DEFINITIONS,
  CHECKED,
  UNCHECKED,
};
