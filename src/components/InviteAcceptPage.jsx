// src/components/InviteAcceptPage.jsx
// Shown when a user visits an invite link (/invite?token=...&org=...)

import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../lib/firebase';

export default function InviteAcceptPage({ token, orgId }) {
  const [mode, setMode] = useState('create'); // 'create' | 'signin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'accepting'
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Authenticate
      let userCredential;
      if (mode === 'create') {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(userCredential.user, { displayName: displayName.trim() });
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      // Step 2: Accept the invite
      setStep('accepting');
      const acceptInvite = httpsCallable(functions, 'acceptInvite');
      await acceptInvite({ token, orgId });

      // Step 3: Force token refresh so new custom claims are active, then reload
      await userCredential.user.getIdToken(true);
      window.location.replace('/');

    } catch (err) {
      setLoading(false);
      setStep('form');
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="invite-overlay">
      <div className="invite-container">
        {/* Header */}
        <div className="invite-header">
          <div className="invite-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1>Harmony</h1>
          <p>You've been invited to join your team</p>
        </div>

        {step === 'accepting' ? (
          <div className="accepting-state">
            <div className="spinner-large" />
            <p>Setting up your account...</p>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="mode-toggle">
              <button
                className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
                onClick={() => { setMode('create'); setError(null); }}
                type="button"
              >
                Create Account
              </button>
              <button
                className={`mode-btn ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => { setMode('signin'); setError(null); }}
                type="button"
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleSubmit} className="invite-form">
              {mode === 'create' && (
                <div className="form-group">
                  <label htmlFor="displayName">Full Name</label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-invited-email@example.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
                <span className="field-hint">Use the email address the invitation was sent to</span>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'create' ? 'Create a password (6+ characters)' : '••••••••'}
                  autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="error-message">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <span className="spinner" />
                ) : mode === 'create' ? (
                  'Create Account & Join'
                ) : (
                  'Sign In & Join'
                )}
              </button>
            </form>
          </>
        )}

        <div className="invite-footer">
          <p>© 2025 Parrish Health Systems</p>
        </div>
      </div>

      <style>{`
        .invite-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
          z-index: 9999;
        }

        .invite-container {
          width: 100%;
          max-width: 420px;
          margin: 1rem;
          padding: 2rem;
          background: white;
          border-radius: var(--radius-xl);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .invite-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .invite-logo {
          width: 60px;
          height: 60px;
          margin: 0 auto 1rem;
          padding: 12px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-500));
          border-radius: var(--radius-xl);
          color: white;
        }

        .invite-header h1 {
          margin: 0;
          font-size: 1.75rem;
          color: var(--color-gray-800);
        }

        .invite-header p {
          margin: 0.25rem 0 0;
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
        }

        .mode-toggle {
          display: flex;
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
          overflow: hidden;
          margin-bottom: 1.5rem;
        }

        .mode-btn {
          flex: 1;
          padding: 0.625rem;
          background: none;
          border: none;
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-gray-500);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }

        .mode-btn.active {
          background: var(--color-primary);
          color: white;
        }

        .invite-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .form-group label {
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-gray-700);
        }

        .form-group input {
          padding: 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-base);
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-group input:disabled {
          background: var(--color-gray-100);
          cursor: not-allowed;
        }

        .field-hint {
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-size: var(--font-size-base);
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
          min-height: 44px;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .btn-primary:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--color-error-light);
          border: 1px solid #fecaca;
          border-radius: var(--radius-lg);
          color: #dc2626;
          font-size: var(--font-size-sm);
        }

        .error-message svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .accepting-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem 0;
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
        }

        .spinner-large {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-gray-200);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .invite-footer {
          margin-top: 2rem;
          text-align: center;
        }

        .invite-footer p {
          margin: 0;
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
        }
      `}</style>
    </div>
  );
}

function getErrorMessage(err) {
  const authMessages = {
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with this email. Try creating an account instead.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
  };

  if (err.code && authMessages[err.code]) return authMessages[err.code];

  const msg = err.message || '';
  if (msg.includes('already been used')) return 'This invitation has already been accepted.';
  if (msg.includes('expired') || msg.includes('deadline-exceeded')) return 'This invitation has expired. Ask an admin to send a new one.';
  if (msg.includes('Invalid or expired')) return 'Invalid invitation link. It may have expired or already been used.';
  if (msg.includes('email address the invitation')) return 'Please use the email address this invitation was sent to.';

  return 'Something went wrong. Please try again or contact your administrator.';
}
