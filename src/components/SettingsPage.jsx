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
import PhysicianDirectory from './PhysicianDirectory';
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
  Database,
  Stethoscope,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';

const SettingsPage = () => {
  const { user, userProfile } = useAuth();
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
    },
    // Agency info (new v1.2.0 fields)
    agencyName: '',
    providerNumber: '',
    npi: '',
    phone: '',
    fax: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    defaultLevelOfCare: 'Routine',
    // Compliance thresholds
    compliance: {
      certPeriodDays: 60,
      f2fWindowDays: 30,
      huvWindowDays: 5,
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Email input state
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState(null);

  // Document templates state
  const [docTemplates, setDocTemplates] = useState({
    'CTI': '',
    'ATTEND_CTI': '',
    'PROGRESS_NOTE': '',
    'PHYSICIAN_HP': '',
    'HOME_VISIT_ASSESSMENT': '',
  });

  // Temp Drive folder ID for document generation
  const [tempFolderId, setTempFolderId] = useState('');

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
          },
          agencyName: data.agencyName || '',
          providerNumber: data.providerNumber || '',
          npi: data.npi || '',
          phone: data.phone || '',
          fax: data.fax || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          defaultLevelOfCare: data.defaultLevelOfCare || 'Routine',
          compliance: {
            certPeriodDays: data.compliance?.certPeriodDays ?? 60,
            f2fWindowDays: data.compliance?.f2fWindowDays ?? 30,
            huvWindowDays: data.compliance?.huvWindowDays ?? 5,
          },
        });

        // Load document templates
        const templates = data.settings?.documentTemplates || {};
        setDocTemplates(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(templates).map(([key, id]) => [
              key,
              id ? `https://docs.google.com/document/d/${id}` : ''
            ])
          ),
        }));

        // Load temp Drive folder ID
        setTempFolderId(data.settings?.tempDriveFolderId || '');
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
        agencyName: settings.agencyName,
        providerNumber: settings.providerNumber,
        npi: settings.npi,
        phone: settings.phone,
        fax: settings.fax,
        address: settings.address,
        city: settings.city,
        state: settings.state,
        zip: settings.zip,
        defaultLevelOfCare: settings.defaultLevelOfCare,
        compliance: settings.compliance,
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

  // Document template types
  const DOCUMENT_TYPES = [
    { id: 'CTI', label: 'CTI Narrative', description: 'Certification narrative (all benefit periods)' },
    { id: 'ATTEND_CTI', label: 'Attending Physician CTI', description: 'Attending physician certification statement' },
    { id: 'PROGRESS_NOTE', label: 'Progress Note', description: 'Standard clinical progress note' },
    { id: 'PHYSICIAN_HP', label: 'Physician H&P', description: 'Physician history and physical' },
    { id: 'HOME_VISIT_ASSESSMENT', label: 'Home Visit Assessment', description: 'Comprehensive home visit form' },
  ];

  const isValidGoogleDocUrl = (url) => {
    if (!url) return true;
    return /^https:\/\/docs\.google\.com\/document\/d\/[\w-]+/.test(url);
  };

  const saveDocTemplates = async () => {
    setSaving(true);
    try {
      const templateIds = {};
      for (const [key, url] of Object.entries(docTemplates)) {
        if (url) {
          const match = url.match(/\/document\/d\/([\w-]+)/);
          templateIds[key] = match ? match[1] : url;
        } else {
          templateIds[key] = '';
        }
      }
      await updateDoc(doc(db, 'organizations', orgId), {
        'settings.documentTemplates': templateIds,
        'settings.tempDriveFolderId': tempFolderId.trim() || '',
        updatedAt: serverTimestamp(),
      });
      setSaveMessage({ type: 'success', text: 'Document templates saved!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error saving templates:', err);
      setSaveMessage({ type: 'error', text: 'Failed to save templates.' });
    } finally {
      setSaving(false);
    }
  };

  // User role for permissions
  const userRole = user?.customClaims?.role || userProfile?.role || 'viewer';

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'physicians', label: 'Physicians', icon: Stethoscope },
    { id: 'documents', label: 'Documents', icon: FileText },
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

              <div className="form-group">
                <label htmlFor="levelOfCare">Default Level of Care</label>
                <select
                  id="levelOfCare"
                  value={settings.defaultLevelOfCare}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultLevelOfCare: e.target.value }))}
                  style={{ width: '200px', padding: '0.625rem 0.875rem', border: '1px solid var(--color-gray-300)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}
                >
                  <option value="Routine">Routine</option>
                  <option value="Continuous">Continuous</option>
                  <option value="Respite">Respite</option>
                  <option value="General Inpatient">General Inpatient</option>
                </select>
              </div>
            </div>

            {/* Agency / Provider Info */}
            <div className="section-card">
              <h2>Agency / Provider Information</h2>
              <p className="section-desc">
                This information appears on generated documents and regulatory filings
              </p>

              <div className="form-group">
                <label htmlFor="agencyName">Agency Name</label>
                <input
                  id="agencyName"
                  type="text"
                  value={settings.agencyName}
                  onChange={(e) => setSettings(prev => ({ ...prev, agencyName: e.target.value }))}
                  placeholder="Legal agency name"
                />
              </div>

              <div className="form-row-settings">
                <div className="form-group">
                  <label htmlFor="providerNumber">Provider Number</label>
                  <input
                    id="providerNumber"
                    type="text"
                    value={settings.providerNumber}
                    onChange={(e) => setSettings(prev => ({ ...prev, providerNumber: e.target.value }))}
                    placeholder="CMS Provider #"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="orgNpi">Organization NPI</label>
                  <input
                    id="orgNpi"
                    type="text"
                    value={settings.npi}
                    onChange={(e) => setSettings(prev => ({ ...prev, npi: e.target.value }))}
                    placeholder="NPI #"
                  />
                </div>
              </div>

              <div className="form-row-settings">
                <div className="form-group">
                  <label htmlFor="orgPhone">Phone</label>
                  <input
                    id="orgPhone"
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="orgFax">Fax</label>
                  <input
                    id="orgFax"
                    type="text"
                    value={settings.fax}
                    onChange={(e) => setSettings(prev => ({ ...prev, fax: e.target.value }))}
                    placeholder="(555) 555-5556"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="orgAddress">Address</label>
                <input
                  id="orgAddress"
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                />
              </div>

              <div className="form-row-settings triple">
                <div className="form-group">
                  <label htmlFor="orgCity">City</label>
                  <input
                    id="orgCity"
                    type="text"
                    value={settings.city}
                    onChange={(e) => setSettings(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="orgState">State</label>
                  <input
                    id="orgState"
                    type="text"
                    value={settings.state}
                    onChange={(e) => setSettings(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="OH"
                    maxLength={2}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="orgZip">ZIP</label>
                  <input
                    id="orgZip"
                    type="text"
                    value={settings.zip}
                    onChange={(e) => setSettings(prev => ({ ...prev, zip: e.target.value }))}
                    placeholder="45000"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>

            {/* Compliance Thresholds */}
            <div className="section-card">
              <h2>Compliance Thresholds</h2>
              <p className="section-desc">
                Configure deadlines and window periods for compliance tracking
              </p>

              <div className="form-row-settings triple">
                <div className="form-group">
                  <label htmlFor="certPeriodDays">Cert Period (days)</label>
                  <input
                    id="certPeriodDays"
                    type="number"
                    min="30"
                    max="90"
                    value={settings.compliance.certPeriodDays}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      compliance: { ...prev.compliance, certPeriodDays: parseInt(e.target.value) || 60 }
                    }))}
                  />
                  <span className="form-hint">Default: 60 days</span>
                </div>
                <div className="form-group">
                  <label htmlFor="f2fWindowDays">F2F Window (days)</label>
                  <input
                    id="f2fWindowDays"
                    type="number"
                    min="7"
                    max="60"
                    value={settings.compliance.f2fWindowDays}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      compliance: { ...prev.compliance, f2fWindowDays: parseInt(e.target.value) || 30 }
                    }))}
                  />
                  <span className="form-hint">Default: 30 days</span>
                </div>
                <div className="form-group">
                  <label htmlFor="huvWindowDays">HUV Window (days)</label>
                  <input
                    id="huvWindowDays"
                    type="number"
                    min="1"
                    max="14"
                    value={settings.compliance.huvWindowDays}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      compliance: { ...prev.compliance, huvWindowDays: parseInt(e.target.value) || 5 }
                    }))}
                  />
                  <span className="form-hint">Default: 5 days</span>
                </div>
              </div>
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
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <BrandingSettings />
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <TeamManagement />
        )}

        {/* Physicians Tab */}
        {activeTab === 'physicians' && (
          <PhysicianDirectory />
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="settings-section">
            <div className="section-card">
              <h2>Document Templates</h2>
              <p className="section-desc">
                Link Google Docs templates for each document type. The system will copy these
                templates and replace placeholders with patient/assessment data during generation.
              </p>

              {userRole !== 'admin' && userRole !== 'owner' ? (
                <div className="info-box">
                  <AlertCircle size={16} />
                  Only administrators can manage document templates.
                </div>
              ) : (
                <div className="template-list">
                  {DOCUMENT_TYPES.map(docType => (
                    <div key={docType.id} className="template-row">
                      <div className="template-info">
                        <span className="template-name">{docType.label}</span>
                        <span className="template-desc">{docType.description}</span>
                      </div>
                      <div className="template-input-row">
                        <input
                          type="url"
                          value={docTemplates[docType.id] || ''}
                          onChange={(e) => setDocTemplates(prev => ({
                            ...prev,
                            [docType.id]: e.target.value
                          }))}
                          placeholder="https://docs.google.com/document/d/..."
                          className={`template-input ${
                            docTemplates[docType.id] && !isValidGoogleDocUrl(docTemplates[docType.id])
                              ? 'invalid' : ''
                          }`}
                        />
                        {docTemplates[docType.id] && (
                          <a
                            href={docTemplates[docType.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-icon"
                            title="Open template in new tab"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                      {docTemplates[docType.id] && !isValidGoogleDocUrl(docTemplates[docType.id]) && (
                        <span className="field-error">
                          <AlertCircle size={14} />
                          Enter a valid Google Docs URL
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(userRole === 'admin' || userRole === 'owner') && (
              <div className="section-card" style={{ marginTop: '1.5rem' }}>
                <h3>Drive Storage</h3>
                <p className="section-desc">
                  Temp Drive Folder ID — the shared Google Drive folder where temporary document copies
                  are created during generation. This prevents quota issues on the service account.
                </p>
                <div className="template-row">
                  <div className="template-info">
                    <span className="template-name">Temp Drive Folder ID</span>
                    <span className="template-desc">Folder owned by notifications@ with Editor access for the service account</span>
                  </div>
                  <div className="template-input-row">
                    <input
                      type="text"
                      value={tempFolderId}
                      onChange={(e) => setTempFolderId(e.target.value)}
                      placeholder="e.g. 1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                      className="template-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {(userRole === 'admin' || userRole === 'owner') && (
              <div className="form-actions">
                <button className="btn-primary" onClick={saveDocTemplates} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Templates
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
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

  /* Settings form rows */
  .form-row-settings {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-row-settings.triple {
    grid-template-columns: 1fr 1fr 1fr;
  }

  /* Document Templates */
  .template-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .template-row {
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--color-gray-100);
  }

  .template-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .template-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-bottom: 0.5rem;
  }

  .template-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-gray-900);
  }

  .template-desc {
    font-size: var(--font-size-xs);
    color: var(--color-gray-500);
  }

  .template-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .template-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: inherit;
  }

  .template-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  .template-input.invalid {
    border-color: var(--color-error);
  }

  .template-input.invalid:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    color: var(--color-gray-500);
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .btn-icon:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .info-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-dark, #1e40af);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  @media (max-width: 640px) {
    .form-row-settings,
    .form-row-settings.triple {
      grid-template-columns: 1fr;
    }
  }
`;

export default SettingsPage;