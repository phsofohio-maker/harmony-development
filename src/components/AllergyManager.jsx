/**
 * AllergyManager.jsx - Inline array editor for patient allergies
 *
 * Each allergy: { allergen, reactionType, severity }
 */

import { useState } from 'react';

const EMPTY = { allergen: '', reactionType: '', severity: '' };

const AllergyManager = ({ allergies = [], onChange }) => {
  const [draft, setDraft] = useState({ ...EMPTY });

  const add = () => {
    if (!draft.allergen.trim()) return;
    onChange([...allergies, { ...draft }]);
    setDraft({ ...EMPTY });
  };

  const remove = (idx) => {
    onChange(allergies.filter((_, i) => i !== idx));
  };

  const update = (idx, field, value) => {
    const updated = allergies.map((a, i) =>
      i === idx ? { ...a, [field]: value } : a
    );
    onChange(updated);
  };

  return (
    <div className="array-manager">
      {allergies.length > 0 && (
        <table className="array-table">
          <thead>
            <tr>
              <th>Allergen</th>
              <th>Reaction Type</th>
              <th>Severity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allergies.map((a, i) => (
              <tr key={i}>
                <td>
                  <input type="text" value={a.allergen}
                    onChange={(e) => update(i, 'allergen', e.target.value)}
                    placeholder="Allergen" />
                </td>
                <td>
                  <select value={a.reactionType} onChange={(e) => update(i, 'reactionType', e.target.value)}>
                    <option value="">—</option>
                    <option value="Drug">Drug</option>
                    <option value="Food">Food</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Latex">Latex</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td>
                  <select value={a.severity} onChange={(e) => update(i, 'severity', e.target.value)}>
                    <option value="">—</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                    <option value="Life-Threatening">Life-Threatening</option>
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
        <input type="text" value={draft.allergen}
          onChange={(e) => setDraft(prev => ({ ...prev, allergen: e.target.value }))}
          placeholder="Allergen name"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <select value={draft.reactionType} onChange={(e) => setDraft(prev => ({ ...prev, reactionType: e.target.value }))}>
          <option value="">Type</option>
          <option value="Drug">Drug</option>
          <option value="Food">Food</option>
          <option value="Environmental">Environmental</option>
          <option value="Other">Other</option>
        </select>
        <select value={draft.severity} onChange={(e) => setDraft(prev => ({ ...prev, severity: e.target.value }))}>
          <option value="">Severity</option>
          <option value="Mild">Mild</option>
          <option value="Moderate">Moderate</option>
          <option value="Severe">Severe</option>
          <option value="Life-Threatening">Life-Threatening</option>
        </select>
        <button type="button" className="add-btn" onClick={add}>+ Add</button>
      </div>

      {allergies.length === 0 && (
        <p className="empty-hint">No allergies recorded.</p>
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

export default AllergyManager;
