import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // **Note: Implement actual logout logic here**
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1>Harmony Dashboard</h1>
      </div>
      <div className="header-right">
        <button onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}

export default Header;