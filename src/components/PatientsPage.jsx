/**
 * PatientsPage.jsx - Full Patient Directory
 * 
 * PURPOSE:
 * Comprehensive patient management with advanced filtering,
 * search, and full CRUD operations.
 * 
 * FEATURES:
 * - Search by name or MR number
 * - Filter by status, period type, urgency
 * - Sort by various columns
 * - Pagination for large lists
 * - Add/Edit/Delete patients via modal
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients, addPatient, updatePatient, deletePatient } from '../services/patientService';
import { formatDate } from '../services/certificationCalculations';
import PatientModal from './PatientModal';

const PatientsPage = () => {
  const { user } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

  // Data state
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  // Sort state
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load patients
  useEffect(() => {
    loadPatients();
  }, [orgId, statusFilter]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await getPatients(orgId, { 
        status: statusFilter === 'all' ? 'all' : statusFilter 
      });
      setPatients(data);
      setError(null);
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    let result = [...patients];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(search) ||
        p.mrNumber?.toLowerCase().includes(search) ||
        p.attendingPhysician?.toLowerCase().includes(search)
      );
    }

    // Period filter
    if (periodFilter !== 'all') {
      result = result.filter(p => {
        const cti = p.compliance?.cti;
        if (!cti) return false;
        switch (periodFilter) {
          case '90day': return !cti.isInSixtyDayPeriod;
          case '60day': return cti.isInSixtyDayPeriod;
          case 'readmit': return p.isReadmission;
          default: return true;
        }
      });
    }

    // Urgency filter
    if (urgencyFilter !== 'all') {
      result = result.filter(p => 
        p.compliance?.overallUrgency === urgencyFilter
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'mrNumber':
          aVal = a.mrNumber || '';
          bVal = b.mrNumber || '';
          break;
        case 'admissionDate':
          aVal = a.admissionDate ? new Date(a.admissionDate).getTime() : 0;
          bVal = b.admissionDate ? new Date(b.admissionDate).getTime() : 0;
          break;
        case 'certEnd':
          aVal = a.compliance?.cti?.certificationEndDate ? 
            new Date(a.compliance.cti.certificationEndDate).getTime() : Infinity;
          bVal = b.compliance?.cti?.certificationEndDate ? 
            new Date(b.compliance.cti.certificationEndDate).getTime() : Infinity;
          break;
        case 'urgency':
          const urgencyOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
          aVal = urgencyOrder[a.compliance?.overallUrgency] ?? 4;
          bVal = urgencyOrder[b.compliance?.overallUrgency] ?? 4;
          break;
        default:
          aVal = a.name || '';
          bVal = b.name || '';
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [patients, searchTerm, periodFilter, urgencyFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, periodFilter, urgencyFilter, statusFilter]);

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Modal handlers
  const openAddModal = () => {
    setSelectedPatient(null);
    setModalOpen(true);
  };

  const openEditModal = (patient) => {
    setSelectedPatient(patient);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPatient(null);
  };

  const handleSavePatient = async (formData) => {
    try {
      setSaving(true);
      if (selectedPatient?.id) {
        await updatePatient(orgId, selectedPatient.id, formData, user.uid);
      } else {
        await addPatient(orgId, formData, user.uid);
      }
      closeModal();
      await loadPatients();
    } catch (err) {
      console.error('Error saving patient:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) return;
    try {
      setSaving(true);
      await deletePatient(orgId, patientId, user.uid);
      closeModal();
      await loadPatients();
    } catch (err) {
      console.error('Error deleting patient:', err);
      alert('Failed to delete patient');
    } finally {
      setSaving(false);
    }
  };

  // Sort indicator
  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  // Stats summary
  const stats = {
    total: patients.length,
    active: patients.filter(p => p.status === 'active').length,
    critical: patients.filter(p => p.compliance?.overallUrgency === 'critical').length,
    in60Day: patients.filter(p => p.compliance?.cti?.isInSixtyDayPeriod).length,
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading patients...</p>
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
    <div className="patients-page">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Patients</span>
        </div>
        <div className="stat-item">
          <span className="stat-value blue">{stats.active}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-item">
          <span className="stat-value red">{stats.critical}</span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="stat-item">
          <span className="stat-value purple">{stats.in60Day}</span>
          <span className="stat-label">60-Day Periods</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          {/* Search */}
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, MR#, or physician..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>×</button>
            )}
          </div>

          {/* Filters */}
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="active">Active Patients</option>
            <option value="discharged">Discharged</option>
            <option value="all">All Statuses</option>
          </select>

          <select 
            value={periodFilter} 
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Periods</option>
            <option value="90day">90-Day Periods</option>
            <option value="60day">60-Day Periods</option>
            <option value="readmit">Readmissions</option>
          </select>

          <select 
            value={urgencyFilter} 
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Patient
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={loadPatients}>Retry</button>
        </div>
      )}

      {/* Results Info */}
      <div className="results-info">
        Showing {paginatedPatients.length} of {filteredPatients.length} patients
        {filteredPatients.length !== patients.length && 
          ` (filtered from ${patients.length} total)`}
      </div>

      {/* Table */}
      <div className="table-container">
        {paginatedPatients.length === 0 ? (
          <div className="empty-state">
            <span>📋</span>
            <p>No patients found matching your criteria.</p>
            <button className="btn btn-primary" onClick={openAddModal}>
              + Add First Patient
            </button>
          </div>
        ) : (
          <table className="patients-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')}>
                  Patient Name <SortIcon column="name" />
                </th>
                <th onClick={() => handleSort('mrNumber')}>
                  MR # <SortIcon column="mrNumber" />
                </th>
                <th onClick={() => handleSort('admissionDate')}>
                  Admission <SortIcon column="admissionDate" />
                </th>
                <th>Period</th>
                <th onClick={() => handleSort('certEnd')}>
                  Cert End <SortIcon column="certEnd" />
                </th>
                <th onClick={() => handleSort('urgency')}>
                  Urgency <SortIcon column="urgency" />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.map(patient => {
                const cti = patient.compliance?.cti;
                const urgency = patient.compliance?.overallUrgency || 'normal';
                
                return (
                  <tr key={patient.id} className={`urgency-row-${urgency}`}>
                    <td className="name-cell">
                      <div className="patient-name-group">
                        <span className="patient-name">{patient.name}</span>
                        {patient.isReadmission && (
                          <span className="mini-badge indigo">Readmit</span>
                        )}
                      </div>
                    </td>
                    <td className="muted">{patient.mrNumber || '—'}</td>
                    <td>{formatDate(patient.admissionDate)}</td>
                    <td>
                      <span className={`period-badge ${cti?.isInSixtyDayPeriod ? 'purple' : 'blue'}`}>
                        {cti?.periodShortName || 'N/A'}
                      </span>
                    </td>
                    <td>
                      {cti ? (
                        <span className={cti.isOverdue ? 'text-danger' : ''}>
                          {formatDate(cti.certificationEndDate)}
                          {cti.isOverdue && ' ⚠️'}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`urgency-badge ${urgency}`}>
                        {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="action-btn"
                          onClick={() => openEditModal(patient)}
                          title="View/Edit"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ← Previous
          </button>
          
          <div className="page-numbers">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button 
            className="page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <PatientModal
          patient={selectedPatient}
          onSave={handleSavePatient}
          onDelete={selectedPatient?.id ? handleDeletePatient : null}
          onClose={closeModal}
          saving={saving}
        />
      )}

      <style>{`
        .patients-page {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* Stats Bar */
        .stats-bar {
          display: flex;
          gap: 1.5rem;
          padding: 1rem 1.5rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }

        .stat-value.blue { color: #2563eb; }
        .stat-value.red { color: #ef4444; }
        .stat-value.purple { color: #7c3aed; }

        .stat-label {
          font-size: 0.75rem;
          color: #6b7280;
        }

        /* Toolbar */
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .toolbar-left {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }

        .search-box {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
        }

        .search-box input {
          padding: 0.5rem 2rem 0.5rem 2.25rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          width: 280px;
        }

        .search-box input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .clear-btn {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 1.25rem;
          color: #9ca3af;
          cursor: pointer;
        }

        .filter-select {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          background: white;
          cursor: pointer;
        }

        .filter-select:focus {
          outline: none;
          border-color: #2563eb;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
          font-weight: 500;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
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

        /* Results Info */
        .results-info {
          font-size: 0.875rem;
          color: #6b7280;
        }

        /* Table Container */
        .table-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .empty-state {
          padding: 3rem;
          text-align: center;
        }

        .empty-state span {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .empty-state p {
          color: #6b7280;
          margin-bottom: 1rem;
        }

        /* Table */
        .patients-table {
          width: 100%;
          border-collapse: collapse;
        }

        .patients-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }

        .patients-table th:hover {
          background: #f3f4f6;
        }

        .sort-icon {
          margin-left: 0.25rem;
          color: #d1d5db;
        }

        .sort-icon.active {
          color: #2563eb;
        }

        .patients-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f3f4f6;
          font-size: 0.875rem;
        }

        .patients-table tr:hover {
          background: #f9fafb;
        }

        .urgency-row-critical {
          border-left: 3px solid #ef4444;
        }

        .urgency-row-high {
          border-left: 3px solid #f59e0b;
        }

        .name-cell {
          font-weight: 500;
        }

        .patient-name-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .patient-name {
          color: #1f2937;
        }

        .mini-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
        }

        .mini-badge.indigo {
          background: #e0e7ff;
          color: #3730a3;
        }

        .muted {
          color: #6b7280;
        }

        .period-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .period-badge.blue {
          background: #dbeafe;
          color: #1e40af;
        }

        .period-badge.purple {
          background: #f3e8ff;
          color: #6b21a8;
        }

        .text-danger {
          color: #ef4444;
          font-weight: 500;
        }

        .urgency-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
        }

        .urgency-badge.critical {
          background: #fee2e2;
          color: #991b1b;
        }

        .urgency-badge.high {
          background: #fef3c7;
          color: #92400e;
        }

        .urgency-badge.medium {
          background: #dbeafe;
          color: #1e40af;
        }

        .urgency-badge.normal {
          background: #f3f4f6;
          color: #6b7280;
        }

        .action-buttons {
          display: flex;
          gap: 0.25rem;
        }

        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 1rem;
        }

        .action-btn:hover {
          background: #f3f4f6;
        }

        /* Pagination */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
        }

        .page-btn {
          padding: 0.5rem 1rem;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .page-btn:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-numbers {
          display: flex;
          gap: 0.25rem;
        }

        .page-num {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .page-num:hover {
          background: #f3f4f6;
        }

        .page-num.active {
          background: #2563eb;
          border-color: #2563eb;
          color: white;
        }

        @media (max-width: 768px) {
          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .toolbar-left {
            flex-direction: column;
          }

          .search-box input {
            width: 100%;
          }

          .stats-bar {
            flex-wrap: wrap;
          }

          .table-container {
            overflow-x: auto;
          }

          .patients-table {
            min-width: 700px;
          }
        }
      `}</style>
    </div>
  );
};

export default PatientsPage;