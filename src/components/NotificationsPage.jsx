/**
 * NotificationsPage.jsx - Notification Management & History
 * 
 * PURPOSE:
 * - View notification history (sent emails)
 * - Toggle notification preferences
 * - Test email functionality
 * - Monitor Cloud Function status
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const NotificationsPage = () => {
  const { user, userProfile, organization } = useAuth();
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
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  
  const orgId = userProfile?.organizationId || 'org_parrish';

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

  const sendTestEmail = async () => {
    if (settings.emailList.length === 0) {
      setTestResult({ success: false, message: 'Add at least one email recipient first' });
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      // Get the current user's ID token
      const idToken = await auth.currentUser.getIdToken();
      
      // Call the HTTP function with auth token
      const response = await fetch(
        'https://us-central1-parrish-harmonyhca.cloudfunctions.net/testEmail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ orgId })
        }
      );
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setTestResult({
          success: true,
          message: result.message || `Test email sent to ${settings.emailList.length} recipient(s)!`
        });
        loadData(); // Refresh history
      } else {
        throw new Error(result.error || 'Failed to send test email');
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'daily': return '📅';
      case 'weekly': return '📊';
      case 'huv': return '🏥';
      case 'f2f': return '👨‍⚕️';
      case 'test': return '🧪';
      default: return '📧';
    }
  };

  const getTypeBadge = (type) => {
    const styles = {
      daily: { bg: '#dbeafe', color: '#1e40af' },
      weekly: { bg: '#f3e8ff', color: '#6b21a8' },
      huv: { bg: '#d1fae5', color: '#065f46' },
      f2f: { bg: '#fef3c7', color: '#92400e' },
      test: { bg: '#e5e7eb', color: '#374151' }
    };
    const style = styles[type] || styles.test;
    return (
      <span style={{
        background: style.bg,
        color: style.color,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500
      }}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading notifications...</p>
        <style>{`
          .page-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; }
          .spinner { width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
          .page-loading p { color: #6b7280; margin-top: 1rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h1>🔔 Notifications</h1>
        <p>Manage email alerts and view notification history</p>
      </div>

      <div className="notifications-grid">
        {/* Settings Panel */}
        <div className="panel settings-panel">
          <h2>Alert Settings</h2>
          
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
                <span className="toggle-icon">👨‍⚕️</span>
                <div>
                  <strong>F2F Encounter Alerts</strong>
                  <small>Patients requiring Face-to-Face</small>
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
              <strong>Notification Lead Days</strong>
              <small>Alert when certification is due within this many days</small>
            </label>
            <select 
              value={settings.leadDays}
              onChange={(e) => handleLeadDaysChange(e.target.value)}
            >
              <option value={7}>7 days</option>
              <option value={10}>10 days</option>
              <option value={14}>14 days (recommended)</option>
              <option value={21}>21 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
        </div>

        {/* Recipients Panel */}
        <div className="panel recipients-panel">
          <h2>Email Recipients</h2>
          <p className="panel-desc">Notifications will be sent to these addresses</p>
          
          <div className="email-list">
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
                        {getTypeBadge(item.type)}
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
                         item.status === 'failed' ? '✗ Failed' : item.status}
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
          padding: 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 1.5rem;
        }

        .page-header h1 {
          margin: 0;
          font-size: 1.5rem;
          color: #1f2937;
        }

        .page-header p {
          margin: 0.25rem 0 0;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .notifications-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 1.5rem;
        }

        .panel h2 {
          margin: 0 0 1rem;
          font-size: 1rem;
          color: #1f2937;
        }

        .panel-desc {
          margin: -0.5rem 0 1rem;
          font-size: 0.875rem;
          color: #6b7280;
        }

        /* Toggle Switches */
        .toggle-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .toggle-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 8px;
        }

        .toggle-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .toggle-icon {
          font-size: 1.25rem;
        }

        .toggle-info strong {
          display: block;
          font-size: 0.875rem;
        }

        .toggle-info small {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .switch {
          position: relative;
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
          inset: 0;
          background: #d1d5db;
          border-radius: 24px;
          transition: 0.3s;
        }

        .slider:before {
          content: "";
          position: absolute;
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }

        input:checked + .slider {
          background: #2563eb;
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        .lead-days-setting {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .lead-days-setting label {
          display: block;
          margin-bottom: 0.5rem;
        }

        .lead-days-setting strong {
          display: block;
          font-size: 0.875rem;
        }

        .lead-days-setting small {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .lead-days-setting select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        /* Email Recipients */
        .email-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .email-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: #f3f4f6;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0 0.25rem;
          line-height: 1;
        }

        .remove-btn:hover {
          color: #ef4444;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #9ca3af;
        }

        .empty-state span {
          font-size: 2rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .add-email {
          display: flex;
          gap: 0.5rem;
        }

        .add-email input {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .add-email button {
          padding: 0.5rem 1rem;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .add-email button:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        .test-section {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .test-btn {
          width: 100%;
          padding: 0.75rem;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .test-btn:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .test-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .test-result {
          margin-top: 0.75rem;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .test-result.success {
          background: #d1fae5;
          color: #065f46;
        }

        .test-result.error {
          background: #fee2e2;
          color: #991b1b;
        }

        /* Schedule Panel */
        .schedule-items {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .schedule-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 8px;
        }

        .schedule-icon {
          font-size: 1.25rem;
        }

        .schedule-info {
          flex: 1;
        }

        .schedule-info strong {
          display: block;
          font-size: 0.875rem;
        }

        .schedule-info span {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .schedule-status {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .schedule-status.active {
          background: #d1fae5;
          color: #065f46;
        }

        .schedule-status.inactive {
          background: #f3f4f6;
          color: #6b7280;
        }

        .functions-status {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .functions-status h3 {
          font-size: 0.8rem;
          color: #6b7280;
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
          background: #10b981;
        }

        .status-dot.inactive {
          background: #d1d5db;
        }

        /* History Table */
        .history-panel {
          margin-top: 0;
        }

        .empty-history {
          text-align: center;
          padding: 3rem;
          color: #9ca3af;
        }

        .empty-history span {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .empty-history small {
          display: block;
          margin-top: 0.5rem;
        }

        .history-table-container {
          overflow-x: auto;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
        }

        .history-table th,
        .history-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .history-table th {
          background: #f9fafb;
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
        }

        .history-table td {
          font-size: 0.875rem;
        }

        .type-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .subject-cell {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recipients-cell {
          color: #6b7280;
        }

        .date-cell {
          white-space: nowrap;
          color: #6b7280;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-sent {
          background: #d1fae5;
          color: #065f46;
        }

        .status-failed {
          background: #fee2e2;
          color: #991b1b;
        }

        @media (max-width: 768px) {
          .notifications-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;