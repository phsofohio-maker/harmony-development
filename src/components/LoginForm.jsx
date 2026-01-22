// Artifact ID: login-component
// Branch: 1 (main) (019b4c98...)
// Version: 1
// Command: create
// UUID: 16af523a-3fd4-404f-a29d-2911a1e6982c
// Created: 12/23/2025, 11:14:26 AM
// Change: Created

// ---

// src/components/LoginForm.jsx
// Full-screen login overlay that blocks access until authenticated

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginForm() {
  const { signIn, resetPassword, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    clearError();
    
    try {
      await signIn(email, password);
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    clearError();
    
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-container">
        {/* Logo/Header */}
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1>Harmony</h1>
          <p>Health Care Assistant</p>
        </div>

        {/* Login Form */}
        {!showReset ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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
              ) : (
                'Sign In'
              )}
            </button>

            <button
              type="button"
              className="btn-link"
              onClick={() => { setShowReset(true); clearError(); }}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          /* Password Reset Form */
          <form onSubmit={handlePasswordReset} className="login-form">
            {resetSent ? (
              <div className="success-message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p>Password reset email sent! Check your inbox.</p>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => { setShowReset(false); setResetSent(false); }}
                >
                  Back to login
                </button>
              </div>
            ) : (
              <>
                <p className="reset-instructions">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                
                <div className="form-group">
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@organization.com"
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
                  {loading ? <span className="spinner" /> : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  className="btn-link"
                  onClick={() => { setShowReset(false); clearError(); }}
                >
                  Back to login
                </button>
              </>
            )}
          </form>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p>© 2025 Parrish Health Systems</p>
        </div>
      </div>

      <style>{`
        .login-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
          z-index: 9999;
        }

        .login-container {
          width: 100%;
          max-width: 400px;
          margin: 1rem;
          padding: 2rem;
          background: white;
          border-radius: var(--radius-xl);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-logo {
          width: 60px;
          height: 60px;
          margin: 0 auto 1rem;
          padding: 12px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-500));
          border-radius: var(--radius-xl);
          color: white;
        }

        .login-header h1 {
          margin: 0;
          font-size: 1.75rem;
          color: var(--color-gray-800);
        }

        .login-header p {
          margin: 0.25rem 0 0;
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
        }

        .login-form {
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

        .btn-link {
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: var(--font-size-sm);
          cursor: pointer;
          padding: 0.5rem;
        }

        .btn-link:hover {
          text-decoration: underline;
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

        .success-message {
          text-align: center;
          padding: 1rem;
        }

        .success-message svg {
          width: 48px;
          height: 48px;
          margin: 0 auto 1rem;
          color: var(--color-success);
        }

        .reset-instructions {
          color: var(--color-gray-500);
          font-size: var(--font-size-sm);
          margin-bottom: 0.5rem;
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

        .login-footer {
          margin-top: 2rem;
          text-align: center;
        }

        .login-footer p {
          margin: 0;
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
        }
      `}</style>
    </div>
  );
}