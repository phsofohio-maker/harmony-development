/**
 * HUVPage.jsx - HOPE Update Visit Tracking
 * 
 * PURPOSE:
 * Track HUV1 (Days 5-14) and HUV2 (Days 15-28) visit windows
 * for all active patients based on their Start of Care date.
 * 
 * FEATURES:
 * - Overview stats cards
 * - Filterable patient list
 * - Visual status indicators
 * - Mark complete functionality
 * 
 * HUV RULES:
 * - HUV1: Must occur between days 5-14 from Start of Care
 * - HUV2: Must occur between days 15-28 from Start of Care
 * - Status: Upcoming → Action Needed → Overdue → Complete
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients, markHUV1Completed, markHUV2Completed } from '../services/patientService';
import { formatDate } from '../services/certificationCalculations';

const HUVPage = () => {
  const { user } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [filter, setFilter] = useState('all'); // all, action, overdue, complete

  // Modal state for marking complete
  const [markingComplete, setMarkingComplete] = useState(null); // { patient, huvType: 'huv1' | 'huv2' }
  const [completionDate, setCompletionDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, [orgId]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { status: 'active' });
      // Only include patients with Start of Care date
      const patientsWithSOC = data.filter(p => p.startOfCare);
      setPatients(patientsWithSOC);
      setError(null);
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = {
    huv1ActionNeeded: patients.filter(p => p.compliance?.huv?.huv1?.needsAction).length,
    huv2ActionNeeded: patients.filter(p => p.compliance?.huv?.huv2?.needsAction).length,
    overdue: patients.filter(p => p.compliance?.huv?.anyOverdue).length,
    completedMTD: patients.filter(p => {
      const huv = p.compliance?.huv;
      return huv?.huv1?.completed && huv?.huv2?.completed;
    }).length,
  };

  // Filter patients
  const filteredPatients = patients.filter(p => {
    const huv = p.compliance?.huv;
    if (!huv) return false;

    switch (filter) {
      case 'action':
        return huv.huv1?.needsAction || huv.huv2?.needsAction;
      case 'overdue':
        return huv.anyOverdue;
      case 'complete':
        return huv.huv1?.completed && huv.huv2?.completed;
      default:
        return true;
    }
  });

  // Sort by urgency (overdue first, then action needed)
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const aHuv = a.compliance?.huv;
    const bHuv = b.compliance?.huv;
    
    // Overdue patients first
    if (aHuv?.anyOverdue && !bHuv?.anyOverdue) return -1;
    if (!aHuv?.anyOverdue && bHuv?.anyOverdue) return 1;
    
    // Then action needed
    if (aHuv?.anyActionNeeded && !bHuv?.anyActionNeeded) return -1;
    if (!aHuv?.anyActionNeeded && bHuv?.anyActionNeeded) return 1;
    
    return 0;
  });

  // Handle marking HUV complete
  const openMarkComplete = (patient, huvType) => {
    setMarkingComplete({ patient, huvType });
    setCompletionDate(new Date().toISOString().split('T')[0]); // Default to today
  };

  const closeMarkComplete = () => {
    setMarkingComplete(null);
    setCompletionDate('');
  };

  const handleMarkComplete = async () => {
    if (!markingComplete || !completionDate) return;

    try {
      setSaving(true);
      const { patient, huvType } = markingComplete;

      if (huvType === 'huv1') {
        await markHUV1Completed(orgId, patient.id, completionDate, user.uid);
      } else {
        await markHUV2Completed(orgId, patient.id, completionDate, user.uid);
      }

      closeMarkComplete();
      await loadPatients(); // Refresh data
    } catch (err) {
      console.error('Error marking complete:', err);
      alert('Failed to mark as complete. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get status badge component
  const StatusBadge = ({ status }) => {
    const config = {
      complete: { bg: '#d1fae5', color: '#065f46', label: 'Complete' },
      'action-needed': { bg: '#fef3c7', color: '#92400e', label: 'Action Needed' },
      overdue: { bg: '#fee2e2', color: '#991b1b', label: 'Overdue' },
      upcoming: { bg: '#f3f4f6', color: '#6b7280', label: 'Upcoming' },
    };
    const { bg, color, label } = config[status] || config.upcoming;
    
    return (
      <span style={{ 
        background: bg, 
        color: color, 
        padding: '0.25rem 0.5rem', 
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500
      }}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="huv-loading">
        <div className="spinner" />
        <p>Loading HUV data...</p>
        <style>{`
          .huv-loading {
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
          .huv-loading p { color: #6b7280; margin-top: 1rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="huv-page">
      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={loadPatients}>Retry</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-value">{stats.huv1ActionNeeded}</div>
          <div className="stat-label">HUV1 Action Needed</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-value">{stats.huv2ActionNeeded}</div>
          <div className="stat-label">HUV2 Action Needed</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{stats.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{stats.completedMTD}</div>
          <div className="stat-label">Fully Complete</div>
        </div>
      </div>

      {/* Legend Card */}
      <div className="legend-card">
        <span className="legend-title">Status Legend:</span>
        <span className="legend-item">
          <span className="dot green" /> Complete
        </span>
        <span className="legend-item">
          <span className="dot amber" /> Action Needed
        </span>
        <span className="legend-item">
          <span className="dot red" /> Overdue
        </span>
        <span className="legend-item">
          <span className="dot gray" /> Upcoming
        </span>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="filter-toggles">
          {[
            { id: 'all', label: 'All Patients' },
            { id: 'action', label: 'Action Needed' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'complete', label: 'Complete' },
          ].map(f => (
            <button
              key={f.id}
              className={`filter-btn ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="results-count">
          Showing {sortedPatients.length} of {patients.length} patients
        </div>
      </div>

      {/* HUV Table */}
      <div className="huv-table-container">
        {sortedPatients.length === 0 ? (
          <div className="empty-state">
            <span>📅</span>
            <p>No patients match the current filter.</p>
          </div>
        ) : (
          <table className="huv-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>SOC Date</th>
                <th>HUV1 Window</th>
                <th>HUV1 Status</th>
                <th>HUV2 Window</th>
                <th>HUV2 Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPatients.map(patient => {
                const huv = patient.compliance?.huv;
                return (
                  <tr key={patient.id}>
                    <td className="patient-name">{patient.name}</td>
                    <td className="soc-date">{formatDate(patient.startOfCare)}</td>
                    <td className="window-cell">
                      {huv?.huv1?.windowText || 'N/A'}
                    </td>
                    <td>
                      <StatusBadge status={huv?.huv1?.status} />
                      {huv?.huv1?.completed && huv?.huv1?.completedDate && (
                        <div className="completed-date">
                          ✓ {formatDate(huv.huv1.completedDate)}
                        </div>
                      )}
                    </td>
                    <td className="window-cell">
                      {huv?.huv2?.windowText || 'N/A'}
                    </td>
                    <td>
                      <StatusBadge status={huv?.huv2?.status} />
                      {huv?.huv2?.completed && huv?.huv2?.completedDate && (
                        <div className="completed-date">
                          ✓ {formatDate(huv.huv2.completedDate)}
                        </div>
                      )}
                    </td>
                    <td className="actions-cell">
                      {!huv?.huv1?.completed && (
                        <button
                          className="action-btn"
                          onClick={() => openMarkComplete(patient, 'huv1')}
                        >
                          Mark HUV1
                        </button>
                      )}
                      {!huv?.huv2?.completed && (
                        <button
                          className="action-btn"
                          onClick={() => openMarkComplete(patient, 'huv2')}
                        >
                          Mark HUV2
                        </button>
                      )}
                      {huv?.huv1?.completed && huv?.huv2?.completed && (
                        <span className="all-complete">✓ All Complete</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mark Complete Modal */}
      {markingComplete && (
        <div className="modal-overlay" onClick={closeMarkComplete}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mark {markingComplete.huvType.toUpperCase()} Complete</h3>
              <button className="close-btn" onClick={closeMarkComplete}>×</button>
            </div>
            <div className="modal-body">
              <p className="patient-info">
                <strong>Patient:</strong> {markingComplete.patient.name}
              </p>
              <p className="huv-info">
                <strong>Visit Type:</strong>{' '}
                {markingComplete.huvType === 'huv1' 
                  ? 'HUV1 (Days 5-14)' 
                  : 'HUV2 (Days 15-28)'}
              </p>
              <div className="form-group">
                <label htmlFor="completionDate">Completion Date</label>
                <input
                  type="date"
                  id="completionDate"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeMarkComplete}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleMarkComplete}
                disabled={saving || !completionDate}
              >
                {saving ? 'Saving...' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .huv-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Error Banner */
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
        .error-banner button {
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid #ef4444;
          border-radius: 6px;
          cursor: pointer;
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

        .stat-card.amber {
          background: #fef3c7;
          border-color: #fde68a;
          color: #92400e;
        }

        .stat-card.red {
          background: #fee2e2;
          border-color: #fecaca;
          color: #991b1b;
        }

        .stat-card.green {
          background: #d1fae5;
          border-color: #a7f3d0;
          color: #065f46;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .stat-label {
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        /* Legend Card */
        .legend-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .legend-title {
          font-weight: 600;
          color: #374151;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: #6b7280;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dot.green { background: #10b981; }
        .dot.amber { background: #f59e0b; }
        .dot.red { background: #ef4444; }
        .dot.gray { background: #9ca3af; }

        /* Filters Row */
        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .filter-toggles {
          display: flex;
          gap: 0.25rem;
          background: #f3f4f6;
          padding: 0.25rem;
          border-radius: 8px;
        }

        .filter-btn {
          padding: 0.5rem 1rem;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 0.8125rem;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .filter-btn:hover {
          color: #1f2937;
        }

        .filter-btn.active {
          background: white;
          color: #2563eb;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .results-count {
          font-size: 0.875rem;
          color: #6b7280;
        }

        /* HUV Table */
        .huv-table-container {
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
        .empty-state span {
          font-size: 2.5rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .huv-table {
          width: 100%;
          border-collapse: collapse;
        }

        .huv-table th {
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

        .huv-table td {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid #f3f4f6;
          font-size: 0.875rem;
        }

        .huv-table tr:hover {
          background: #f9fafb;
        }

        .patient-name {
          font-weight: 500;
          color: #1f2937;
        }

        .soc-date {
          color: #6b7280;
        }

        .window-cell {
          font-size: 0.8125rem;
          color: #6b7280;
        }

        .completed-date {
          font-size: 0.6875rem;
          color: #065f46;
          margin-top: 0.25rem;
        }

        .actions-cell {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.375rem 0.75rem;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .action-btn:hover {
          background: #1d4ed8;
        }

        .all-complete {
          color: #065f46;
          font-size: 0.75rem;
          font-weight: 500;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 400px;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1rem;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #6b7280;
          cursor: pointer;
          line-height: 1;
        }

        .modal-body {
          padding: 1.25rem;
        }

        .patient-info, .huv-info {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
        }

        .form-group {
          margin-top: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.375rem;
          color: #374151;
        }

        .form-group input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
          
          .legend-card {
            flex-wrap: wrap;
          }

          .huv-table-container {
            overflow-x: auto;
          }

          .huv-table {
            min-width: 800px;
          }
        }
      `}</style>
    </div>
  );
};

export default HUVPage;