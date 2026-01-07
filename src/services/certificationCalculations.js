/**
 * Harmony Health Care Assistant
 * Certification Calculations with Benefit Period Continuity
 * 
 * Medicare Hospice Benefit Periods:
 * - Period 1: Initial 90 days
 * - Period 2: Second 90 days  
 * - Period 3+: Subsequent 60-day periods (unlimited)
 * 
 * Face-to-Face (F2F) Requirements:
 * - Required for Period 3 and all subsequent periods
 * - Required for readmissions (returning patients)
 * - Must occur within 30 days before the start of the benefit period
 */

// ============ UTILITY FUNCTIONS ============

/**
 * Normalize date to midnight for accurate comparisons
 */
export function normalizeDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calculate days between two dates
 */
export function calculateDaysBetween(startDate, endDate) {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end) return 0;
  const diffTime = Math.abs(end - start);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Format date as MM/DD/YYYY
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// ============ CTI BENEFIT PERIOD CALCULATIONS ============

/**
 * Determine certification period details based on benefit period number
 * 
 * @param {number} benefitPeriodNumber - The current benefit period (1, 2, 3, etc.)
 * @param {boolean} isReadmission - Whether this is a returning patient
 * @returns {object} Period info with name, documents, duration, and F2F requirements
 */
export function determineCertPeriodByBenefit(benefitPeriodNumber, isReadmission = false) {
  const periodNum = parseInt(benefitPeriodNumber) || 1;
  
  // F2F is required for period 3+ OR any readmission
  const requiresF2F = periodNum >= 3 || isReadmission;
  
  if (periodNum === 1) {
    return {
      name: 'Initial Period (1st 90 days)',
      shortName: 'Initial 90-Day',
      periodNumber: 1,
      durationDays: 90,
      documentTypes: ['90DAY_INITIAL', 'ATTEND_CERT', 'PATIENT_HISTORY'],
      requiresF2F: isReadmission,
      notifyDaysBefore: 14,
      periodType: '90day'
    };
  } else if (periodNum === 2) {
    return {
      name: 'Second Period (2nd 90 days)',
      shortName: '2nd 90-Day',
      periodNumber: 2,
      durationDays: 90,
      documentTypes: ['90DAY_SECOND', 'PROGRESS_NOTE'],
      requiresF2F: isReadmission,
      notifyDaysBefore: 14,
      periodType: '90day'
    };
  } else {
    return {
      name: `Subsequent Period (${periodNum}${getOrdinalSuffix(periodNum)} 60-day)`,
      shortName: `${periodNum}${getOrdinalSuffix(periodNum)} 60-Day`,
      periodNumber: periodNum,
      durationDays: 60,
      documentTypes: ['60DAY', 'PROGRESS_NOTE'],
      requiresF2F: true,
      notifyDaysBefore: 10,
      periodType: '60day'
    };
  }
}

/**
 * Calculate current benefit period based on starting period and days elapsed
 * 
 * @param {number} startingPeriod - The benefit period at admission
 * @param {number} daysSinceAdmission - Days since current admission
 * @returns {object} Current period tracking info
 */
export function calculateCurrentBenefitPeriod(startingPeriod, daysSinceAdmission) {
  const start = parseInt(startingPeriod) || 1;
  let currentPeriod = start;
  let daysRemaining = daysSinceAdmission;
  let periodStartDay = 0;
  
  while (true) {
    const periodDuration = (currentPeriod <= 2) ? 90 : 60;
    
    if (daysRemaining <= periodDuration) {
      return {
        currentPeriod,
        daysIntoPeriod: daysRemaining,
        daysRemainingInPeriod: periodDuration - daysRemaining,
        periodDuration,
        periodStartDay,
        periodEndDay: periodStartDay + periodDuration
      };
    }
    
    daysRemaining -= periodDuration;
    periodStartDay += periodDuration;
    currentPeriod++;
  }
}

/**
 * Calculate all CTI certification dates and requirements for a patient
 * 
 * @param {object} patient - Patient object with admission data
 * @returns {object} Complete certification calculation results
 */
export function calculateCTICertification(patient) {
  const {
    admissionDate,
    startingBenefitPeriod = 1,
    isReadmission = false,
    f2fCompleted = false,
    f2fDate = null
  } = patient;

  if (!admissionDate) {
    return null;
  }

  const admission = new Date(admissionDate);
  const today = normalizeDate(new Date());
  const daysSinceAdmission = calculateDaysBetween(admission, today);
  
  // Get current period tracking
  const periodTracking = calculateCurrentBenefitPeriod(startingBenefitPeriod, daysSinceAdmission);
  const certPeriod = determineCertPeriodByBenefit(periodTracking.currentPeriod, isReadmission);
  
  // Calculate certification end date
  const certEndDate = addDays(admission, periodTracking.periodEndDay);
  
  // Calculate notification date
  const notifyDate = addDays(certEndDate, -certPeriod.notifyDaysBefore);
  
  // Calculate F2F deadline (must be completed by period start)
  let f2fDeadline = null;
  let f2fDaysRemaining = null;
  if (certPeriod.requiresF2F) {
    f2fDeadline = addDays(admission, periodTracking.periodStartDay);
    f2fDaysRemaining = calculateDaysBetween(today, f2fDeadline);
  }
  
  // Determine F2F reason
  let f2fReason = null;
  if (certPeriod.requiresF2F) {
    if (isReadmission && periodTracking.currentPeriod >= 3) {
      f2fReason = 'Readmission + Period 3+';
    } else if (isReadmission) {
      f2fReason = 'Readmission';
    } else {
      f2fReason = 'Period 3+';
    }
  }
  
  // Calculate next period info
  const nextPeriodNum = periodTracking.currentPeriod + 1;
  const nextPeriod = determineCertPeriodByBenefit(nextPeriodNum, false);
  
  // Determine status
  const daysUntilCertEnd = calculateDaysBetween(today, certEndDate);
  let status = 'current';
  let urgency = 'normal';
  
  if (daysUntilCertEnd < 0) {
    status = 'overdue';
    urgency = 'critical';
  } else if (daysUntilCertEnd <= 7) {
    status = 'due-soon';
    urgency = 'high';
  } else if (daysUntilCertEnd <= 14) {
    status = 'upcoming';
    urgency = 'medium';
  }

  return {
    // Period tracking
    currentBenefitPeriod: periodTracking.currentPeriod,
    periodName: certPeriod.name,
    periodShortName: certPeriod.shortName,
    periodType: certPeriod.periodType,
    periodDuration: certPeriod.durationDays,
    daysIntoPeriod: periodTracking.daysIntoPeriod,
    daysRemainingInPeriod: periodTracking.daysRemainingInPeriod,
    
    // Important dates
    admissionDate: admission,
    certificationEndDate: certEndDate,
    notifyDate: notifyDate,
    daysUntilCertEnd,
    
    // Status
    status,
    urgency,
    isOverdue: daysUntilCertEnd < 0,
    isInSixtyDayPeriod: periodTracking.currentPeriod >= 3,
    
    // F2F requirements
    requiresF2F: certPeriod.requiresF2F,
    f2fReason,
    f2fDeadline,
    f2fDaysRemaining,
    f2fCompleted,
    f2fDate: f2fDate ? new Date(f2fDate) : null,
    f2fOverdue: certPeriod.requiresF2F && !f2fCompleted && f2fDaysRemaining < 0,
    
    // Documents needed
    requiredDocuments: certPeriod.documentTypes,
    
    // Next period preview
    nextPeriod: {
      periodNumber: nextPeriodNum,
      name: nextPeriod.shortName,
      duration: nextPeriod.durationDays,
      requiresF2F: nextPeriod.requiresF2F,
      startsOn: certEndDate
    },
    
    // Readmission flag
    isReadmission
  };
}

// ============ HUV CALCULATIONS ============

/**
 * Calculate HUV (HOPE Update Visit) windows
 * HUV1: Days 5-14 from Start of Care
 * HUV2: Days 15-28 from Start of Care
 * 
 * @param {Date|string} startOfCare - The start of care date
 * @returns {object} HUV window dates and status
 */
export function calculateHUVWindows(startOfCare) {
  if (!startOfCare) return null;
  
  const soc = new Date(startOfCare);
  const today = normalizeDate(new Date());
  
  const huv1Start = addDays(soc, 5);
  const huv1End = addDays(soc, 14);
  const huv2Start = addDays(soc, 15);
  const huv2End = addDays(soc, 28);
  
  return {
    huv1: {
      startDate: huv1Start,
      endDate: huv1End,
      windowText: `${formatDate(huv1Start)} - ${formatDate(huv1End)}`
    },
    huv2: {
      startDate: huv2Start,
      endDate: huv2End,
      windowText: `${formatDate(huv2Start)} - ${formatDate(huv2End)}`
    }
  };
}

/**
 * Calculate complete HUV status for a patient
 * 
 * @param {object} patient - Patient object with HUV data
 * @returns {object} Complete HUV calculation results
 */
export function calculateHUVStatus(patient) {
  const {
    startOfCare,
    huv1Completed = false,
    huv1Date = null,
    huv2Completed = false,
    huv2Date = null
  } = patient;

  if (!startOfCare) return null;

  const windows = calculateHUVWindows(startOfCare);
  const today = normalizeDate(new Date());

  // Calculate HUV1 status
  let huv1Status = 'upcoming';
  if (huv1Completed) {
    huv1Status = 'complete';
  } else if (today > windows.huv1.endDate) {
    huv1Status = 'overdue';
  } else if (today >= windows.huv1.startDate) {
    huv1Status = 'action-needed';
  }

  // Calculate HUV2 status
  let huv2Status = 'upcoming';
  if (huv2Completed) {
    huv2Status = 'complete';
  } else if (today > windows.huv2.endDate) {
    huv2Status = 'overdue';
  } else if (today >= windows.huv2.startDate) {
    huv2Status = 'action-needed';
  }

  return {
    ...windows,
    huv1: {
      ...windows.huv1,
      completed: huv1Completed,
      completedDate: huv1Date ? new Date(huv1Date) : null,
      status: huv1Status,
      isOverdue: huv1Status === 'overdue',
      needsAction: huv1Status === 'action-needed'
    },
    huv2: {
      ...windows.huv2,
      completed: huv2Completed,
      completedDate: huv2Date ? new Date(huv2Date) : null,
      status: huv2Status,
      isOverdue: huv2Status === 'overdue',
      needsAction: huv2Status === 'action-needed'
    },
    anyOverdue: huv1Status === 'overdue' || huv2Status === 'overdue',
    anyActionNeeded: huv1Status === 'action-needed' || huv2Status === 'action-needed'
  };
}

// ============ COMBINED PATIENT CALCULATIONS ============

/**
 * Calculate all compliance data for a patient (CTI + HUV)
 * 
 * @param {object} patient - Full patient object from Firestore
 * @returns {object} Complete compliance calculations
 */
export function calculatePatientCompliance(patient) {
  const cti = calculateCTICertification(patient);
  const huv = calculateHUVStatus(patient);
  
  // Determine overall urgency
  let overallUrgency = 'normal';
  const urgencies = [];
  
  if (cti) {
    urgencies.push(cti.urgency);
    if (cti.f2fOverdue) urgencies.push('critical');
  }
  
  if (huv) {
    if (huv.anyOverdue) urgencies.push('critical');
    else if (huv.anyActionNeeded) urgencies.push('high');
  }
  
  if (urgencies.includes('critical')) overallUrgency = 'critical';
  else if (urgencies.includes('high')) overallUrgency = 'high';
  else if (urgencies.includes('medium')) overallUrgency = 'medium';
  
  return {
    cti,
    huv,
    overallUrgency,
    hasIssues: overallUrgency === 'critical' || overallUrgency === 'high',
    lastCalculated: new Date()
  };
}

export default {
  normalizeDate,
  calculateDaysBetween,
  addDays,
  formatDate,
  determineCertPeriodByBenefit,
  calculateCurrentBenefitPeriod,
  calculateCTICertification,
  calculateHUVWindows,
  calculateHUVStatus,
  calculatePatientCompliance
};