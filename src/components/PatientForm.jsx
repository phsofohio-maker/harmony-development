/**
 * PatientForm.jsx - Patient Add/Edit Form with Benefit Period Support
 */

import { useState, useEffect } from 'react';

const PatientForm = ({ patient, onSave, onCancel, onDelete, isLoading }) => {
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

  const [showF2FSection, setShowF2FSection] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        mrNumber: patient.mrNumber || '',
        dateOfBirth: patient.dateOfBirth ? formatDateForInput(patient.dateOfBirth) : '',
        admissionDate: patient.admissionDate ? formatDateForInput(patient.admissionDate) : '',
        startOfCare: patient.startOfCare ? formatDateForInput(patient.startOfCare) : '',
        startingBenefitPeriod: patient.startingBenefitPeriod || 1,
        isReadmission: patient.isReadmission || false,
        priorHospiceDays: patient.priorHospiceDays || '',
        f2fCompleted: patient.f2fCompleted || false,
        f2fDate: patient.f2fDate ? formatDateForInput(patient.f2fDate) : '',
        f2fPhysician: patient.f2fPhysician || '',
        attendingPhysician: patient.attendingPhysician || '',
        huv1Completed: patient.huv1Completed || false,
        huv1Date: patient.huv1Date ? formatDateForInput(patient.huv1Date) : '',
        huv2Completed: patient.huv2Completed || false,
        huv2Date: patient.huv2Date ? formatDateForInput(patient.huv2Date) : ''
      });
    }
  }, [patient]);

  // Update F2F visibility when period or readmission changes
  useEffect(() => {
    const needsF2F = formData.startingBenefitPeriod >= 3 || formData.isReadmission;
    setShowF2FSection(needsF2F);
  }, [formData.startingBenefitPeriod, formData.isReadmission]);

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const isEditing = !!patient?.id;

  return (
    <form onSubmit={handleSubmit} className="patient-form">
      {/* Basic Information */}
      <div className="form-section">
        <h3 className="form-section-title">Patient Information</h3>
        
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="name">Patient Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Last, First"
            />
          </div>

          <div className="form-group">
            <label htmlFor="mrNumber">MR Number</label>
            <input
              type="text"
              id="mrNumber"
              name="mrNumber"
              value={formData.mrNumber}
              onChange={handleChange}
              placeholder="Medical Record #"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dateOfBirth">Date of Birth</label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="attendingPhysician">Attending Physician</label>
            <input
              type="text"
              id="attendingPhysician"
              name="attendingPhysician"
              value={formData.attendingPhysician}
              onChange={handleChange}
              placeholder="Dr. Name"
            />
          </div>
        </div>
      </div>

      {/* Admission & Benefit Period */}
      <div className="form-section">
        <h3 className="form-section-title">Admission & Benefit Period</h3>
        
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="admissionDate">Admission Date *</label>
            <input
              type="date"
              id="admissionDate"
              name="admissionDate"
              value={formData.admissionDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="startOfCare">Start of Care Date</label>
            <input
              type="date"
              id="startOfCare"
              name="startOfCare"
              value={formData.startOfCare}
              onChange={handleChange}
            />
            <small className="form-hint">For HUV calculations</small>
          </div>

          <div className="form-group">
            <label htmlFor="startingBenefitPeriod">
              Starting Benefit Period
              <span className="info-icon" title="Which Medicare benefit period is this patient starting on?">ℹ️</span>
            </label>
            <select
              id="startingBenefitPeriod"
              name="startingBenefitPeriod"
              value={formData.startingBenefitPeriod}
              onChange={handleChange}
            >
              <option value={1}>Period 1 (Initial 90 days)</option>
              <option value={2}>Period 2 (Second 90 days)</option>
              <option value={3}>Period 3 (1st 60-day)</option>
              <option value={4}>Period 4 (2nd 60-day)</option>
              <option value={5}>Period 5+ (Subsequent 60-day)</option>
            </select>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isReadmission"
                checked={formData.isReadmission}
                onChange={handleChange}
              />
              <span className="checkbox-text">
                <strong>This is a readmission</strong>
                <small>Patient returning after previous hospice discharge</small>
              </span>
            </label>
          </div>
        </div>

        {formData.isReadmission && (
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label htmlFor="priorHospiceDays">Prior Hospice Days Used</label>
            <input
              type="number"
              id="priorHospiceDays"
              name="priorHospiceDays"
              value={formData.priorHospiceDays}
              onChange={handleChange}
              min="0"
              placeholder="Total days from previous stays"
            />
            <small className="form-hint">Optional - helps track total benefit usage</small>
          </div>
        )}
      </div>

      {/* Face-to-Face Section */}
      {showF2FSection && (
        <div className="form-section f2f-section">
          <h3 className="form-section-title">
            <span className="icon">👨‍⚕️</span>
            Face-to-Face Encounter Required
          </h3>
          
          <div className="f2f-notice">
            <strong>Why F2F is required:</strong>{' '}
            {formData.isReadmission && formData.startingBenefitPeriod >= 3 
              ? 'Readmission + Period 3+'
              : formData.isReadmission 
                ? 'Readmission' 
                : 'Period 3+ (60-day cycle)'}
          </div>

          <div className="form-grid">
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="f2fCompleted"
                  checked={formData.f2fCompleted}
                  onChange={handleChange}
                />
                <span className="checkbox-text">F2F Encounter Completed</span>
              </label>
            </div>

            {formData.f2fCompleted && (
              <>
                <div className="form-group">
                  <label htmlFor="f2fDate">F2F Date</label>
                  <input
                    type="date"
                    id="f2fDate"
                    name="f2fDate"
                    value={formData.f2fDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="f2fPhysician">F2F Physician</label>
                  <input
                    type="text"
                    id="f2fPhysician"
                    name="f2fPhysician"
                    value={formData.f2fPhysician}
                    onChange={handleChange}
                    placeholder="Physician who performed F2F"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* HUV Section */}
      <div className="form-section">
        <h3 className="form-section-title">HOPE Update Visits (HUV)</h3>
        
        <div className="form-grid">
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="huv1Completed"
                checked={formData.huv1Completed}
                onChange={handleChange}
              />
              <span className="checkbox-text">HUV1 Completed (Days 5-14)</span>
            </label>
            {formData.huv1Completed && (
              <input
                type="date"
                name="huv1Date"
                value={formData.huv1Date}
                onChange={handleChange}
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="huv2Completed"
                checked={formData.huv2Completed}
                onChange={handleChange}
              />
              <span className="checkbox-text">HUV2 Completed (Days 15-28)</span>
            </label>
            {formData.huv2Completed && (
              <input
                type="date"
                name="huv2Date"
                value={formData.huv2Date}
                onChange={handleChange}
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        
        {isEditing && onDelete && (
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={() => onDelete(patient.id)}
          >
            Delete Patient
          </button>
        )}
        
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : (isEditing ? 'Update Patient' : 'Add Patient')}
        </button>
      </div>

      <style jsx>{`
        .patient-form {
          max-width: 800px;
        }

        .form-section {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .form-section-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.375rem;
        }

        .form-group input,
        .form-group select {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-hint {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }

        .checkbox-group {
          justify-content: center;
        }

        .checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          margin-top: 0.25rem;
        }

        .checkbox-text {
          display: flex;
          flex-direction: column;
        }

        .checkbox-text small {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .f2f-section {
          background: #fef3c7;
          border-color: #f59e0b;
        }

        .f2f-notice {
          background: #fff;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .info-icon {
          cursor: help;
          margin-left: 0.25rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
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
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .btn-danger:hover {
          background: #fecaca;
        }
      `}</style>
    </form>
  );
};

export default PatientForm;