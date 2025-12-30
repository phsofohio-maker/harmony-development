/**
 * PatientModal.jsx - Add/Edit Patient Modal with Benefit Period Support
 */

import { useState, useEffect } from 'react';
import { formatDate } from '../services/certificationCalculations';

const PatientModal = ({ patient, onSave, onDelete, onClose, saving }) => {
  const [formData, setFormData] = useState({
    name: '',
    mrNumber: '',
    dateOfBirth: '',
    admissionDate: '',
    startOfCare: '',
    startingBenefitPeriod: 1,
    isReadmission: false,
    priorHospiceDays: '',
    f2fCompleted: false,
    f2fDate: '',
    f2fPhysician: '',
    attendingPhysician: '',
    huv1Completed: false,
    huv1Date: '',
    huv2Completed: false,
    huv2Date: ''
  });

  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  const isEditing = !!patient?.id;
  const showF2FSection = formData.startingBenefitPeriod >= 3 || formData.isReadmission;

  // Populate form when editing
  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        mrNumber: patient.mrNumber || '',
        dateOfBirth: formatDateForInput(patient.dateOfBirth),
        admissionDate: formatDateForInput(patient.admissionDate),
        startOfCare: formatDateForInput(patient.startOfCare),
        startingBenefitPeriod: patient.startingBenefitPeriod || 1,
        isReadmission: patient.isReadmission || false,
        priorHospiceDays: patient.priorHospiceDays || '',
        f2fCompleted: patient.f2fCompleted || false,
        f2fDate: formatDateForInput(patient.f2fDate),
        f2fPhysician: patient.f2fPhysician || '',
        attendingPhysician: patient.attendingPhysician || '',
        huv1Completed: patient.huv1Completed || false,
        huv1Date: formatDateForInput(patient.huv1Date),
        huv2Completed: patient.huv2Completed || false,
        huv2Date: formatDateForInput(patient.huv2Date)
      });
    }
  }, [patient]);

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              name === 'startingBenefitPeriod' ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Patient name is required');
      return;
    }
    if (!formData.admissionDate) {
      setError('Admission date is required');
      return;
    }

    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Failed to save patient');
    }
  };

  const handleDelete = () => {
    if (onDelete && patient?.id) {
      onDelete(patient.id);
    }
  };

  // Get compliance info for display when editing
  const cti = patient?.compliance?.cti;
  const huv = patient?.compliance?.huv;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Patient' : 'Add New Patient'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Compliance Summary (when editing) */}
        {isEditing && cti && (
          <div className="compliance-summary">
            <div className={`summary-item ${cti.isOverdue ? 'danger' : cti.urgency === 'high' ? 'warning' : ''}`}>
              <span className="summary-label">Period</span>
              <span className="summary-value">{cti.currentBenefitPeriod} ({cti.periodDuration}d)</span>
            </div>
            <div className={`summary-item ${cti.isOverdue ? 'danger' : cti.daysUntilCertEnd <= 14 ? 'warning' : ''}`}>
              <span className="summary-label">Cert End</span>
              <span className="summary-value">{formatDate(cti.certificationEndDate)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Days Left</span>
              <span className="summary-value">{cti.isOverdue ? `${Math.abs(cti.daysUntilCertEnd)} overdue` : cti.daysUntilCertEnd}</span>
            </div>
            {cti.requiresF2F && (
              <div className={`summary-item ${cti.f2fCompleted ? 'success' : 'warning'}`}>
                <span className="summary-label">F2F</span>
                <span className="summary-value">{cti.f2fCompleted ? '✓ Done' : 'Required'}</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Info
          </button>
          <button 
            className={`tab ${activeTab === 'benefit' ? 'active' : ''}`}
            onClick={() => setActiveTab('benefit')}
          >
            Benefit Period
          </button>
          <button 
            className={`tab ${activeTab === 'huv' ? 'active' : ''}`}
            onClick={() => setActiveTab('huv')}
          >
            HUV Tracking
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Patient Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Last, First"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>MR Number</label>
                    <input
                      type="text"
                      name="mrNumber"
                      value={formData.mrNumber}
                      onChange={handleChange}
                      placeholder="Medical Record #"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Attending Physician</label>
                    <input
                      type="text"
                      name="attendingPhysician"
                      value={formData.attendingPhysician}
                      onChange={handleChange}
                      placeholder="Dr. Name"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Admission Date *</label>
                    <input
                      type="date"
                      name="admissionDate"
                      value={formData.admissionDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Start of Care</label>
                    <input
                      type="date"
                      name="startOfCare"
                      value={formData.startOfCare}
                      onChange={handleChange}
                    />
                    <small>For HUV calculations</small>
                  </div>
                </div>
              </div>
            )}

            {/* Benefit Period Tab */}
            {activeTab === 'benefit' && (
              <div className="form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Starting Benefit Period</label>
                    <select
                      name="startingBenefitPeriod"
                      value={formData.startingBenefitPeriod}
                      onChange={handleChange}
                    >
                      <option value={1}>Period 1 (Initial 90 days)</option>
                      <option value={2}>Period 2 (Second 90 days)</option>
                      <option value={3}>Period 3 (1st 60-day)</option>
                      <option value={4}>Period 4 (2nd 60-day)</option>
                      <option value={5}>Period 5+ (Subsequent)</option>
                    </select>
                    <small>Which Medicare benefit period is this patient starting on?</small>
                  </div>
                </div>

                <div className="form-group checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="isReadmission"
                      checked={formData.isReadmission}
                      onChange={handleChange}
                    />
                    <span>
                      <strong>This is a readmission</strong>
                      <small>Patient returning after previous hospice discharge</small>
                    </span>
                  </label>
                </div>

                {formData.isReadmission && (
                  <div className="form-group">
                    <label>Prior Hospice Days Used</label>
                    <input
                      type="number"
                      name="priorHospiceDays"
                      value={formData.priorHospiceDays}
                      onChange={handleChange}
                      min="0"
                      placeholder="Optional"
                    />
                  </div>
                )}

                {/* F2F Section */}
                {showF2FSection && (
                  <div className="f2f-section">
                    <h4>👨‍⚕️ Face-to-Face Encounter Required</h4>
                    <p className="f2f-reason">
                      Reason: {formData.isReadmission && formData.startingBenefitPeriod >= 3 
                        ? 'Readmission + Period 3+'
                        : formData.isReadmission 
                          ? 'Readmission' 
                          : 'Period 3+ (60-day cycle)'}
                    </p>

                    <div className="form-group checkbox-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="f2fCompleted"
                          checked={formData.f2fCompleted}
                          onChange={handleChange}
                        />
                        <span>F2F Encounter Completed</span>
                      </label>
                    </div>

                    {formData.f2fCompleted && (
                      <div className="form-row">
                        <div className="form-group">
                          <label>F2F Date</label>
                          <input
                            type="date"
                            name="f2fDate"
                            value={formData.f2fDate}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="form-group">
                          <label>F2F Physician</label>
                          <input
                            type="text"
                            name="f2fPhysician"
                            value={formData.f2fPhysician}
                            onChange={handleChange}
                            placeholder="Physician name"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* HUV Tab */}
            {activeTab === 'huv' && (
              <div className="form-section">
                {huv && (
                  <div className="huv-windows">
                    <div className="huv-window">
                      <strong>HUV1 Window:</strong> {huv.huv1.windowText}
                    </div>
                    <div className="huv-window">
                      <strong>HUV2 Window:</strong> {huv.huv2.windowText}
                    </div>
                  </div>
                )}

                <div className="form-group checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="huv1Completed"
                      checked={formData.huv1Completed}
                      onChange={handleChange}
                    />
                    <span>HUV1 Completed (Days 5-14)</span>
                  </label>
                </div>

                {formData.huv1Completed && (
                  <div className="form-group">
                    <label>HUV1 Date</label>
                    <input
                      type="date"
                      name="huv1Date"
                      value={formData.huv1Date}
                      onChange={handleChange}
                    />
                  </div>
                )}

                <div className="form-group checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="huv2Completed"
                      checked={formData.huv2Completed}
                      onChange={handleChange}
                    />
                    <span>HUV2 Completed (Days 15-28)</span>
                  </label>
                </div>

                {formData.huv2Completed && (
                  <div className="form-group">
                    <label>HUV2 Date</label>
                    <input
                      type="date"
                      name="huv2Date"
                      value={formData.huv2Date}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {isEditing && onDelete && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div className="footer-right">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Patient')}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`
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

        .modal-container {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 { margin: 0; font-size: 1.125rem; }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          line-height: 1;
        }

        .compliance-summary {
          display: flex;
          gap: 1rem;
          padding: 0.75rem 1.5rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          background: white;
          border: 1px solid #e5e7eb;
        }

        .summary-item.danger { border-color: #ef4444; background: #fef2f2; }
        .summary-item.warning { border-color: #f59e0b; background: #fffbeb; }
        .summary-item.success { border-color: #10b981; background: #ecfdf5; }

        .summary-label { font-size: 0.65rem; color: #6b7280; text-transform: uppercase; }
        .summary-value { font-size: 0.875rem; font-weight: 600; }

        .modal-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab {
          flex: 1;
          padding: 0.75rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 0.875rem;
          color: #6b7280;
          cursor: pointer;
        }

        .tab:hover { color: #1f2937; }
        .tab.active { color: #2563eb; border-bottom-color: #2563eb; }

        .modal-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .error-message {
          background: #fee2e2;
          color: #991b1b;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .form-section { display: flex; flex-direction: column; gap: 1rem; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; }
        .form-group label { font-size: 0.875rem; font-weight: 500; margin-bottom: 0.375rem; color: #374151; }
        .form-group input, .form-group select {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }
        .form-group input:focus, .form-group select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .form-group small { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }

        .checkbox-row { margin-top: 0.5rem; }
        .checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          cursor: pointer;
        }
        .checkbox-label input { margin-top: 0.25rem; }
        .checkbox-label span { display: flex; flex-direction: column; }
        .checkbox-label small { color: #6b7280; font-size: 0.75rem; }

        .f2f-section {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }
        .f2f-section h4 { margin: 0 0 0.5rem 0; font-size: 0.875rem; }
        .f2f-reason { font-size: 0.8rem; color: #92400e; margin: 0 0 1rem 0; }

        .huv-windows {
          background: #f3f4f6;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .huv-window { margin-bottom: 0.25rem; }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .footer-right { display: flex; gap: 0.75rem; }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
        }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
        .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn-danger { background: #fee2e2; color: #991b1b; }
        .btn-danger:hover { background: #fecaca; }

        @media (max-width: 600px) {
          .form-row { grid-template-columns: 1fr; }
          .compliance-summary { flex-direction: column; }
        }
      `}</style>
    </div>
  );
};

export default PatientModal;