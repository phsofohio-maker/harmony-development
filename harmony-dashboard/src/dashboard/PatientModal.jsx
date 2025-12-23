import React, { useState } from 'react';
import './PatientModal.css';

function PatientModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [lastAppointment, setLastAppointment] = useState('');
  const [nextAppointment, setNextAppointment] = useState('');

  const handleSave = () => {
    // **Note: Implement validation here**
    onSave({ name, lastAppointment, nextAppointment });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Add New Patient</h2>
        <div className="form-group">
          <label htmlFor="name">Patient Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="lastAppointment">Last Appointment Date</label>
          <input
            type="date"
            id="lastAppointment"
            value={lastAppointment}
            onChange={(e) => setLastAppointment(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="nextAppointment">Next Appointment Date</label>
          <input
            type="date"
            id="nextAppointment"
            value={nextAppointment}
            onChange={(e) => setNextAppointment(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default PatientModal;