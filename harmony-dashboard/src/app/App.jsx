// Artifact ID: app-component
// Branch: 1 (main) (019b4c98...)
// Version: 1
// Command: create
// UUID: 0a30d354-d721-433c-b9c1-cd7e13f5b326
// Created: 12/23/2025, 11:14:37 AM
// Change: Created

// ---

// src/App.jsx
// Main application component with auth gate and dashboard

import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';

function AppContent() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth state
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
          .loading-content {
            text-align: center;
          }
          .spinner-large {
            width: 48px;
            height: 48px;
            margin: 0 auto 1rem;
            border: 4px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-content p {
            color: #6b7280;
            font-size: 0.875rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Show dashboard for authenticated users
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}