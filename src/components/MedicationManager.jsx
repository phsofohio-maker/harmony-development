/**
 * MedicationManager.jsx - Inline array editor for patient medications
 *
 * Each medication: { name, dose, route, frequency, indication }
 */

import { useState } from 'react';

const EMPTY = { name: '', dose: '', route: '', frequency: '', indication: '' };

const ROUTES = ['PO', 'IV', 'IM', 'SQ', 'SL', 'PR', 'Topical', 'Inhaled', 'Transdermal', 'Other'];

const MedicationManager = ({ medications = [], onChange }) => {
  const [draft, setDraft] = useState({ ...EMPTY });

  const add = () => {
    if (!draft.name.trim()) return;
    onChange([...medications, { ...draft }]);
    setDraft({ ...EMPTY });
  };

  const remove = (idx) => {
    onChange(medications.filter((_, i) => i !== idx));
  };

  const update = (idx, field, value) => {
    const updated = medications.map((m, i) =>
      i === idx ? { ...m, [field]: value } : m
    );
    onChange(updated);
  };

  return (
    <div className="array-manager">
      {medications.length > 0 && (
        <table className="array-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Route</th>
              <th>Frequency</th>
              <th>Indication</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {medications.map((m, i) => (
              <tr key={i}>
                <td>
                  <input type="text" value={m.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    placeholder="Med name" />
                </td>
                <td>
                  <input type="text" value={m.dose}
                    onChange={(e) => update(i, 'dose', e.target.value)}
                    placeholder="e.g. 10mg" />
                </td>
                <td>
                  <select value={m.route} onChange={(e) => update(i, 'route', e.target.value)}>
                    <option value="">—</option>
                    {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <input type="text" value={m.frequency}
                    onChange={(e) => update(i, 'frequency', e.target.value)}
                    placeholder="e.g. BID" />
                </td>
                <td>
                  <input type="text" value={m.indication}
                    onChange={(e) => update(i, 'indication', e.target.value)}
                    placeholder="For..." />
                </td>
                <td>
                  <button type="button" className="remove-btn" onClick={() => remove(i)} title="Remove">&times;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add new */}
      <div className="add-row">
        <input type="text" value={draft.name}
          onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Medication name"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <input type="text" value={draft.dose}
          onChange={(e) => setDraft(prev => ({ ...prev, dose: e.target.value }))}
          placeholder="Dose"
        />
        <button type="button" className="add-btn" onClick={add}>+ Add</button>
      </div>

      {medications.length === 0 && (
        <p className="empty-hint">No medications added yet.</p>
      )}

      <style>{`
        .array-manager { margin-bottom: 0.5rem; }
        .array-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
          margin-bottom: 0.5rem;
        }
        .array-table th {
          text-align: left;
          padding: 0.375rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }
        .array-table td { padding: 0.25rem 0.375rem; }
        .array-table input, .array-table select {
          width: 100%;
          padding: 0.375rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 0.8125rem;
        }
        .array-table input:focus, .array-table select:focus {
          outline: none;
          border-color: #2563eb;
        }
        .remove-btn {
          background: none; border: none;
          color: #ef4444; font-size: 1.125rem;
          cursor: pointer; padding: 0 0.25rem;
        }
        .add-row {
          display: flex; gap: 0.5rem;
          align-items: center;
        }
        .add-row input {
          flex: 1;
          padding: 0.375rem 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.8125rem;
        }
        .add-btn {
          padding: 0.375rem 0.75rem;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
          font-size: 0.8125rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .add-btn:hover { background: #dbeafe; }
        .empty-hint {
          color: #9ca3af;
          font-size: 0.8125rem;
          margin: 0.5rem 0 0;
        }
      `}</style>
    </div>
  );
};

export default MedicationManager;
