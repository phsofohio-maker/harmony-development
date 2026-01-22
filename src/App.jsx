/**
 * App.jsx - Main Application with Theme Support & Onboarding
 * Updated: Added ThemeProvider and onboarding flow
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginForm from './components/LoginForm';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import HUVPage from './components/HUVPage';
import PatientsPage from './components/PatientsPage';
import CertificationsPage from './components/CertificationsPage';
import DocumentsPage from './components/DocumentsPage';
import SettingsPage from './components/SettingsPage';
import NotificationsPage from './components/NotificationsPage';
import OnboardingWizard from './components/OnboardingWizard';
import WelcomeTour from './components/WelcomeTour';

// Import theme CSS
import './styles/theme.css';

function AppContent() {
  const { user, userProfile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Onboarding state
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Get orgId for ThemeProvider
  const orgId = user?.customClaims?.orgId || 'org_parrish';
  const userRole = user?.customClaims?.role || userProfile?.role;

  // Check onboarding status
  useEffect(() => {
    if (user && !loading) {
      checkOnboardingStatus();
    }
  }, [user, loading]);

  const checkOnboardingStatus = async () => {
    try {
      // Check if org has completed setup (for admins)
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      const orgData = orgDoc.data();
      
      // Check user's onboarding status
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      if ((userRole === 'owner' || userRole === 'admin') && !orgData?.onboardingCompleted) {
        // Owner/Admin hasn't set up the org yet
        setShowOnboardingWizard(true);
      } else if (!userData?.onboardingCompleted) {
        // User hasn't seen the welcome tour
        setShowWelcomeTour(true);
      }
    } catch (err) {
      console.error('Error checking onboarding status:', err);
    } finally {
      setOnboardingChecked(true);
    }
  };

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
            background: var(--color-gray-50, #f9fafb);
          }
          .loading-content { text-align: center; }
          .spinner-large {
            width: 48px;
            height: 48px;
            margin: 0 auto 1rem;
            border: 4px solid var(--color-gray-200, #e5e7eb);
            border-top-color: var(--color-primary, #2563eb);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-content p { 
            color: var(--color-gray-500, #6b7280); 
            font-size: var(--font-size-sm, 0.875rem); 
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // Wait for onboarding check before showing main app
  if (!onboardingChecked) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner-large" />
          <p>Preparing your workspace...</p>
        </div>
        <style>{`
          .loading-screen {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--color-gray-50, #f9fafb);
          }
          .loading-content { text-align: center; }
          .spinner-large {
            width: 48px;
            height: 48px;
            margin: 0 auto 1rem;
            border: 4px solid var(--color-gray-200, #e5e7eb);
            border-top-color: var(--color-primary, #2563eb);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-content p { 
            color: var(--color-gray-500, #6b7280); 
            font-size: var(--font-size-sm, 0.875rem); 
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
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
    <ThemeProvider orgId={orgId}>
      {/* Onboarding Wizard for new org admins */}
      {showOnboardingWizard && (
        <OnboardingWizard
          orgId={orgId}
          userId={user.uid}
          onComplete={() => {
            setShowOnboardingWizard(false);
            setShowWelcomeTour(false); // Skip tour since wizard covers it
          }}
        />
      )}

      {/* Welcome Tour for new staff members */}
      {showWelcomeTour && !showOnboardingWizard && (
        <WelcomeTour
          userId={user.uid}
          orgName={userProfile?.organizationName || 'Harmony'}
          onComplete={() => setShowWelcomeTour(false)}
        />
      )}

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
      </div>

      <style>{`
        .app-layout {
          min-height: 100vh;
          background: var(--color-gray-50, #f9fafb);
        }

        .main-content {
          margin-left: var(--sidebar-width, 240px);
          padding: var(--spacing-lg, 1.5rem);
          transition: margin-left var(--transition-slow, 0.3s ease);
        }

        .main-content.sidebar-collapsed {
          margin-left: var(--sidebar-width-collapsed, 64px);
        }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
            padding: var(--spacing-md, 1rem);
          }
        }
      `}</style>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;