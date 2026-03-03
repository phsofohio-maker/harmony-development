/**
 * PhysicianDirectory.jsx - Organization Physician Directory Management
 *
 * CRUD interface for managing the organization's physician directory.
 * Used in the Settings page under a "Physicians" tab.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getPhysicians,
  addPhysician,
  updatePhysician,
  removePhysician,
  PHYSICIAN_DEFAULTS,
} from '../services/organizationService';

const ROLES = [
  { value: 'attending', label: 'Attending' },
  { value: 'hospice', label: 'Hospice' },
  { value: 'f2f', label: 'F2F Provider' },
];

const PhysicianDirectory = () => {
  const { user } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';

  const [physicians, setPhysicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ ...PHYSICIAN_DEFAULTS });
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState(null);

  const loadPhysicians = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPhysicians(orgId);
      setPhysicians(data);
    } catch (err) {
      console.error('Error loading physicians:', err);
      setMessage({ type: 'error', text: 'Failed to load physician directory.' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadPhysicians(); }, [loadPhysicians]);

  const handleAdd = async () => {
    if (!draft.name.trim()) {
      setMessage({ type: 'error', text: 'Physician name is required.' });
      return;
    }
    try {
      setSaving(true);
      const updated = await addPhysician(orgId, draft);
      setPhysicians(updated);
      setDraft({ ...PHYSICIAN_DEFAULTS });
      setShowAdd(false);
      setMessage({ type: 'success', text: 'Physician added.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!draft.name.trim()) return;
    try {
      setSaving(true);
      const updated = await updatePhysician(orgId, editingId, draft);
      setPhysicians(updated);
      setEditingId(null);
      setDraft({ ...PHYSICIAN_DEFAULTS });
      setMessage({ type: 'success', text: 'Physician updated.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this physician from the directory?')) return;
    try {
      const updated = await removePhysician(orgId, id);
      setPhysicians(updated);
      setMessage({ type: 'success', text: 'Physician removed.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setDraft({ ...PHYSICIAN_DEFAULTS, ...p });
    setShowAdd(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ ...PHYSICIAN_DEFAULTS });
    setShowAdd(false);
  };

  if (loading) {
    return <div className="pd-loading">Loading physician directory...</div>;
  }

  return (
    <div className="pd-container">
      {/* Message */}
      {message && (
        <div className={`pd-msg ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="pd-header">
        <div>
          <h2>Physician Directory</h2>
          <p className="pd-desc">Manage physicians associated with your organization</p>
        </div>
        <button className="pd-btn primary" onClick={() => { setShowAdd(true); setEditingId(null); setDraft({ ...PHYSICIAN_DEFAULTS }); }}>
          + Add Physician
        </button>
      </div>

      {/* Add / Edit Form */}
      {(showAdd || editingId) && (
        <div className="pd-form-card">
          <h3>{editingId ? 'Edit Physician' : 'Add Physician'}</h3>
          <div className="pd-form-grid">
            <div className="pd-field">
              <label>Name *</label>
              <input type="text" value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Dr. Name" />
            </div>
            <div className="pd-field">
              <label>NPI</label>
              <input type="text" value={draft.npi} onChange={e => setDraft(p => ({ ...p, npi: e.target.value }))} placeholder="NPI #" />
            </div>
            <div className="pd-field">
              <label>Role</label>
              <select value={draft.role} onChange={e => setDraft(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="pd-field">
              <label>Phone</label>
              <input type="text" value={draft.phone} onChange={e => setDraft(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
            </div>
            <div className="pd-field">
              <label>Fax</label>
              <input type="text" value={draft.fax} onChange={e => setDraft(p => ({ ...p, fax: e.target.value }))} placeholder="Fax" />
            </div>
            <div className="pd-field">
              <label>Email</label>
              <input type="text" value={draft.email} onChange={e => setDraft(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
            </div>
            <div className="pd-field full">
              <label>Address</label>
              <input type="text" value={draft.address} onChange={e => setDraft(p => ({ ...p, address: e.target.value }))} placeholder="Address" />
            </div>
            <div className="pd-field">
              <label className="pd-check-label">
                <input type="checkbox" checked={draft.isActive} onChange={e => setDraft(p => ({ ...p, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
          </div>
          <div className="pd-form-actions">
            <button className="pd-btn secondary" onClick={cancelEdit}>Cancel</button>
            <button className="pd-btn primary" onClick={editingId ? handleUpdate : handleAdd} disabled={saving}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Physician')}
            </button>
          </div>
        </div>
      )}

      {/* Directory Table */}
      {physicians.length === 0 ? (
        <div className="pd-empty">
          No physicians in the directory yet. Click "Add Physician" to get started.
        </div>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>NPI</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {physicians.map(p => (
                <tr key={p.id} className={!p.isActive ? 'pd-inactive' : ''}>
                  <td className="pd-name">{p.name}</td>
                  <td>{p.npi || '—'}</td>
                  <td>
                    <span className={`pd-role-badge role-${p.role}`}>
                      {ROLES.find(r => r.value === p.role)?.label || p.role}
                    </span>
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td>
                    <span className={`pd-status ${p.isActive ? 'active' : 'inactive'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="pd-actions">
                      <button className="pd-action-btn" onClick={() => startEdit(p)} title="Edit">Edit</button>
                      <button className="pd-action-btn danger" onClick={() => handleRemove(p.id)} title="Remove">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .pd-container { }
        .pd-loading { padding: 2rem; text-align: center; color: var(--color-gray-500); }

        .pd-msg {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.75rem 1rem; border-radius: var(--radius-lg);
          font-size: var(--font-size-sm); margin-bottom: 1rem;
        }
        .pd-msg.success { background: var(--color-success-light); color: var(--color-success-dark); }
        .pd-msg.error { background: var(--color-error-light); color: var(--color-error-dark); }
        .pd-msg button { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: inherit; }

        .pd-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 1.25rem;
        }
        .pd-header h2 { margin: 0; font-size: var(--font-size-lg); color: var(--color-gray-900); }
        .pd-desc { margin: 0.25rem 0 0; font-size: var(--font-size-sm); color: var(--color-gray-500); }

        .pd-btn {
          padding: 0.5rem 1rem; border-radius: var(--radius-md);
          font-size: var(--font-size-sm); font-weight: 500;
          cursor: pointer; border: none;
        }
        .pd-btn.primary { background: var(--color-primary); color: white; }
        .pd-btn.primary:hover { background: var(--color-primary-hover); }
        .pd-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .pd-btn.secondary { background: var(--color-gray-100); color: var(--color-gray-700); border: 1px solid var(--border-color); }

        /* Form */
        .pd-form-card {
          background: white; border: 1px solid var(--border-color);
          border-radius: var(--radius-xl); padding: 1.25rem;
          margin-bottom: 1rem;
        }
        .pd-form-card h3 { margin: 0 0 1rem; font-size: var(--font-size-base); }
        .pd-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
        .pd-field { display: flex; flex-direction: column; }
        .pd-field.full { grid-column: 1 / -1; }
        .pd-field label { font-size: 0.8125rem; font-weight: 500; margin-bottom: 0.25rem; color: var(--color-gray-700); }
        .pd-field input, .pd-field select {
          padding: 0.5rem 0.75rem; border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md); font-size: 0.875rem;
        }
        .pd-field input:focus, .pd-field select:focus {
          outline: none; border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .pd-check-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .pd-form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-gray-100); }

        /* Table */
        .pd-table-wrap {
          background: white; border: 1px solid var(--border-color);
          border-radius: var(--radius-xl); overflow: hidden;
        }
        .pd-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
        .pd-table th {
          text-align: left; padding: 0.75rem 1rem;
          font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.5px; color: var(--color-gray-500);
          background: var(--color-gray-50); border-bottom: 2px solid var(--border-color);
        }
        .pd-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-gray-100); }
        .pd-table tr:hover { background: var(--color-gray-50); }
        .pd-inactive { opacity: 0.5; }
        .pd-name { font-weight: 500; }

        .pd-role-badge {
          padding: 0.125rem 0.5rem; border-radius: var(--radius-sm);
          font-size: var(--font-size-xs); font-weight: 500;
        }
        .pd-role-badge.role-attending { background: #dbeafe; color: #1e40af; }
        .pd-role-badge.role-hospice { background: #ede9fe; color: #5b21b6; }
        .pd-role-badge.role-f2f { background: #fef3c7; color: #92400e; }

        .pd-status { font-size: var(--font-size-xs); font-weight: 500; }
        .pd-status.active { color: var(--color-success-dark); }
        .pd-status.inactive { color: var(--color-gray-400); }

        .pd-actions { display: flex; gap: 0.5rem; }
        .pd-action-btn {
          padding: 0.25rem 0.625rem; border: 1px solid var(--color-gray-300);
          background: white; border-radius: var(--radius-sm);
          font-size: var(--font-size-xs); cursor: pointer; color: var(--color-gray-600);
        }
        .pd-action-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .pd-action-btn.danger:hover { border-color: var(--color-error); color: var(--color-error); }

        .pd-empty {
          padding: 2rem; text-align: center;
          color: var(--color-gray-500); font-size: var(--font-size-sm);
          background: var(--color-gray-50); border-radius: var(--radius-xl);
        }

        @media (max-width: 640px) {
          .pd-form-grid { grid-template-columns: 1fr; }
          .pd-header { flex-direction: column; gap: 0.75rem; }
        }
      `}</style>
    </div>
  );
};

export default PhysicianDirectory;
