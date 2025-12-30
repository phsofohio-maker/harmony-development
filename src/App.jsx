/**
 * App.jsx - Main Application with Full Navigation
 * Phase 3: Added NotificationsPage
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import HUVPage from './components/HUVPage';
import PatientsPage from './components/PatientsPage';
import CertificationsPage from './components/CertificationsPage';
import DocumentsPage from './components/DocumentsPage';
import SettingsPage from './components/SettingsPage';
import NotificationsPage from './components/NotificationsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner-large" />
          <p>Loading Harmony...</p>
        </div>
        <style>{`
          .loading-screen {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f9fafb;
          }
          .loading-content { text-align: center; }
          .spinner-large {
            width: 48px;
            height: 48px;
            margin: 0 auto 1rem;
            border: 4px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-content p { color: #6b7280; font-size: 0.875rem; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'patients':
        return <PatientsPage />;
      case 'certifications':
        return <CertificationsPage />;
      case 'huv':
        return <HUVPage />;
      case 'documents':
        return <DocumentsPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar 
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {renderPage()}
      </main>

      <style>{`
        .app-layout {
          display: flex;
          min-height: 100vh;
          background: #f9fafb;
        }
        .main-content {
          flex: 1;
          margin-left: 240px;
          transition: margin-left 0.3s ease;
          min-height: 100vh;
        }
        .main-content.sidebar-collapsed {
          margin-left: 64px;
        }
        @media (max-width: 768px) {
          .main-content {
            margin-left: 64px;
          }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}