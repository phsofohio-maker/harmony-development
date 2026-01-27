/**
 * NotificationsPage.jsx - Email & Alert Management
 * UPDATED: Unified branding with Lucide icons (no emojis)
 * Maintains visual polish with consistent iconography
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Bell, Mail, Settings, Calendar, BarChart3, Building2, User,
  Plus, X, Check, AlertTriangle, Loader2, Send, Clock, 
  ClipboardCheck, Stethoscope, TestTube
} from 'lucide-react';

const NotificationsPage = () => {
  const { user, userProfile } = useAuth();
  const orgId = userProfile?.organizationId || 'org_parrish';

  const [settings, setSettings] = useState({
    emailList: [],
    dailyAlerts: true,
    weeklySummary: true,
    huvReports: true,
    f2fAlerts: true,
    leadDays: 14
  });
  
  const [emailHistory, setEmailHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newEmail, setNewEmail] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      if (orgDoc.exists()) {
        const data = orgDoc.data();
        setSettings({
          emailList: data.emailList || [],
          dailyAlerts: data.notifications?.dailyCertAlerts ?? true,
          weeklySummary: data.notifications?.weeklySummary ?? true,
          huvReports: data.notifications?.huvDailyReport ?? true,
          f2fAlerts: data.notifications?.f2fAlerts ?? true,
          leadDays: data.certificationLeadDays || 14
        });
      }

      const historyRef = collection(db, 'organizations', orgId, 'emailHistory');
      const historyQuery = query(historyRef, orderBy('sentAt', 'desc'), limit(20));
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate()
      }));
      setEmailHistory(history);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    if (settings.emailList.includes(newEmail)) return;

    try {
      setSaving(true);
      const updated = [...settings.emailList, newEmail];
      await updateDoc(doc(db, 'organizations', orgId), { emailList: updated });
      setSettings(prev => ({ ...prev, emailList: updated }));
      setNewEmail('');
    } catch (err) {
      console.error('Error adding email:', err);
    } finally {
      setSaving(false);
    }
  };

  const removeEmail = async (email) => {
    try {
      setSaving(true);
      const updated = settings.emailList.filter(e => e !== email);
      await updateDoc(doc(db, 'organizations', orgId), { emailList: updated });
      setSettings(prev => ({ ...prev, emailList: updated }));
    } catch (err) {
      console.error('Error removing email:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key) => {
    const notifKey = {
      dailyAlerts: 'dailyCertAlerts',
      weeklySummary: 'weeklySummary',
      huvReports: 'huvDailyReport',
      f2fAlerts: 'f2fAlerts'
    }[key];

    try {
      setSaving(true);
      const newValue = !settings[key];
      await updateDoc(doc(db, 'organizations', orgId), {
        [`notifications.${notifKey}`]: newValue
      });
      setSettings(prev => ({ ...prev, [key]: newValue }));
    } catch (err) {
      console.error('Error updating toggle:', err);
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    if (settings.emailList.length === 0) return;
    
    try {
      setTesting(true);
      setTestResult(null);
      
      const testFn = httpsCallable(functions, 'testEmail');
      const result = await testFn({ organizationId: orgId });
      
      setTestResult({
        success: result.data.success,
        message: result.data.success 
          ? `Test email sent to ${settings.emailList.length} recipient(s)!`
          : 'Failed to send test email. Check console for details.'
      });
      
      if (result.data.success) loadData();
    } catch (err) {
      console.error('Test email error:', err);
      setTestResult({
        success: false,
        message: 'Failed to send test email. Check console for details.'
      });
    } finally {
      setTesting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  };

  const getTypeIcon = (type) => {
    const icons = {
      certification_alert: ClipboardCheck,
      weekly_summary: BarChart3,
      f2f_alert: Stethoscope,
      huv_report: Building2,
      test_email: TestTube
    };
    const Icon = icons[type] || Mail;
    return <Icon size={16} />;
  };

  const getTypeBadge = (type) => {
    const badges = {
      certification_alert: { label: 'Certification', color: 'blue' },
      weekly_summary: { label: 'Weekly', color: 'purple' },
      f2f_alert: { label: 'F2F Alert', color: 'amber' },
      huv_report: { label: 'HUV Report', color: 'teal' },
      test_email: { label: 'Test', color: 'gray' }
    };
    const { label, color } = badges[type] || { label: 'Email', color: 'gray' };
    return <span className={`type-badge ${color}`}>{label}</span>;
  };

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 size={32} className="spin" />
        <p>Loading notifications...</p>
        <style>{pageStyles}</style>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-icon"><Bell size={28} /></div>
        <div className="header-text">
          <h1>Notifications</h1>
          <p>Manage email alerts and view notification history</p>
        </div>
      </div>

      <div className="notifications-grid">
        {/* Email Recipients Panel */}
        <div className="panel recipients-panel">
          <div className="panel-header">
            <Mail size={18} />
            <h2>Email Recipients</h2>
          </div>
          
          <div className="recipients-section">
            {settings.emailList.length === 0 ? (
              <div className="empty-state">
                <Mail size={24} />
                <p>No recipients configured</p>
              </div>
            ) : (
              <div className="email-list">
                {settings.emailList.map(email => (
                  <div key={email} className="email-item">
                    <Mail size={14} className="email-icon" />
                    <span>{email}</span>
                    <button 
                      className="remove-btn"
                      onClick={() => removeEmail(email)}
                      title="Remove"
                      disabled={saving}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="add-email">
            <div className="input-group">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="Add email address..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
            </div>
            <button onClick={addEmail} disabled={!newEmail || saving} className="btn btn-sm btn-primary">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="test-section">
            <button 
              className="btn btn-outline btn-test"
              onClick={testEmail}
              disabled={testing || settings.emailList.length === 0}
            >
              {testing ? (
                <><Loader2 size={16} className="spin" /> Sending...</>
              ) : (
                <><Send size={16} /> Send Test Email</>
              )}
            </button>
            
            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? <Check size={14} /> : <X size={14} />}
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Alert Settings Panel */}
        <div className="panel settings-panel">
          <div className="panel-header">
            <Settings size={18} />
            <h2>Alert Settings</h2>
          </div>
          
          <div className="toggle-group">
            <div className="toggle-item">
              <div className="toggle-info">
                <div className="toggle-icon-wrap blue">
                  <Calendar size={18} />
                </div>
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
                  disabled={saving}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <div className="toggle-icon-wrap purple">
                  <BarChart3 size={18} />
                </div>
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
                  disabled={saving}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <div className="toggle-icon-wrap teal">
                  <Building2 size={18} />
                </div>
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
                  disabled={saving}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <div className="toggle-icon-wrap amber">
                  <Stethoscope size={18} />
                </div>
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
                  disabled={saving}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Email History Panel */}
        <div className="panel history-panel">
          <div className="panel-header">
            <Clock size={18} />
            <h2>Email History</h2>
            <span className="badge">{emailHistory.length}</span>
          </div>

          {emailHistory.length === 0 ? (
            <div className="empty-state">
              <Mail size={24} />
              <p>No emails sent yet</p>
            </div>
          ) : (
            <div className="history-list">
              {emailHistory.map(entry => (
                <div key={entry.id} className="history-item">
                  <div className="history-icon">
                    {getTypeIcon(entry.type)}
                  </div>
                  <div className="history-content">
                    <div className="history-header">
                      {getTypeBadge(entry.type)}
                      <span className="history-date">{formatDate(entry.sentAt)}</span>
                    </div>
                    <div className="history-recipients">
                      <User size={12} />
                      {entry.recipients?.length || 0} recipient(s)
                    </div>
                    {entry.subject && (
                      <div className="history-subject">{entry.subject}</div>
                    )}
                  </div>
                  <div className="history-status">
                    {entry.success ? (
                      <span className="status-success"><Check size={14} /> Sent</span>
                    ) : (
                      <span className="status-error"><AlertTriangle size={14} /> Failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{pageStyles}</style>
    </div>
  );
};

const pageStyles = `
  .notifications-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--color-primary-100), var(--color-primary-50));
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);
  }

  .header-text h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-gray-900);
  }

  .header-text p {
    margin: 0.25rem 0 0;
    color: var(--color-gray-500);
    font-size: 0.875rem;
  }

  .notifications-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .panel {
    background: white;
    border-radius: var(--radius-xl);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-gray-100);
    background: var(--color-gray-50);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .panel-header .badge {
    margin-left: auto;
    background: var(--color-gray-200);
    color: var(--color-gray-600);
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .history-panel {
    grid-column: 1 / -1;
  }

  .recipients-section {
    padding: 1rem 1.25rem;
    min-height: 120px;
  }

  .email-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .email-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    background: var(--color-gray-50);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .email-icon { color: var(--color-gray-400); }

  .email-item span { flex: 1; }

  .remove-btn {
    background: none;
    border: none;
    color: var(--color-gray-400);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .remove-btn:hover {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .add-email {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.25rem 1rem;
  }

  .input-group {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    border: 1px solid var(--color-gray-200);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
  }

  .input-icon { color: var(--color-gray-400); }

  .input-group input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.875rem;
  }

  .test-section {
    padding: 0 1.25rem 1.25rem;
    border-top: 1px solid var(--color-gray-100);
    padding-top: 1rem;
  }

  .btn-test { width: 100%; justify-content: center; }

  .test-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .test-result.success {
    background: var(--color-success-light);
    color: var(--color-success-dark);
  }

  .test-result.error {
    background: var(--color-error-light);
    color: var(--color-error-dark);
  }

  .toggle-group {
    padding: 0.5rem 0;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-gray-50);
  }

  .toggle-item:last-child { border-bottom: none; }

  .toggle-info {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .toggle-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-icon-wrap.blue { background: var(--color-primary-100); color: var(--color-primary); }
  .toggle-icon-wrap.purple { background: #f3e8ff; color: #9333ea; }
  .toggle-icon-wrap.teal { background: #ccfbf1; color: #0d9488; }
  .toggle-icon-wrap.amber { background: var(--color-warning-light); color: #d97706; }

  .toggle-info strong {
    display: block;
    font-size: 0.9375rem;
    color: var(--color-gray-800);
  }

  .toggle-info small {
    display: block;
    font-size: 0.8125rem;
    color: var(--color-gray-500);
    margin-top: 0.125rem;
  }

  /* Toggle Switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .switch input { opacity: 0; width: 0; height: 0; }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: var(--color-gray-300);
    transition: 0.3s;
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
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }

  input:checked + .slider { background-color: var(--color-primary); }
  input:checked + .slider:before { transform: translateX(20px); }
  input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }

  /* History */
  .history-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-gray-50);
    transition: background var(--transition-fast);
  }

  .history-item:hover { background: var(--color-gray-50); }

  .history-icon {
    width: 32px;
    height: 32px;
    background: var(--color-gray-100);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gray-500);
    flex-shrink: 0;
  }

  .history-content { flex: 1; min-width: 0; }

  .history-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 0.375rem;
  }

  .type-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .type-badge.blue { background: var(--color-primary-100); color: var(--color-primary); }
  .type-badge.purple { background: #f3e8ff; color: #9333ea; }
  .type-badge.amber { background: var(--color-warning-light); color: #d97706; }
  .type-badge.teal { background: #ccfbf1; color: #0d9488; }
  .type-badge.gray { background: var(--color-gray-100); color: var(--color-gray-600); }

  .history-date {
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .history-recipients {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-gray-500);
  }

  .history-subject {
    font-size: 0.8125rem;
    color: var(--color-gray-700);
    margin-top: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-status {
    flex-shrink: 0;
  }

  .status-success, .status-error {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-success { color: var(--color-success); }
  .status-error { color: var(--color-error); }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--color-gray-400);
    text-align: center;
  }

  .empty-state svg { margin-bottom: 0.5rem; opacity: 0.5; }
  .empty-state p { margin: 0; font-size: 0.875rem; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-sm { padding: 0.5rem 0.875rem; font-size: 0.8125rem; }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }

  .btn-outline {
    background: white;
    border: 1px solid var(--color-gray-300);
    color: var(--color-gray-700);
  }

  .btn-outline:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .page-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: var(--color-gray-500);
    gap: 1rem;
  }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .notifications-grid {
      grid-template-columns: 1fr;
    }

    .page-header {
      flex-direction: column;
      text-align: center;
      gap: 0.75rem;
    }

    .toggle-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .history-item {
      flex-direction: column;
      gap: 0.75rem;
    }

    .history-status {
      align-self: flex-start;
    }

    .add-email {
      flex-direction: column;
    }

    .btn-test {
      margin-top: 0.5rem;
    }
  }
`;

export default NotificationsPage;