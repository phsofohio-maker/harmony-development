import React, { useState, useEffect } from 'react';
import Header from './Header';
import Scorecards from './Scorecards';
import PatientTable from './PatientTable';
import PatientModal from './PatientModal';
import { getPatients } from '../services/patientService';
import './Dashboard.css';

function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchPatients = async () => {
      const patientData = await getPatients();
      setPatients(patientData);
    };
    fetchPatients();
  }, []);

  const handleAddPatient = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSavePatient = (newPatient) => {
    // **Note: Implement logic to save the new patient to the backend**
    setPatients([...patients, { ...newPatient, id: patients.length + 1 }]);
  };

  return (
    <div className="dashboard-container">
      <Header />
      <main className="main-content">
        <Scorecards patients={patients} />
        <div className="action-bar">
          <button onClick={handleAddPatient}>Add New Patient</button>
        </div>
        <PatientTable patients={patients} />
      </main>
      {isModalOpen && (
        <PatientModal
          onClose={handleCloseModal}
          onSave={handleSavePatient}
        />
      )}
    </div>
  );
}

export default Dashboard;