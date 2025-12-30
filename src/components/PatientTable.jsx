/**
 * PatientTable.jsx - Patient List with Compliance Status
 * 
 * PURPOSE:
 * Display patient list with certification and HUV status indicators.
 * Supports click-through to patient detail/edit modal.
 * 
 * PROPS:
 * - patients: Array of patient objects with compliance data
 * - onPatientClick: Function called when a patient row is clicked
 */

import { formatDate } from '../services/certificationCalculations';

const PatientTable = ({ patients, onPatientClick }) => {
  
  // Empty state
  if (!patients || patients.length === 0) {
    return (
      <div className="empty-table">
        <span className="empty-icon">📋</span>
        <p>No patients found matching your criteria.</p>
        <style>{`
          .empty-table {
            padding: 3rem;
            text-align: center;
            color: #6b7280;
          }
          .empty-icon {
            font-size: 2.5rem;
            display: block;
            margin-bottom: 0.5rem;
          }
          .empty-table p {
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  // Get urgency badge
  const UrgencyBadge = ({ urgency }) => {
    const config = {
      critical: { bg: '#fee2e2', color: '#991b1b', label: 'Critical' },
      high: { bg: '#fef3c7', color: '#92400e', label: 'High' },
      medium: { bg: '#dbeafe', color: '#1e40af', label: 'Medium' },
      normal: { bg: '#f3f4f6', color: '#6b7280', label: 'Normal' },
    };
    const { bg, color, label } = config[urgency] || config.normal;
    
    return (
      <span className="urgency-badge" style={{ background: bg, color }}>
        {label}
      </span>
    );
  };

  // Get period badge
  const PeriodBadge = ({ cti, isReadmission }) => {
    if (!cti) return <span className="period-badge gray">N/A</span>;
    
    const is60Day = cti.isInSixtyDayPeriod;
    
    return (
      <div className="period-badges">
        <span className={`period-badge ${is60Day ? 'purple' : 'blue'}`}>
          {cti.periodShortName || `Period ${cti.currentBenefitPeriod}`}
        </span>
        {isReadmission && (
          <span className="period-badge indigo">Readmit</span>
        )}
        {cti.requiresF2F && !cti.f2fCompleted && (
          <span className="period-badge amber">F2F Needed</span>
        )}
      </div>
    );
  };

  // Get certification status display
  const CertStatus = ({ cti }) => {
    if (!cti) return <span className="cert-status gray">No data</span>;
    
    if (cti.isOverdue) {
      return (
        <span className="cert-status overdue">
          ⚠️ {Math.abs(cti.daysUntilCertEnd)} days overdue
        </span>
      );
    }
    
    if (cti.daysUntilCertEnd <= 7) {
      return (
        <span className="cert-status warning">
          ⏰ {cti.daysUntilCertEnd} days left
        </span>
      );
    }
    
    if (cti.daysUntilCertEnd <= 14) {
      return (
        <span className="cert-status upcoming">
          📅 {cti.daysUntilCertEnd} days
        </span>
      );
    }
    
    return (
      <span className="cert-status normal">
        {cti.daysUntilCertEnd} days
      </span>
    );
  };

  return (
    <div className="patient-table-wrapper">
      <table className="patient-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>MR #</th>
            <th>Admission</th>
            <th>Period</th>
            <th>Cert End</th>
            <th>Status</th>
            <th>Urgency</th>
          </tr>
        </thead>
        <tbody>
          {patients.map(patient => {
            const cti = patient.compliance?.cti;
            const urgency = patient.compliance?.overallUrgency || 'normal';
            
            return (
              <tr 
                key={patient.id}
                onClick={() => onPatientClick?.(patient)}
                className={`patient-row urgency-${urgency}`}
              >
                <td className="patient-name">
                  <span className="name-text">{patient.name}</span>
                </td>
                <td className="mr-number">{patient.mrNumber || '—'}</td>
                <td className="date-cell">
                  {formatDate(patient.admissionDate)}
                </td>
                <td>
                  <PeriodBadge cti={cti} isReadmission={patient.isReadmission} />
                </td>
                <td className="date-cell">
                  {cti ? formatDate(cti.certificationEndDate) : '—'}
                </td>
                <td>
                  <CertStatus cti={cti} />
                </td>
                <td>
                  <UrgencyBadge urgency={urgency} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .patient-table-wrapper {
          overflow-x: auto;
        }

        .patient-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 700px;
        }

        .patient-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
          white-space: nowrap;
        }

        .patient-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f3f4f6;
          font-size: 0.875rem;
          vertical-align: middle;
        }

        .patient-row {
          cursor: pointer;
          transition: background 0.15s;
        }

        .patient-row:hover {
          background: #f9fafb;
        }

        /* Urgency row highlighting */
        .patient-row.urgency-critical {
          border-left: 3px solid #ef4444;
        }

        .patient-row.urgency-high {
          border-left: 3px solid #f59e0b;
        }

        /* Patient Name */
        .patient-name {
          font-weight: 500;
          color: #1f2937;
        }

        .name-text {
          color: #2563eb;
        }

        .name-text:hover {
          text-decoration: underline;
        }

        /* MR Number */
        .mr-number {
          color: #6b7280;
          font-size: 0.8125rem;
        }

        /* Date cells */
        .date-cell {
          white-space: nowrap;
          color: #374151;
        }

        /* Period Badges */
        .period-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .period-badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          white-space: nowrap;
        }

        .period-badge.blue {
          background: #dbeafe;
          color: #1e40af;
        }

        .period-badge.purple {
          background: #f3e8ff;
          color: #6b21a8;
        }

        .period-badge.indigo {
          background: #e0e7ff;
          color: #3730a3;
        }

        .period-badge.amber {
          background: #fef3c7;
          color: #92400e;
        }

        .period-badge.gray {
          background: #f3f4f6;
          color: #6b7280;
        }

        /* Certification Status */
        .cert-status {
          font-size: 0.8125rem;
          white-space: nowrap;
        }

        .cert-status.overdue {
          color: #991b1b;
          font-weight: 600;
        }

        .cert-status.warning {
          color: #92400e;
          font-weight: 500;
        }

        .cert-status.upcoming {
          color: #1e40af;
        }

        .cert-status.normal {
          color: #6b7280;
        }

        .cert-status.gray {
          color: #9ca3af;
        }

        /* Urgency Badge */
        .urgency-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default PatientTable;