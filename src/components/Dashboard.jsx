/**
 * Dashboard.jsx - Main Dashboard Page
 * 
 * CHANGES FROM ORIGINAL:
 * - Removed header (now in App.jsx)
 * - Removed logout button (now in App.jsx header)
 * - Added Urgent Attention panel
 * - Added Upcoming This Week panel
 * - Added Activity Feed panel
 * - Better organized layout
 * 
 * This component is now JUST the dashboard content,
 * not the entire app chrome.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatients, getDashboardStats, addPatient, updatePatient, deletePatient } from '../services/patientService';
import Scorecards from './Scorecards';
import PatientTable from './PatientTable';
import PatientModal from './PatientModal';
import { 
  AlertTriangle, Check, Clock, Calendar, Mail, Search, ChevronRight 
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  
  // Data state
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [view, setView] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [saving, setSaving] = useState(false);

  const orgId = user?.customClaims?.orgId || 'org_parrish';

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [patientsData, statsData] = await Promise.all([
        getPatients(orgId),
        getDashboardStats(orgId)
      ]);
      setPatients(patientsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter patients based on view and search
  const filteredPatients = patients.filter(p => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!p.name?.toLowerCase().includes(search) && 
          !p.mrNumber?.toLowerCase().includes(search)) {
        return false;
      }
    }

    const cti = p.compliance?.cti;
    switch (view) {
      case 'upcoming':
        return cti && cti.daysUntilCertEnd <= 14 && !cti.isOverdue;
      case 'overdue':
        return cti?.isOverdue;
      case 'f2f':
        return cti?.requiresF2F && !cti?.f2fCompleted;
      case '60day':
        return cti?.isInSixtyDayPeriod;
      default:
        return true;
    }
  });

  // Get urgent patients (overdue or due within 3 days)
  const urgentPatients = patients.filter(p => {
    const cti = p.compliance?.cti;
    const huv = p.compliance?.huv;
    return cti?.isOverdue || 
           (cti?.daysUntilCertEnd <= 3) || 
           huv?.anyOverdue ||
           (cti?.requiresF2F && !cti?.f2fCompleted && cti?.f2fOverdue);
  }).slice(0, 5);

  // Get upcoming items (next 7 days)
  const upcomingPatients = patients.filter(p => {
    const cti = p.compliance?.cti;
    return cti && cti.daysUntilCertEnd > 0 && cti.daysUntilCertEnd <= 7;
  }).sort((a, b) => 
    a.compliance.cti.daysUntilCertEnd - b.compliance.cti.daysUntilCertEnd
  ).slice(0, 5);

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
      await loadData();
    } catch (err) {
      console.error('Error saving patient:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) {
      return;
    }
    try {
      setSaving(true);
      await deletePatient(orgId, patientId, user.uid);
      closeModal();
      await loadData();
    } catch (err) {
      console.error('Error deleting patient:', err);
      alert('Failed to delete patient');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading dashboard...</p>
        <style>{`
          .dashboard-loading {
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
          .dashboard-loading p { color: #6b7280; margin-top: 1rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Error Banner */}
      {error && (
        <div className="alert-banner alert-danger">
          <span>{error}</span>
          <button className="alert-action" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* Scorecards Row */}
      <Scorecards stats={stats} onCardClick={setView} activeView={view} />

      {/* Two Column Layout: Urgent + Upcoming */}
      <div className="dashboard-grid">
        {/* Urgent Attention Panel */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3><><AlertTriangle size={18} className="text-red" /> Urgent Attention Required</></h3>
            <span className="card-subtitle">Today</span>
          </div>
          <div className="card-body">
            {urgentPatients.length === 0 ? (
              <div className="empty-state">
                <Check size={24} className="text-green" />
                <p>No urgent items. Great job!</p>
              </div>
            ) : (
              <ul className="urgent-list">
                {urgentPatients.map(p => (
                  <li 
                    key={p.id} 
                    className="urgent-item"
                    onClick={() => openEditModal(p)}
                  >
                    <span className={`urgent-icon ${p.compliance?.cti?.isOverdue ? 'overdue' : 'warning'}`}>
                      {p.compliance?.cti?.isOverdue ? <AlertTriangle size={16} /> : <Clock size={16} />}
                    </span>
                    <div className="urgent-content">
                      <strong>{p.name}</strong>
                      <span className="urgent-message">
                        {p.compliance?.cti?.isOverdue 
                          ? `Certification overdue by ${Math.abs(p.compliance.cti.daysUntilCertEnd)} days`
                          : `Certification due in ${p.compliance?.cti?.daysUntilCertEnd} days`
                        }
                      </span>
                    </div>
                    <ChevronRight size={16} className="urgent-arrow" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Upcoming This Week Panel */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3><><Calendar size={18} /> Upcoming This Week</></h3>
            <button className="link-btn" onClick={() => setView('upcoming')}>View All</button>
          </div>
          <div className="card-body">
            {upcomingPatients.length === 0 ? (
              <div className="empty-state">
                <Mail size={24} />
                <p>No upcoming certifications this week.</p>
              </div>
            ) : (
              <ul className="upcoming-list">
                {upcomingPatients.map(p => (
                  <li 
                    key={p.id} 
                    className="upcoming-item"
                    onClick={() => openEditModal(p)}
                  >
                    <div className="upcoming-date">
                      <span className="date-day">
                        {new Date(p.compliance?.cti?.certificationEndDate).getDate()}
                      </span>
                      <span className="date-month">
                        {new Date(p.compliance?.cti?.certificationEndDate).toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>
                    <div className="upcoming-content">
                      <strong>{p.name}</strong>
                      <span className="upcoming-type">
                        {p.compliance?.cti?.periodShortName} Certification
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Patient List Section */}
      <div className="patient-section">
        <div className="section-header">
          <h2>Active Patients</h2>
          
          <div className="section-controls">
            {/* View Toggles */}
            <div className="view-toggles">
              {['all', 'upcoming', 'overdue', 'f2f', '60day'].map(v => (
                <button 
                  key={v}
                  className={`toggle-btn ${view === v ? 'active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v === 'all' ? 'All' : 
                   v === 'upcoming' ? 'Upcoming' :
                   v === 'overdue' ? 'Overdue' :
                   v === 'f2f' ? 'F2F Needed' : '60-Day'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Add Patient Button */}
            <button className="btn btn-primary" onClick={openAddModal}>
              + Add Patient
            </button>
          </div>
        </div>

        <div className="results-info">
          Showing {filteredPatients.length} of {patients.length} patients
          {view !== 'all' && ` • Filtered: ${view}`}
        </div>

        <PatientTable 
          patients={filteredPatients} 
          onPatientClick={openEditModal}
        />

        <div className="legend">
          <span><span className="badge badge-90day">90-day</span> Initial/Second period</span>
          <span><span className="badge badge-60day">60-day</span> Period 3+ (F2F required)</span>
          <span><span className="badge badge-readmit">Readmit</span> Returning patient</span>
        </div>
      </div>

      {/* Patient Modal */}
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
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Alert Banners */
        .alert-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-radius: 8px;
        }
        .alert-danger { background: #fee2e2; border: 1px solid #ef4444; color: #991b1b; }
        .alert-action {
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid currentColor;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        /* Dashboard Grid */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }

        /* Dashboard Cards */
        .dashboard-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .card-header h3 {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #1f2937;
        }

        .card-subtitle {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .link-btn {
          background: none;
          border: none;
          color: #2563eb;
          font-size: 0.8125rem;
          cursor: pointer;
        }
        .link-btn:hover { text-decoration: underline; }

        .card-body {
          padding: 0;
        }

        /* Empty State */
        .empty-state {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
        }
        .empty-state span { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
        .empty-state p { margin: 0; }

        /* Urgent List */
        .urgent-list, .upcoming-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .urgent-item, .upcoming-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background 0.15s;
        }

        .urgent-item:hover, .upcoming-item:hover {
          background: #f9fafb;
        }

        .urgent-item:last-child, .upcoming-item:last-child {
          border-bottom: none;
        }

        .urgent-icon {
          font-size: 1.25rem;
        }

        .urgent-content, .upcoming-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .urgent-content strong, .upcoming-content strong {
          font-size: 0.875rem;
          color: #1f2937;
        }

        .urgent-message, .upcoming-type {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .urgent-arrow {
          color: #9ca3af;
        }

        /* Upcoming Date Badge */
        .upcoming-date {
          width: 44px;
          text-align: center;
          background: #f3f4f6;
          border-radius: 6px;
          padding: 0.375rem;
        }

        .date-day {
          display: block;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .date-month {
          display: block;
          font-size: 0.625rem;
          color: #6b7280;
          text-transform: uppercase;
        }

        /* Patient Section */
        .patient-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .section-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-header h2 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .section-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }

        .view-toggles {
          display: flex;
          gap: 0.25rem;
          background: #f3f4f6;
          padding: 0.25rem;
          border-radius: 8px;
        }

        .toggle-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 0.8rem;
          color: #6b7280;
          cursor: pointer;
        }
        .toggle-btn:hover { color: #1f2937; }
        .toggle-btn.active {
          background: white;
          color: #2563eb;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .search-box {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }
        .search-box input {
          padding: 0.5rem 0.75rem 0.5rem 2rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.875rem;
          width: 180px;
        }
        .search-box input:focus {
          outline: none;
          border-color: #2563eb;
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
        .btn-primary:hover { background: #1d4ed8; }

        .results-info {
          padding: 0.75rem 1.5rem;
          background: #f9fafb;
          font-size: 0.875rem;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding: 1rem 1.5rem;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
          margin-right: 0.25rem;
        }
        .badge-90day { background: #dbeafe; color: #1e40af; }
        .badge-60day { background: #f3e8ff; color: #6b21a8; }
        .badge-readmit { background: #e0e7ff; color: #3730a3; }

        .text-red { color: #ef4444; }
        .text-green { color: #10b981; }

        @media (max-width: 768px) {
          .section-header { flex-direction: column; align-items: stretch; }
          .section-controls { flex-direction: column; }
          .view-toggles { overflow-x: auto; width: 100%; }
          .search-box input { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;