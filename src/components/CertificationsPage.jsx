/**
 * CertificationsPage.jsx - Certification Tracking Interface
 * 
 * PURPOSE:
 * Track and manage Medicare hospice benefit period certifications.
 * Shows upcoming/overdue certifications and enables document generation.
 * 
 * FEATURES:
 * - Overview stats (due this week, overdue, completed)
 * - Filterable certification list
 * - Visual timeline indicators
 * - Document generation triggers (placeholder for Phase 3)
 * - F2F tracking integration
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients } from '../services/patientService';
import { formatDate } from '../services/certificationCalculations';
import PatientModal from './PatientModal';

const CertificationsPage = () => {
  const { user } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [periodFilter, setPeriodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('30');

  // Modal state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Load patients
  useEffect(() => {
    loadPatients();
  }, [orgId]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { status: 'active' });
      setPatients(data);
      setError(null);
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Failed to load certification data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    return {
      dueThisWeek: patients.filter(p => {
        const days = p.compliance?.cti?.daysUntilCertEnd;
        return days !== undefined && days >= 0 && days <= 7;
      }).length,
      overdue: patients.filter(p => p.compliance?.cti?.isOverdue).length,
      completedMTD: 0, // Would need tracking in Firestore
      upcoming30: patients.filter(p => {
        const days = p.compliance?.cti?.daysUntilCertEnd;
        return days !== undefined && days >= 0 && days <= 30;
      }).length,
      f2fRequired: patients.filter(p => 
        p.compliance?.cti?.requiresF2F && !p.compliance?.cti?.f2fCompleted
      ).length,
    };
  }, [patients]);

  // Filter patients
  const filteredPatients = useMemo(() => {
    let result = patients.filter(p => p.compliance?.cti);

    // Period filter
    if (periodFilter !== 'all') {
      result = result.filter(p => {
        const cti = p.compliance.cti;
        switch (periodFilter) {
          case 'initial': return cti.currentBenefitPeriod === 1;
          case 'second': return cti.currentBenefitPeriod === 2;
          case '60day': return cti.isInSixtyDayPeriod;
          default: return true;
        }
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => {
        const cti = p.compliance.cti;
        switch (statusFilter) {
          case 'overdue': return cti.isOverdue;
          case 'action': return !cti.isOverdue && cti.daysUntilCertEnd <= 7;
          case 'upcoming': return cti.daysUntilCertEnd > 7 && cti.daysUntilCertEnd <= 14;
          case 'f2f': return cti.requiresF2F && !cti.f2fCompleted;
          default: return true;
        }
      });
    }

    // Timeframe filter
    const days = parseInt(timeframeFilter);
    if (days > 0) {
      result = result.filter(p => {
        const daysLeft = p.compliance.cti.daysUntilCertEnd;
        return daysLeft <= days;
      });
    }

    // Sort by urgency (overdue first, then by days until due)
    result.sort((a, b) => {
      const aDays = a.compliance.cti.daysUntilCertEnd;
      const bDays = b.compliance.cti.daysUntilCertEnd;
      return aDays - bDays;
    });

    return result;
  }, [patients, periodFilter, statusFilter, timeframeFilter]);

  // Get status badge
  const getStatusInfo = (cti) => {
    if (cti.isOverdue) {
      return { 
        label: `${Math.abs(cti.daysUntilCertEnd)} days overdue`, 
        class: 'overdue',
        icon: '⚠️'
      };
    }
    if (cti.daysUntilCertEnd <= 3) {
      return { 
        label: `${cti.daysUntilCertEnd} days - Critical`, 
        class: 'critical',
        icon: '🔴'
      };
    }
    if (cti.daysUntilCertEnd <= 7) {
      return { 
        label: `${cti.daysUntilCertEnd} days - Action needed`, 
        class: 'action',
        icon: '🟡'
      };
    }
    if (cti.daysUntilCertEnd <= 14) {
      return { 
        label: `${cti.daysUntilCertEnd} days`, 
        class: 'upcoming',
        icon: '🔵'
      };
    }
    return { 
      label: `${cti.daysUntilCertEnd} days`, 
      class: 'normal',
      icon: '⚪'
    };
  };

  // Handle document generation (placeholder)
  const handleGenerateDocs = (patient) => {
    alert(`Document generation for ${patient.name} will be available in the Documents page.\n\nRequired documents:\n${patient.compliance?.cti?.requiredDocuments?.join('\n') || 'N/A'}`);
  };

  // Open patient modal
  const openPatientModal = (patient) => {
    setSelectedPatient(patient);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading certifications...</p>
        <style>{`
          .page-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .page-loading p { color: #6b7280; margin-top: 1rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="certifications-page">
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-value">{stats.dueThisWeek}</div>
          <div className="stat-label">Due This Week</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{stats.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-value">{stats.upcoming30}</div>
          <div className="stat-label">Upcoming (30 days)</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">{stats.f2fRequired}</div>
          <div className="stat-label">F2F Required</div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend-card">
        <span className="legend-title">Status Legend:</span>
        <span className="legend-item"><span className="dot red" /> Overdue</span>
        <span className="legend-item"><span className="dot amber" /> Action Needed (≤7 days)</span>
        <span className="legend-item"><span className="dot blue" /> Upcoming (8-14 days)</span>
        <span className="legend-item"><span className="dot gray" /> On Track (15+ days)</span>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="filters-left">
          <select 
            value={periodFilter} 
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Periods</option>
            <option value="initial">Initial 90-Day</option>
            <option value="second">Second 90-Day</option>
            <option value="60day">60-Day Periods</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="overdue">Overdue</option>
            <option value="action">Action Needed</option>
            <option value="upcoming">Upcoming</option>
            <option value="f2f">F2F Required</option>
          </select>

          <select 
            value={timeframeFilter} 
            onChange={(e) => setTimeframeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="7">Next 7 Days</option>
            <option value="14">Next 14 Days</option>
            <option value="30">Next 30 Days</option>
            <option value="60">Next 60 Days</option>
            <option value="9999">All Time</option>
          </select>
        </div>

        <div className="results-count">
          {filteredPatients.length} certification{filteredPatients.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={loadPatients}>Retry</button>
        </div>
      )}

      {/* Certifications Table */}
      <div className="table-container">
        {filteredPatients.length === 0 ? (
          <div className="empty-state">
            <span>📋</span>
            <p>No certifications match your filters.</p>
          </div>
        ) : (
          <table className="cert-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Period</th>
                <th>Notify Date</th>
                <th>Cert End Date</th>
                <th>Status</th>
                <th>F2F</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map(patient => {
                const cti = patient.compliance.cti;
                const statusInfo = getStatusInfo(cti);
                
                return (
                  <tr key={patient.id} className={`status-row-${statusInfo.class}`}>
                    <td className="patient-cell">
                      <button 
                        className="patient-link"
                        onClick={() => openPatientModal(patient)}
                      >
                        {patient.name}
                      </button>
                      {patient.isReadmission && (
                        <span className="mini-badge">Readmit</span>
                      )}
                    </td>
                    <td>
                      <span className={`period-badge ${cti.isInSixtyDayPeriod ? 'purple' : 'blue'}`}>
                        {cti.periodShortName}
                      </span>
                    </td>
                    <td className="date-cell">
                      {formatDate(cti.notifyDate)}
                    </td>
                    <td className="date-cell">
                      <strong>{formatDate(cti.certificationEndDate)}</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${statusInfo.class}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      {cti.requiresF2F ? (
                        cti.f2fCompleted ? (
                          <span className="f2f-badge complete">✓ Complete</span>
                        ) : (
                          <span className="f2f-badge required">Required</span>
                        )
                      ) : (
                        <span className="f2f-badge na">N/A</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => handleGenerateDocs(patient)}
                      >
                        Generate Docs
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Required Documents Info */}
      <div className="docs-info-card">
        <h4>📄 Documents by Period Type</h4>
        <div className="docs-grid">
          <div className="doc-period">
            <strong>Initial 90-Day (Period 1)</strong>
            <ul>
              <li>90-Day Certification Form</li>
              <li>Attending Physician Certification</li>
              <li>Patient History</li>
            </ul>
          </div>
          <div className="doc-period">
            <strong>Second 90-Day (Period 2)</strong>
            <ul>
              <li>90-Day Certification Form</li>
              <li>Progress Note</li>
            </ul>
          </div>
          <div className="doc-period">
            <strong>60-Day Periods (3+)</strong>
            <ul>
              <li>60-Day Certification Form</li>
              <li>Progress Note</li>
              <li>F2F Encounter Documentation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Patient Modal */}
      {modalOpen && selectedPatient && (
        <PatientModal
          patient={selectedPatient}
          onSave={async (data) => {
            // Handle save
            setModalOpen(false);
            await loadPatients();
          }}
          onClose={() => setModalOpen(false)}
          saving={false}
        />
      )}

      <style>{`
        .certifications-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .stat-card {
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid;
        }

        .stat-card.amber { background: #fef3c7; border-color: #fde68a; color: #92400e; }
        .stat-card.red { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
        .stat-card.blue { background: #dbeafe; border-color: #bfdbfe; color: #1e40af; }
        .stat-card.purple { background: #f3e8ff; border-color: #e9d5ff; color: #6b21a8; }

        .stat-value { font-size: 1.5rem; font-weight: 700; }
        .stat-label { font-size: 0.75rem; margin-top: 0.25rem; }

        /* Legend */
        .legend-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.8125rem;
        }

        .legend-title { font-weight: 600; color: #374151; }
        .legend-item { display: flex; align-items: center; gap: 0.375rem; color: #6b7280; }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .dot.red { background: #ef4444; }
        .dot.amber { background: #f59e0b; }
        .dot.blue { background: #3b82f6; }
        .dot.gray { background: #9ca3af; }

        /* Filters */
        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .filters-left {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .filter-select {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          background: white;
        }

        .results-count {
          font-size: 0.875rem;
          color: #6b7280;
        }

        /* Error */
        .error-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: #fee2e2;
          border: 1px solid #ef4444;
          border-radius: 8px;
          color: #991b1b;
        }

        /* Table */
        .table-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .empty-state {
          padding: 3rem;
          text-align: center;
          color: #6b7280;
        }
        .empty-state span { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }

        .cert-table {
          width: 100%;
          border-collapse: collapse;
        }

        .cert-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }

        .cert-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f3f4f6;
          font-size: 0.875rem;
          vertical-align: middle;
        }

        .cert-table tr:hover { background: #f9fafb; }

        .status-row-overdue { border-left: 3px solid #ef4444; }
        .status-row-critical { border-left: 3px solid #ef4444; }
        .status-row-action { border-left: 3px solid #f59e0b; }

        .patient-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .patient-link {
          background: none;
          border: none;
          color: #2563eb;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
        }
        .patient-link:hover { text-decoration: underline; }

        .mini-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: #e0e7ff;
          color: #3730a3;
          border-radius: 4px;
        }

        .period-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .period-badge.blue { background: #dbeafe; color: #1e40af; }
        .period-badge.purple { background: #f3e8ff; color: #6b21a8; }

        .date-cell { white-space: nowrap; }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
        }
        .status-badge.overdue { background: #fee2e2; color: #991b1b; }
        .status-badge.critical { background: #fee2e2; color: #991b1b; }
        .status-badge.action { background: #fef3c7; color: #92400e; }
        .status-badge.upcoming { background: #dbeafe; color: #1e40af; }
        .status-badge.normal { background: #f3f4f6; color: #6b7280; }

        .f2f-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
        }
        .f2f-badge.complete { background: #d1fae5; color: #065f46; }
        .f2f-badge.required { background: #fef3c7; color: #92400e; }
        .f2f-badge.na { background: #f3f4f6; color: #9ca3af; }

        .btn {
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
          border: none;
          font-weight: 500;
        }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }

        /* Documents Info */
        .docs-info-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 1.25rem;
        }

        .docs-info-card h4 {
          margin: 0 0 1rem 0;
          font-size: 0.9375rem;
          color: #1f2937;
        }

        .docs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .doc-period strong {
          display: block;
          font-size: 0.8125rem;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .doc-period ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.8125rem;
          color: #6b7280;
        }

        .doc-period li {
          margin-bottom: 0.25rem;
        }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .docs-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .legend-card { flex-wrap: wrap; }
          .table-container { overflow-x: auto; }
          .cert-table { min-width: 800px; }
        }
      `}</style>
    </div>
  );
};

export default CertificationsPage;