/**
 * DiagnosisManager.jsx - Inline array editor for patient diagnoses
 *
 * Each diagnosis: { name, icd10, relationship }
 * relationship: 'Terminal' | 'Related' | 'Unrelated'
 */

import { useState } from 'react';

const EMPTY = { name: '', icd10: '', relationship: 'Terminal' };

const DiagnosisManager = ({ diagnoses = [], onChange }) => {
  const [draft, setDraft] = useState({ ...EMPTY });

  const add = () => {
    if (!draft.name.trim()) return;
    onChange([...diagnoses, { ...draft }]);
    setDraft({ ...EMPTY });
  };

  const remove = (idx) => {
    onChange(diagnoses.filter((_, i) => i !== idx));
  };

  const update = (idx, field, value) => {
    const updated = diagnoses.map((d, i) =>
      i === idx ? { ...d, [field]: value } : d
    );
    onChange(updated);
  };

  return (
    <div className="array-manager">
      {/* Existing items */}
      {diagnoses.length > 0 && (
        <table className="array-table">
          <thead>
            <tr>
              <th>Diagnosis</th>
              <th>ICD-10</th>
              <th>Relationship</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {diagnoses.map((d, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    placeholder="Diagnosis"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={d.icd10}
                    onChange={(e) => update(i, 'icd10', e.target.value)}
                    placeholder="e.g. C34.1"
                  />
                </td>
                <td>
                  <select value={d.relationship} onChange={(e) => update(i, 'relationship', e.target.value)}>
                    <option value="Terminal">Terminal</option>
                    <option value="Related">Related</option>
                    <option value="Unrelated">Unrelated</option>
                  </select>
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
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Diagnosis name"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <input
          type="text"
          value={draft.icd10}
          onChange={(e) => setDraft(prev => ({ ...prev, icd10: e.target.value }))}
          placeholder="ICD-10"
        />
        <select value={draft.relationship} onChange={(e) => setDraft(prev => ({ ...prev, relationship: e.target.value }))}>
          <option value="Terminal">Terminal</option>
          <option value="Related">Related</option>
          <option value="Unrelated">Unrelated</option>
        </select>
        <button type="button" className="add-btn" onClick={add}>+ Add</button>
      </div>

      {diagnoses.length === 0 && (
        <p className="empty-hint">No diagnoses added yet.</p>
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
        .array-table td { padding: 0.25rem 0.5rem; }
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
        .add-row input, .add-row select {
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

export default DiagnosisManager;
