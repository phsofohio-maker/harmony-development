/**
 * OnboardingWizard.jsx - New Organization Setup Wizard
 * 
 * Multi-step setup for org admins:
 * 1. Welcome / Org name confirmation
 * 2. Branding (logo + color)
 * 3. Invite team members
 * 4. Completion
 * 
 * USAGE:
 *   <OnboardingWizard 
 *     orgId="org_example"
 *     userId={user.uid}
 *     onComplete={() => setShowWizard(false)}
 *   />
 */

import { useState, useRef } from 'react';
import { doc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { COLOR_PRESETS } from '../contexts/ThemeContext';
import {
  Building2,
  Palette,
  Users,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  Plus,
  Mail,
  Loader2,
  Sparkles,
  AlertCircle
} from 'lucide-react';

const OnboardingWizard = ({ orgId, userId, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [orgName, setOrgName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2563eb');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [teamEmails, setTeamEmails] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState(null);

  const fileInputRef = useRef(null);

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: Sparkles },
    { id: 'branding', title: 'Branding', icon: Palette },
    { id: 'team', title: 'Team', icon: Users },
    { id: 'complete', title: 'Complete', icon: CheckCircle },
  ];

  // File handling
  const handleFileSelect = (file) => {
    if (!file) return;

    const maxSize = 500 * 1024;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

    if (file.size > maxSize) {
      setError('Logo must be under 500KB');
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, SVG, or WebP file');
      return;
    }

    setLogoFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  // Email handling
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    
    if (!email) return;
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (teamEmails.includes(email)) {
      setEmailError('This email is already added');
      return;
    }

    if (teamEmails.length >= 10) {
      setEmailError('Maximum 10 team members during setup');
      return;
    }

    setTeamEmails([...teamEmails, email]);
    setEmailInput('');
    setEmailError(null);
  };

  const removeEmail = (email) => {
    setTeamEmails(teamEmails.filter(e => e !== email));
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0: return orgName.trim().length >= 2;
      case 1: return true; // Branding is optional
      case 2: return true; // Team invites are optional
      default: return true;
    }
  };

  const nextStep = async () => {
    if (currentStep === steps.length - 2) {
      // Before showing completion, save everything
      await saveOnboarding();
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Save all onboarding data
  const saveOnboarding = async () => {
    setSaving(true);
    setError(null);

    try {
      let logoUrl = null;

      // Upload logo if provided
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const logoRef = ref(storage, `organizations/${orgId}/assets/logo.${ext}`);
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
      }

      // Update organization
      await updateDoc(doc(db, 'organizations', orgId), {
        name: orgName.trim(),
        branding: {
          primaryColor: selectedColor,
          logoUrl: logoUrl,
        },
        onboardingCompleted: true,
        onboardingCompletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Create pending invitations
      if (teamEmails.length > 0) {
        const invitesRef = collection(db, 'organizations', orgId, 'pendingInvites');
        
        for (const email of teamEmails) {
          await addDoc(invitesRef, {
            email: email,
            role: 'staff',
            invitedBy: userId,
            invitedAt: Timestamp.now(),
            status: 'pending',
          });
        }
      }

      // Mark user onboarding complete
      await updateDoc(doc(db, 'users', userId), {
        onboardingCompleted: true,
        onboardingCompletedAt: Timestamp.now(),
      });

      setCurrentStep(steps.length - 1); // Go to completion step
    } catch (err) {
      console.error('Error saving onboarding:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = () => {
    onComplete?.();
  };

  // Get color name for summary
  const selectedPreset = COLOR_PRESETS.find(p => p.value === selectedColor);
  const colorName = selectedPreset?.name || 'Custom';

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        {/* Progress Header */}
        <div className="wizard-header">
          <div className="steps-indicator">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              
              return (
                <div key={step.id} className="step-item">
                  <div className={`step-icon ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}>
                    {isComplete ? <CheckCircle size={16} /> : <StepIcon size={16} />}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`step-line ${isComplete ? 'complete' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="step-title">{steps[currentStep].title}</div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Step Content */}
        <div className="wizard-content">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="step-welcome">
              <div className="welcome-icon">
                <Building2 size={40} strokeWidth={1.5} />
              </div>
              <h2>Let's set up your organization</h2>
              <p>We'll customize Harmony for your team in just a few steps.</p>
              
              <div className="form-group">
                <label htmlFor="orgName">Organization Name</label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., Sunrise Hospice Care"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 1: Branding */}
          {currentStep === 1 && (
            <div className="step-branding">
              <h2>Make it yours</h2>
              <p>Add your logo and pick a brand color. You can change these later in Settings.</p>

              {/* Logo Upload */}
              <div className="branding-section">
                <label>Logo (optional)</label>
                {logoPreview ? (
                  <div className="logo-preview">
                    <img src={logoPreview} alt="Logo preview" />
                    <button className="remove-logo" onClick={removeLogo}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button 
                    className="upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={20} />
                    <span>Upload Logo</span>
                    <span className="upload-hint">PNG, JPG, SVG · Max 500KB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Color Selection */}
              <div className="branding-section">
                <label>Brand Color</label>
                <div className="color-grid">
                  {COLOR_PRESETS.slice(0, 12).map((preset) => (
                    <button
                      key={preset.value}
                      className={`color-btn ${selectedColor === preset.value ? 'selected' : ''}`}
                      style={{ background: preset.value }}
                      onClick={() => setSelectedColor(preset.value)}
                      title={preset.name}
                    >
                      {selectedColor === preset.value && <CheckCircle size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini Preview */}
              <div className="mini-preview">
                <div 
                  className="preview-sidebar"
                  style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${selectedColor} 80%, #000 40%) 0%, color-mix(in srgb, ${selectedColor} 80%, #000 25%) 100%)` }}
                >
                  {logoPreview && <img src={logoPreview} alt="" className="preview-logo" />}
                  <span>{orgName || 'Your Org'}</span>
                </div>
                <div className="preview-btn" style={{ background: selectedColor }}>
                  Button
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team */}
          {currentStep === 2 && (
            <div className="step-team">
              <h2>Invite your team</h2>
              <p>Add team members who will use Harmony. They'll receive an email invitation. You can skip this and invite people later.</p>

              <div className="email-input-row">
                <div className="email-input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                    placeholder="colleague@example.com"
                  />
                </div>
                <button className="add-btn" onClick={addEmail}>
                  <Plus size={16} />
                </button>
              </div>

              {emailError && (
                <div className="field-error">
                  <AlertCircle size={14} />
                  {emailError}
                </div>
              )}

              {teamEmails.length > 0 ? (
                <div className="email-list">
                  {teamEmails.map(email => (
                    <div key={email} className="email-chip">
                      <span>{email}</span>
                      <button onClick={() => removeEmail(email)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-team">
                  <Users size={24} />
                  <span>No team members added yet</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <div className="step-complete">
              <div className="complete-icon">
                <CheckCircle size={48} strokeWidth={1.5} />
              </div>
              <h2>You're all set!</h2>
              <p><strong>{orgName}</strong> is ready to go.</p>
              
              <div className="summary">
                {logoPreview && (
                  <div className="summary-item">
                    <CheckCircle size={16} />
                    <span>Logo uploaded</span>
                  </div>
                )}
                <div className="summary-item">
                  <CheckCircle size={16} />
                  <span>Brand color: {colorName}</span>
                </div>
                {teamEmails.length > 0 && (
                  <div className="summary-item">
                    <CheckCircle size={16} />
                    <span>{teamEmails.length} team invite{teamEmails.length > 1 ? 's' : ''} sent</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="wizard-nav">
          {currentStep > 0 && currentStep < steps.length - 1 ? (
            <button className="nav-btn secondary" onClick={prevStep}>
              <ChevronLeft size={18} />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < steps.length - 1 ? (
            <button 
              className="nav-btn primary" 
              onClick={nextStep}
              disabled={!canProceed() || saving}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Saving...
                </>
              ) : (
                <>
                  {currentStep === steps.length - 2 ? 'Finish Setup' : 'Continue'}
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          ) : (
            <button className="nav-btn primary" onClick={finishOnboarding}>
              Go to Dashboard
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        .wizard-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        .wizard-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        /* Header */
        .wizard-header {
          padding: 1.5rem 1.5rem 1rem;
          border-bottom: 1px solid var(--color-gray-100);
        }

        .steps-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 0.75rem;
        }

        .step-item {
          display: flex;
          align-items: center;
        }

        .step-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-gray-100);
          color: var(--color-gray-400);
          transition: all var(--transition-fast);
        }

        .step-icon.active {
          background: var(--color-primary);
          color: white;
        }

        .step-icon.complete {
          background: var(--color-success);
          color: white;
        }

        .step-line {
          width: 40px;
          height: 2px;
          background: var(--color-gray-200);
          margin: 0 0.25rem;
        }

        .step-line.complete {
          background: var(--color-success);
        }

        .step-title {
          text-align: center;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-600);
        }

        /* Error Banner */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 1rem 1.5rem 0;
          background: var(--color-error-light);
          color: var(--color-error-dark);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
        }

        .error-banner button {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
        }

        /* Content */
        .wizard-content {
          padding: 1.5rem;
        }

        .wizard-content h2 {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
          font-weight: var(--font-weight-semibold);
          color: var(--color-gray-900);
        }

        .wizard-content p {
          margin: 0 0 1.5rem;
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
          line-height: 1.5;
        }

        /* Welcome Step */
        .step-welcome {
          text-align: center;
        }

        .welcome-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: var(--color-primary-50);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
        }

        .step-welcome .form-group {
          text-align: left;
          margin-top: 1.5rem;
        }

        /* Form Elements */
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-700);
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-base);
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-100);
        }

        /* Branding Step */
        .branding-section {
          margin-bottom: 1.5rem;
        }

        .branding-section label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-700);
        }

        .upload-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          width: 100%;
          padding: 1.5rem;
          border: 2px dashed var(--color-gray-300);
          border-radius: var(--radius-lg);
          background: var(--color-gray-50);
          color: var(--color-gray-500);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .upload-btn:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-50);
        }

        .upload-hint {
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
        }

        .logo-preview {
          position: relative;
          display: inline-block;
        }

        .logo-preview img {
          width: 80px;
          height: 80px;
          object-fit: contain;
          border-radius: var(--radius-lg);
          background: var(--color-gray-50);
          padding: 0.5rem;
        }

        .remove-logo {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--color-error);
          color: white;
          border: 2px solid white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .color-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0.5rem;
        }

        .color-btn {
          aspect-ratio: 1;
          border: 2px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all var(--transition-fast);
          min-height: 32px;
        }

        .color-btn:hover {
          transform: scale(1.1);
        }

        .color-btn.selected {
          border-color: var(--color-gray-900);
          box-shadow: 0 0 0 2px white;
          transform: scale(1.05);
        }

        .mini-preview {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--color-gray-100);
          border-radius: var(--radius-lg);
        }

        .preview-sidebar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-md);
          color: white;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
        }

        .preview-logo {
          width: 20px;
          height: 20px;
          object-fit: contain;
          border-radius: 4px;
        }

        .preview-btn {
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-md);
          color: white;
          font-size: var(--font-size-xs);
        }

        /* Team Step */
        .email-input-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .email-input-wrapper {
          flex: 1;
          position: relative;
        }

        .email-input-wrapper .input-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-gray-400);
        }

        .email-input-wrapper input {
          width: 100%;
          padding: 0.75rem 0.875rem 0.75rem 2.5rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-lg);
        }

        .email-input-wrapper input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-100);
        }

        .add-btn {
          padding: 0 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
        }

        .add-btn:hover {
          background: var(--color-primary-hover);
        }

        .field-error {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: var(--color-error);
          font-size: var(--font-size-sm);
          margin-bottom: 1rem;
        }

        .email-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .email-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.5rem 0.375rem 0.75rem;
          background: var(--color-gray-100);
          border-radius: var(--radius-full);
          font-size: var(--font-size-sm);
        }

        .email-chip button {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-gray-300);
          border: none;
          color: var(--color-gray-600);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .email-chip button:hover {
          background: var(--color-error);
          color: white;
        }

        .empty-team {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 2rem;
          color: var(--color-gray-400);
          background: var(--color-gray-50);
          border-radius: var(--radius-lg);
        }

        /* Complete Step */
        .step-complete {
          text-align: center;
        }

        .complete-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--color-success-light);
          color: var(--color-success);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
        }

        .summary {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1.5rem;
          padding: 1rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-lg);
        }

        .summary-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
          color: var(--color-gray-700);
        }

        .summary-item svg {
          color: var(--color-success);
        }

        /* Navigation */
        .wizard-nav {
          display: flex;
          justify-content: space-between;
          padding: 1rem 1.5rem 1.5rem;
          border-top: 1px solid var(--color-gray-100);
        }

        .nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.75rem 1.25rem;
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .nav-btn.primary {
          background: var(--color-primary);
          color: white;
          border: none;
        }

        .nav-btn.primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .nav-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nav-btn.secondary {
          background: white;
          color: var(--color-gray-600);
          border: 1px solid var(--color-gray-200);
        }

        .nav-btn.secondary:hover {
          background: var(--color-gray-50);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default OnboardingWizard;