import React from 'react';
import './Scorecards.css';

function Scorecards({ patients }) {
  const getTotalCertifications = (status) => {
    return patients.filter((p) => p.certification === status).length;
  };

  return (
    <div className="scorecards">
      <div className="scorecard">
        <h2>Total Patients</h2>
        <p>{patients.length}</p>
      </div>
      <div className="scorecard">
        <h2>Certified</h2>
        <p>{getTotalCertifications('Certified')}</p>
      </div>
      <div className="scorecard">
        <h2>Pending</h2>
        <p>{getTotalCertifications('Pending')}</p>
      </div>
      <div className="scorecard">
        <h2>Not Certified</h2>
        <p>{getTotalCertifications('Not Certified')}</p>
      </div>
    </div>
  );
}

export default Scorecards;