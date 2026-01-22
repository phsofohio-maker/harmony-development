/**
 * SettingsPage.jsx - Organization Settings & Configuration
 * Updated: Added Branding tab with BrandingSettings component
 * 
 * TABS:
 * - General: Organization name, default physician
 * - Branding: Logo, colors (NEW)
 * - Notifications: Email settings, alert preferences
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import BrandingSettings from './BrandingSettings';
import TeamManagement from './TeamManagement';
import PatientImportExport from './PatientImportExport';
import { 
  Building2, 
  Palette, 
  Bell, 
  Save, 
  Loader2, 
  Check,
  AlertCircle,
  Plus,
  X,
  Mail,
  Users,
  Database
} from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

  // Tab state
  const [activeTab, setActiveTab] = useState('general');

  // Settings state
  const [settings, setSettings] = useState({
    name: '',
    defaultPhysician: '',
    notifyDaysBefore: 5,
    emailList: [],
    notifications: {
      dailyCertAlerts: true,
      weeklySummary: true,
      huvDailyReport: true,
      f2fAlerts: true,
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Email input state
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState(null);

  // Load settings
  useEffect(() => {
    loadSettings();
  }, [orgId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      
      if (orgDoc.exists()) {
        const data = orgDoc.data();
        setSettings({
          name: data.name || '',
          defaultPhysician: data.defaultPhysician || '',
          notifyDaysBefore: data.notifyDaysBefore || 5,
          emailList: data.emailList || [],
          notifications: {
            dailyCertAlerts: data.notifications?.dailyCertAlerts ?? true,
            weeklySummary: data.notifications?.weeklySummary ?? true,
            huvDailyReport: data.notifications?.huvDailyReport ?? true,
            f2fAlerts: data.notifications?.f2fAlerts ?? true,
          }
        });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      await updateDoc(doc(db, 'organizations', orgId), {
        name: settings.name,
        defaultPhysician: settings.defaultPhysician,
        notifyDaysBefore: settings.notifyDaysBefore,
        emailList: settings.emailList,
        notifications: settings.notifications,
        updatedAt: new Date(),
      });

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Email management
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    
    if (!email) return;
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (settings.emailList.includes(email)) {
      setEmailError('This email is already in the list');
      return;
    }

    setSettings(prev => ({
      ...prev,
      emailList: [...prev.emailList, email]
    }));
    setNewEmail('');
    setEmailError(null);
  };

  const removeEmail = (email) => {
    setSettings(prev => ({
      ...prev,
      emailList: prev.emailList.filter(e => e !== email)
    }));
  };

  // Toggle notification
  const toggleNotification = (key) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data', icon: Database },
  ];

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-state">
          <Loader2 className="spin" size={24} />
          <span>Loading settings...</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your organization preferences and configuration</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`message-banner ${saveMessage.type}`}>
          {saveMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-nav">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="settings-section">
            <div className="section-card">
              <h2>Organization Information</h2>
              
              <div className="form-group">
                <label htmlFor="orgName">Organization Name</label>
                <input
                  id="orgName"
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter organization name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="physician">Default Attending Physician</label>
                <input
                  id="physician"
                  type="text"
                  value={settings.defaultPhysician}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultPhysician: e.target.value }))}
                  placeholder="Dr. Smith"
                />
                <span className="form-hint">Used as default when creating new patient records</span>
              </div>

              <div className="form-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <BrandingSettings />
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <TeamManagement />
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="settings-section">
            {/* Email Recipients */}
            <div className="section-card">
              <h2>Email Recipients</h2>
              <p className="section-desc">
                These addresses will receive compliance alerts and summary reports
              </p>

              <div className="email-input-row">
                <div className="email-input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setEmailError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                    placeholder="Add email address"
                  />
                </div>
                <button className="btn-secondary" onClick={addEmail}>
                  <Plus size={16} />
                  Add
                </button>
              </div>
              
              {emailError && (
                <div className="field-error">
                  <AlertCircle size={14} />
                  {emailError}
                </div>
              )}

              {settings.emailList.length > 0 ? (
                <div className="email-list">
                  {settings.emailList.map(email => (
                    <div key={email} className="email-tag">
                      <span>{email}</span>
                      <button onClick={() => removeEmail(email)} aria-label="Remove email">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No email recipients configured
                </div>
              )}
            </div>

            {/* Notification Toggles */}
            <div className="section-card">
              <h2>Alert Preferences</h2>

              <div className="toggle-list">
                <div className="toggle-item">
                  <div className="toggle-info">
                    <span className="toggle-label">Daily Certification Alerts</span>
                    <span className="toggle-desc">Get notified about upcoming and overdue certifications</span>
                  </div>
                  <button 
                    className={`toggle-switch ${settings.notifications.dailyCertAlerts ? 'on' : ''}`}
                    onClick={() => toggleNotification('dailyCertAlerts')}
                    role="switch"
                    aria-checked={settings.notifications.dailyCertAlerts}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>

                <div className="toggle-item">
                  <div className="toggle-info">
                    <span className="toggle-label">Weekly Summary</span>
                    <span className="toggle-desc">Receive a weekly digest of compliance status</span>
                  </div>
                  <button 
                    className={`toggle-switch ${settings.notifications.weeklySummary ? 'on' : ''}`}
                    onClick={() => toggleNotification('weeklySummary')}
                    role="switch"
                    aria-checked={settings.notifications.weeklySummary}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>

                <div className="toggle-item">
                  <div className="toggle-info">
                    <span className="toggle-label">HUV Daily Reports</span>
                    <span className="toggle-desc">Daily updates on HOPE Update Visit status</span>
                  </div>
                  <button 
                    className={`toggle-switch ${settings.notifications.huvDailyReport ? 'on' : ''}`}
                    onClick={() => toggleNotification('huvDailyReport')}
                    role="switch"
                    aria-checked={settings.notifications.huvDailyReport}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>

                <div className="toggle-item">
                  <div className="toggle-info">
                    <span className="toggle-label">Face-to-Face Alerts</span>
                    <span className="toggle-desc">Get notified when F2F encounters are required</span>
                  </div>
                  <button 
                    className={`toggle-switch ${settings.notifications.f2fAlerts ? 'on' : ''}`}
                    onClick={() => toggleNotification('f2fAlerts')}
                    role="switch"
                    aria-checked={settings.notifications.f2fAlerts}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label htmlFor="leadDays">Alert Lead Time (days)</label>
                <input
                  id="leadDays"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.notifyDaysBefore}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notifyDaysBefore: parseInt(e.target.value) || 5 
                  }))}
                  style={{ width: '100px' }}
                />
                <span className="form-hint">Days before a deadline to start sending alerts</span>
              </div>

              <div className="form-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <PatientImportExport onImportComplete={() => {
            // Could trigger a refresh or show success message
            console.log('Import complete');
          }} />
        )}
      </div>

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .settings-page {
    max-width: 900px;
    margin: 0 auto;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem;
    color: var(--color-gray-500);
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Page Header */
  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-gray-900);
  }

  .page-header p {
    margin: 0.25rem 0 0;
    color: var(--color-gray-500);
  }

  /* Message Banner */
  .message-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    margin-bottom: 1rem;
  }

  .message-banner.success {
    background: var(--color-success-light);
    color: var(--color-success-dark);
  }

  .message-banner.error {
    background: var(--color-error-light);
    color: var(--color-error-dark);
  }

  /* Tab Navigation */
  .tab-nav {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: var(--color-gray-100);
    border-radius: var(--radius-lg);
    margin-bottom: 1.5rem;
    overflow-x: auto;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-gray-600);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: var(--color-gray-900);
  }

  .tab-btn.active {
    background: white;
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  /* Section Cards */
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section-card {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: 1.5rem;
  }

  .section-card h2 {
    margin: 0 0 0.25rem;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-gray-900);
  }

  .section-desc {
    margin: 0 0 1.25rem;
    font-size: var(--font-size-sm);
    color: var(--color-gray-500);
  }

  /* Form Elements */
  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-gray-700);
  }

  .form-group input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    transition: border-color var(--transition-fast);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  .form-hint {
    display: block;
    margin-top: 0.375rem;
    font-size: var(--font-size-xs);
    color: var(--color-gray-500);
  }

  .form-actions {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-gray-100);
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    background: white;
    color: var(--color-gray-700);
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-secondary:hover {
    background: var(--color-gray-50);
    border-color: var(--color-gray-400);
  }

  /* Email Input */
  .email-input-row {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .email-input-wrapper {
    flex: 1;
    position: relative;
  }

  .email-input-wrapper .input-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-gray-400);
  }

  .email-input-wrapper input {
    width: 100%;
    padding: 0.625rem 0.875rem 0.625rem 2.5rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .email-input-wrapper input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  .field-error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--color-error);
    font-size: var(--font-size-sm);
    margin-bottom: 1rem;
  }

  /* Email List */
  .email-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .email-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem 0.375rem 0.75rem;
    background: var(--color-gray-100);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
  }

  .email-tag button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: var(--color-gray-300);
    border: none;
    border-radius: 50%;
    color: var(--color-gray-600);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .email-tag button:hover {
    background: var(--color-error);
    color: white;
  }

  .empty-state {
    padding: 1.5rem;
    text-align: center;
    color: var(--color-gray-500);
    font-size: var(--font-size-sm);
    background: var(--color-gray-50);
    border-radius: var(--radius-md);
  }

  /* Toggle Switches */
  .toggle-list {
    display: flex;
    flex-direction: column;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0;
    border-bottom: 1px solid var(--color-gray-100);
  }

  .toggle-item:last-child {
    border-bottom: none;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .toggle-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-gray-900);
  }

  .toggle-desc {
    font-size: var(--font-size-xs);
    color: var(--color-gray-500);
  }

  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--color-gray-300);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .toggle-switch.on {
    background: var(--color-primary);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-fast);
  }

  .toggle-switch.on .toggle-knob {
    transform: translateX(20px);
  }
`;

export default SettingsPage;