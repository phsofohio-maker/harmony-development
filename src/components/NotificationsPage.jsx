/**
 * NotificationsPage.jsx - Notification Management & History
 * Fixed: setEmailTestResult → setTestResult
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

const NotificationsPage = () => {
  const { userProfile } = useAuth();
  
  // State
  const [settings, setSettings] = useState({
    dailyAlerts: true,
    weeklySummary: true,
    huvReports: true,
    f2fAlerts: true,
    leadDays: 14,
    emailList: []
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // THIS IS THE CORRECT STATE VARIABLE
  const [newEmail, setNewEmail] = useState('');
  
  const orgId = userProfile?.organizationId || 'org_parrish';

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load organization settings
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      if (orgDoc.exists()) {
        const data = orgDoc.data();
        setSettings({
          dailyAlerts: data.notifications?.dailyAlerts ?? true,
          weeklySummary: data.notifications?.weeklySummary ?? true,
          huvReports: data.notifications?.huvReports ?? true,
          f2fAlerts: data.notifications?.f2fAlerts ?? true,
          leadDays: data.notifications?.leadDays ?? 14,
          emailList: data.emailList || []
        });
      }
      
      // Load notification history
      const historyRef = collection(db, 'organizations', orgId, 'notificationHistory');
      const historyQuery = query(historyRef, orderBy('sentAt', 'desc'), limit(50));
      const historySnapshot = await getDocs(historyQuery);
      
      const historyData = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate()
      }));
      setHistory(historyData);
      
    } catch (error) {
      console.error('Error loading notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle notification settings
  const handleToggle = async (field) => {
    const newValue = !settings[field];
    setSettings(prev => ({ ...prev, [field]: newValue }));
    
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        [`notifications.${field}`]: newValue
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      setSettings(prev => ({ ...prev, [field]: !newValue }));
    }
  };

  // Update lead days
  const handleLeadDaysChange = async (value) => {
    const days = parseInt(value) || 14;
    setSettings(prev => ({ ...prev, leadDays: days }));
    
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        'notifications.leadDays': days
      });
    } catch (error) {
      console.error('Error updating lead days:', error);
    }
  };

  // Add email to list
  const addEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    if (settings.emailList.includes(newEmail)) return;
    
    const updated = [...settings.emailList, newEmail];
    setSettings(prev => ({ ...prev, emailList: updated }));
    setNewEmail('');
    
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        emailList: updated
      });
    } catch (error) {
      console.error('Error adding email:', error);
    }
  };

  // Remove email from list
  const removeEmail = async (email) => {
    const updated = settings.emailList.filter(e => e !== email);
    setSettings(prev => ({ ...prev, emailList: updated }));
    
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        emailList: updated
      });
    } catch (error) {
      console.error('Error removing email:', error);
    }
  };

  // Send test email - FIXED VERSION
  const sendTestEmail = async () => {
    if (settings.emailList.length === 0) {
      setTestResult({ success: false, message: 'Add at least one email recipient first' });
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      // Call the Cloud Function
      const testEmailFunction = httpsCallable(functions, 'testEmail');
      const result = await testEmailFunction({ orgId });
      
      if (result.data.success) {
        setTestResult({
          success: true,
          message: result.data.message || `Test email sent to ${settings.emailList.length} recipient(s)!`
        });
        loadData(); // Refresh history
      } else {
        throw new Error(result.data.error || 'Failed to send test email');
      }
      
    } catch (error) {
      console.error('Test email error:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to send test email. Check console for details.'
      });
    } finally {
      setTesting(false);
    }
  };

  // Format date helper
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Get type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case 'certification_alert': return '📋';
      case 'weekly_summary': return '📊';
      case 'f2f_alert': return '👤';
      case 'huv_report': return '🏥';
      case 'test_email': return '🧪';
      default: return '📧';
    }
  };

  // Get type badge
  const getTypeBadge = (type) => {
    const badges = {
      certification_alert: 'Certification',
      weekly_summary: 'Weekly',
      f2f_alert: 'F2F Alert',
      huv_report: 'HUV Report',
      test_email: 'Test'
    };
    return badges[type] || 'Email';
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>🔔 Notifications</h1>
        <p>Manage email alerts and view notification history</p>
      </div>

      <div className="notifications-grid">
        {/* Email Recipients Panel */}
        <div className="panel recipients-panel">
          <h2>📧 Email Recipients</h2>
          
          <div className="recipients-section">
            {settings.emailList.length === 0 ? (
              <div className="empty-state">
                <span>📭</span>
                <p>No recipients configured</p>
              </div>
            ) : (
              settings.emailList.map(email => (
                <div key={email} className="email-item">
                  <span>{email}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => removeEmail(email)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="add-email">
            <input
              type="email"
              placeholder="Add email address..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEmail()}
            />
            <button onClick={addEmail} disabled={!newEmail}>
              Add
            </button>
          </div>

          <div className="test-section">
            <button 
              className="test-btn"
              onClick={sendTestEmail}
              disabled={testing || settings.emailList.length === 0}
            >
              {testing ? 'Sending...' : '🧪 Send Test Email'}
            </button>
            
            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? '✓' : '✗'} {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Alert Settings Panel */}
        <div className="panel settings-panel">
          <h2>⚙️ Alert Settings</h2>
          
          <div className="toggle-group">
            <div className="toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">📅</span>
                <div>
                  <strong>Daily Certification Alerts</strong>
                  <small>Patients due within lead days window</small>
                </div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.dailyAlerts}
                  onChange={() => handleToggle('dailyAlerts')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">📊</span>
                <div>
                  <strong>Weekly Summary</strong>
                  <small>Every Monday at 8am ET</small>
                </div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.weeklySummary}
                  onChange={() => handleToggle('weeklySummary')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">🏥</span>
                <div>
                  <strong>HUV Status Reports</strong>
                  <small>Patients with HUV windows due</small>
                </div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.huvReports}
                  onChange={() => handleToggle('huvReports')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">👤</span>
                <div>
                  <strong>F2F Encounter Alerts</strong>
                  <small>Face-to-Face requirements</small>
                </div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.f2fAlerts}
                  onChange={() => handleToggle('f2fAlerts')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="lead-days-setting">
            <label>
              <strong>Lead Days for Alerts</strong>
              <small>Send alerts this many days before due date</small>
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.leadDays}
              onChange={(e) => handleLeadDaysChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Schedule Panel */}
      <div className="panel schedule-panel">
        <h2>📆 Notification Schedule</h2>
        
        <div className="schedule-items">
          <div className="schedule-item">
            <div className="schedule-icon">📅</div>
            <div className="schedule-info">
              <strong>Daily Alerts</strong>
              <span>Every day at 9:00 AM ET</span>
            </div>
            <div className={`schedule-status ${settings.dailyAlerts ? 'active' : 'inactive'}`}>
              {settings.dailyAlerts ? 'Active' : 'Disabled'}
            </div>
          </div>

          <div className="schedule-item">
            <div className="schedule-icon">📊</div>
            <div className="schedule-info">
              <strong>Weekly Summary</strong>
              <span>Mondays at 8:00 AM ET</span>
            </div>
            <div className={`schedule-status ${settings.weeklySummary ? 'active' : 'inactive'}`}>
              {settings.weeklySummary ? 'Active' : 'Disabled'}
            </div>
          </div>
        </div>

        <div className="functions-status">
          <h3>Cloud Functions Status</h3>
          <div className="function-item">
            <span className="status-dot active"></span>
            <span>dailyCertificationCheck</span>
          </div>
          <div className="function-item">
            <span className="status-dot active"></span>
            <span>weeklySummary</span>
          </div>
          <div className="function-item">
            <span className="status-dot active"></span>
            <span>testEmail</span>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="panel history-panel">
        <h2>📬 Notification History</h2>
        
        {history.length === 0 ? (
          <div className="empty-history">
            <span>📭</span>
            <p>No notifications sent yet</p>
            <small>Send a test email to get started</small>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className="type-cell">
                        {getTypeIcon(item.type)}
                        <span className="type-badge">{getTypeBadge(item.type)}</span>
                      </span>
                    </td>
                    <td className="subject-cell">{item.subject}</td>
                    <td className="recipients-cell">
                      {item.recipients?.length || 0} recipient(s)
                    </td>
                    <td className="date-cell">{formatDate(item.sentAt)}</td>
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status === 'sent' ? '✓ Sent' : 
                         item.status === 'failed' ? '✗ Failed' : 
                         '⏳ Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .notifications-page {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          color: var(--color-gray-800);
        }

        .page-header p {
          margin: 0;
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
        }

        .notifications-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        @media (max-width: 1024px) {
          .notifications-grid {
            grid-template-columns: 1fr;
          }
        }

        .panel {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        }

        .panel h2 {
          margin: 0 0 1.5rem 0;
          font-size: var(--font-size-lg);
          color: var(--color-gray-800);
        }

        /* Recipients Panel */
        .recipients-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .email-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: var(--color-gray-50);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }

        .remove-btn {
          background: none;
          border: none;
          color: var(--color-error);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-btn:hover {
          color: #dc2626; /* Not in migration guide, keeping as is */
        }

        .add-email {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .add-email input {
          flex: 1;
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        .add-email button {
          padding: 0.625rem 1.25rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 500;
          cursor: pointer;
        }

        .add-email button:disabled {
          background: #94a3b8; /* Not in migration guide */
          cursor: not-allowed;
        }

        .test-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .test-btn {
          width: 100%;
          padding: 0.75rem;
          background: #8b5cf6; /* Not in migration guide */
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 500;
          cursor: pointer;
        }

        .test-btn:hover:not(:disabled) {
          background: #7c3aed; /* Not in migration guide */
        }

        .test-btn:disabled {
          background: #94a3b8; /* Not in migration guide */
          cursor: not-allowed;
        }

        .test-result {
          margin-top: 0.75rem;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        .test-result.success {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }

        .test-result.error {
          background: var(--color-error-light);
          color: var(--color-error-dark);
        }

        /* Toggle Settings */
        .toggle-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .toggle-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-md);
        }

        .toggle-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .toggle-icon {
          font-size: 1.5rem;
        }

        .toggle-info strong {
          display: block;
          font-size: var(--font-size-sm);
          color: var(--color-gray-800);
        }

        .toggle-info small {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        /* Toggle Switch */
        .switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1; /* Not in migration guide */
          transition: 0.3s; /* var(--transition-slow) */
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s; /* var(--transition-slow) */
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--color-primary);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        /* Lead Days Setting */
        .lead-days-setting {
          padding: 1rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-md);
        }

        .lead-days-setting label {
          display: block;
          margin-bottom: 0.5rem;
        }

        .lead-days-setting strong {
          display: block;
          font-size: var(--font-size-sm);
          color: var(--color-gray-800);
        }

        .lead-days-setting small {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .lead-days-setting input {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          margin-top: 0.5rem;
        }

        /* Schedule Panel */
        .schedule-items {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .schedule-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-md);
        }

        .schedule-icon {
          font-size: var(--font-size-xl);
        }

        .schedule-info {
          flex: 1;
        }

        .schedule-info strong {
          display: block;
          font-size: var(--font-size-sm);
        }

        .schedule-info span {
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .schedule-status {
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: 0.7rem;
          font-weight: 500;
        }

        .schedule-status.active {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }

        .schedule-status.inactive {
          background: var(--color-gray-100);
          color: var(--color-gray-500);
        }

        /* Functions Status */
        .functions-status {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .functions-status h3 {
          font-size: 0.8rem;
          color: var(--color-gray-500);
          margin: 0 0 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .function-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0;
          font-size: 0.8rem;
          font-family: monospace;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.active {
          background: var(--color-success);
        }

        /* History Table */
        .empty-state, .empty-history {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--color-gray-500);
        }

        .empty-state span, .empty-history span {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .empty-history small {
          display: block;
          margin-top: 0.5rem;
          font-size: 0.8rem;
        }

        .history-table-container {
          overflow-x: auto;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
        }

        .history-table th {
          text-align: left;
          padding: 0.75rem;
          background: var(--color-gray-50);
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-gray-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .history-table td {
          padding: 0.75rem;
          border-bottom: 1px solid var(--border-color);
          font-size: var(--font-size-sm);
        }

        .type-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .type-badge {
          padding: 0.25rem 0.5rem;
          background: var(--color-gray-100);
          border-radius: var(--radius-sm);
          font-size: 0.7rem;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: 0.7rem;
          font-weight: 500;
        }

        .status-badge.status-sent {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }

        .status-badge.status-failed {
          background: var(--color-error-light);
          color: var(--color-error-dark);
        }

        .status-badge.status-pending {
          background: var(--color-warning-light);
          color: var(--color-warning-dark);
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;