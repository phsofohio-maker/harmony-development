import React from 'react';
import './PatientTable.css';

function PatientTable({ patients }) {
  return (
    <div className="patient-table-container">
      <table className="patient-table">
        <thead>
          <tr>
            <th>Patient Name</th>
            <th>Certification Status</th>
            <th>Last Appt Date</th>
            <th>Next Appt Date</th>
            <th>Certification Pct</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id}>
              <td>{patient.name}</td>
              <td>{patient.certification}</td>
              <td>{patient.lastAppointment}</td>
              <td>{patient.nextAppointment}</td>
              <td>{`${patient.certificationPercent}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PatientTable;