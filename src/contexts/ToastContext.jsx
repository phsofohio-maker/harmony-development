/**
 * ToastContext.jsx - Toast Notification System
 *
 * Provides a useToast() hook for showing toast notifications.
 * Toast types: success (4s), info (4s), warning (6s), error (persistent).
 * Max 3 visible, newest on top, dedup within 1 second.
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

const AUTO_DISMISS_MS = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: null, // persistent
};

const MAX_TOASTS = 3;
const DEDUP_WINDOW_MS = 1000;

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const recentRef = useRef([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type, message) => {
    const now = Date.now();

    // Dedup: skip if same message+type within 1 second
    const isDup = recentRef.current.some(
      r => r.message === message && r.type === type && now - r.time < DEDUP_WINDOW_MS
    );
    if (isDup) return;

    recentRef.current.push({ message, type, time: now });
    // Clean old entries
    recentRef.current = recentRef.current.filter(r => now - r.time < DEDUP_WINDOW_MS * 2);

    const id = ++toastIdCounter;
    const toast = { id, type, message };

    setToasts(prev => {
      const next = [toast, ...prev];
      return next.slice(0, MAX_TOASTS);
    });

    // Auto-dismiss
    const duration = AUTO_DISMISS_MS[type];
    if (duration) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg) => addToast('success', msg),
    info: (msg) => addToast('info', msg),
    warning: (msg) => addToast('warning', msg),
    error: (msg) => addToast('error', msg),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="toast-stack">
          {toasts.map(t => {
            const Icon = TOAST_ICONS[t.type];
            return (
              <div key={t.id} className={`toast toast-${t.type}`}>
                <Icon size={18} className="toast-icon" />
                <span className="toast-message">{t.message}</span>
                <button className="toast-close" onClick={() => removeToast(t.id)}>
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastContext;
