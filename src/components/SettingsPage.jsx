/**
 * SettingsPage.jsx - Organization Settings & Configuration
 * 
 * PURPOSE:
 * Manage organization settings, notification preferences,
 * and email recipient lists.
 * 
 * FEATURES:
 * - Organization info (name, default physician)
 * - Notification timing settings
 * - Email recipient management
 * - Notification toggle switches
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const SettingsPage = () => {
  const { user, organization } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

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

  // Handle input changes
  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle notification toggle
  const handleNotificationToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  // Add email recipient
  const handleAddEmail = () => {
    setEmailError(null);
    
    const email = newEmail.trim().toLowerCase();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Check for duplicates
    if (settings.emailList.includes(email)) {
      setEmailError('This email is already in the list');
      return;
    }

    setSettings(prev => ({
      ...prev,
      emailList: [...prev.emailList, email]
    }));
    setNewEmail('');
  };

  // Remove email recipient
  const handleRemoveEmail = (email) => {
    setSettings(prev => ({
      ...prev,
      emailList: prev.emailList.filter(e => e !== email)
    }));
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading settings...</p>
        <style>{`
          .page-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .page-loading p { color: #6b7280; margin-top: 1rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Save Message */}
      {saveMessage && (
        <div className={`save-message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      {/* General Settings */}
      <div className="settings-card">
        <div className="card-header">
          <h3>⚙️ General Settings</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="orgName">Organization Name</label>
            <input
              type="text"
              id="orgName"
              value={settings.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Your Organization Name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="defaultPhysician">Default Attending Physician</label>
            <input
              type="text"
              id="defaultPhysician"
              value={settings.defaultPhysician}
              onChange={(e) => handleChange('defaultPhysician', e.target.value)}
              placeholder="Dr. Name"
            />
            <small>Used as default when adding new patients</small>
          </div>

          <div className="form-group">
            <label htmlFor="notifyDays">Notification Lead Days</label>
            <input
              type="number"
              id="notifyDays"
              value={settings.notifyDaysBefore}
              onChange={(e) => handleChange('notifyDaysBefore', parseInt(e.target.value) || 5)}
              min="1"
              max="30"
              style={{ width: '100px' }}
            />
            <small>Days before certification due date to start sending notifications</small>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="settings-card">
        <div className="card-header">
          <h3>🔔 Email Notification Settings</h3>
        </div>
        <div className="card-body">
          <div className="toggle-list">
            <div className="toggle-item">
              <div className="toggle-info">
                <strong>Daily Certification Alerts</strong>
                <span>Send at 9:00 AM ET when certifications are due soon</span>
              </div>
              <button 
                className={`toggle-switch ${settings.notifications.dailyCertAlerts ? 'active' : ''}`}
                onClick={() => handleNotificationToggle('dailyCertAlerts')}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>Weekly Summary</strong>
                <span>Send every Monday at 8:00 AM ET with overview statistics</span>
              </div>
              <button 
                className={`toggle-switch ${settings.notifications.weeklySummary ? 'active' : ''}`}
                onClick={() => handleNotificationToggle('weeklySummary')}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>HUV Daily Report</strong>
                <span>Send daily HUV status updates to clinical staff</span>
              </div>
              <button 
                className={`toggle-switch ${settings.notifications.huvDailyReport ? 'active' : ''}`}
                onClick={() => handleNotificationToggle('huvDailyReport')}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>F2F Encounter Alerts</strong>
                <span>Send alerts when Face-to-Face encounters are required or overdue</span>
              </div>
              <button 
                className={`toggle-switch ${settings.notifications.f2fAlerts ? 'active' : ''}`}
                onClick={() => handleNotificationToggle('f2fAlerts')}
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Recipients */}
      <div className="settings-card">
        <div className="card-header">
          <h3>📧 Email Recipients</h3>
        </div>
        <div className="card-body">
          <p className="section-description">
            These email addresses will receive certification alerts and weekly summaries.
          </p>

          {/* Current Recipients */}
          <div className="recipients-list">
            {settings.emailList.length === 0 ? (
              <div className="empty-recipients">
                No email recipients configured. Add at least one email to receive notifications.
              </div>
            ) : (
              settings.emailList.map((email, index) => (
                <div key={email} className="recipient-item">
                  <span className="recipient-email">{email}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveEmail(email)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add New Email */}
          <div className="add-email-form">
            <div className="email-input-group">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                placeholder="email@example.com"
              />
              <button 
                className="btn btn-secondary"
                onClick={handleAddEmail}
              >
                + Add
              </button>
            </div>
            {emailError && <div className="email-error">{emailError}</div>}
          </div>
        </div>
      </div>

      {/* Cloud Functions Status */}
      <div className="settings-card info-card">
        <div className="card-header">
          <h3>☁️ Automated Functions Status</h3>
        </div>
        <div className="card-body">
          <div className="function-status">
            <div className="status-item">
              <span className="status-dot green" />
              <span className="status-name">dailyCertificationCheck</span>
              <span className="status-schedule">Every day at 9:00 AM ET</span>
            </div>
            <div className="status-item">
              <span className="status-dot green" />
              <span className="status-name">weeklySummary</span>
              <span className="status-schedule">Every Monday at 8:00 AM ET</span>
            </div>
          </div>
          <p className="functions-note">
            ℹ️ Cloud Functions are deployed and running. Ensure EMAIL_USER and EMAIL_PASS 
            secrets are configured in Firebase for emails to send successfully.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="save-section">
        <button 
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      <style>{`
        .settings-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 800px;
        }

        /* Save Message */
        .save-message {
          padding: 1rem;
          border-radius: 8px;
          font-weight: 500;
        }
        .save-message.success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .save-message.error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        /* Settings Cards */
        .settings-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .card-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .card-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .card-body {
          padding: 1.25rem;
        }

        /* Form Groups */
        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .form-group small {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.375rem;
        }

        /* Toggle List */
        .toggle-list {
          display: flex;
          flex-direction: column;
        }

        .toggle-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .toggle-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .toggle-item:first-child {
          padding-top: 0;
        }

        .toggle-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .toggle-info strong {
          font-size: 0.875rem;
          color: #1f2937;
        }

        .toggle-info span {
          font-size: 0.75rem;
          color: #6b7280;
        }

        /* Toggle Switch */
        .toggle-switch {
          width: 44px;
          height: 24px;
          background: #d1d5db;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .toggle-switch.active {
          background: #2563eb;
        }

        .toggle-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .toggle-switch.active .toggle-knob {
          transform: translateX(20px);
        }

        /* Email Recipients */
        .section-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0 0 1rem 0;
        }

        .recipients-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .empty-recipients {
          padding: 1rem;
          background: #f9fafb;
          border-radius: 8px;
          color: #6b7280;
          font-size: 0.875rem;
          text-align: center;
        }

        .recipient-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 0.75rem;
          background: #f9fafb;
          border-radius: 8px;
        }

        .recipient-email {
          font-size: 0.875rem;
          color: #1f2937;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #ef4444;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0 0.25rem;
          line-height: 1;
        }

        .remove-btn:hover {
          color: #dc2626;
        }

        /* Add Email Form */
        .add-email-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .email-input-group {
          display: flex;
          gap: 0.5rem;
        }

        .email-input-group input {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .email-input-group input:focus {
          outline: none;
          border-color: #2563eb;
        }

        .email-error {
          font-size: 0.75rem;
          color: #ef4444;
        }

        /* Cloud Functions Status */
        .info-card .card-header {
          background: #eff6ff;
        }

        .function-status {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.green {
          background: #10b981;
        }

        .status-name {
          font-family: monospace;
          color: #374151;
        }

        .status-schedule {
          color: #6b7280;
          font-size: 0.8125rem;
        }

        .functions-note {
          font-size: 0.8125rem;
          color: #6b7280;
          margin: 0;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
        }

        /* Buttons */
        .btn {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
          font-weight: 500;
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
          border: 1px solid #e5e7eb;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-lg {
          padding: 0.75rem 2rem;
          font-size: 1rem;
        }

        /* Save Section */
        .save-section {
          display: flex;
          justify-content: flex-end;
          padding-top: 0.5rem;
        }

        @media (max-width: 640px) {
          .toggle-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .email-input-group {
            flex-direction: column;
          }

          .status-item {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;