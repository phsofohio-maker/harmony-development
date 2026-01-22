/**
 * PatientImportExport.jsx - Import/Export Patient Data UI
 * 
 * Features:
 * - Export patients to CSV
 * - Import patients from CSV
 * - Validation preview before import
 * - Progress tracking
 */

import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const PatientImportExport = ({ onImportComplete }) => {
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importMode, setImportMode] = useState('add');
  const [showErrors, setShowErrors] = useState(false);

  const fileInputRef = useRef(null);

  // CSV field mapping
  const CSV_HEADERS = [
    'name', 'mrNumber', 'dateOfBirth', 'admissionDate', 'startOfCare',
    'attendingPhysician', 'startingBenefitPeriod', 'isReadmission', 
    'priorHospiceDays', 'f2fRequired', 'f2fCompleted', 'f2fDate',
    'f2fPhysician', 'huv1Completed', 'huv1Date', 'huv2Completed', 
    'huv2Date', 'status', 'notes'
  ];

  // Export patients
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);

    try {
      const exportFn = httpsCallable(functions, 'exportPatients');
      const result = await exportFn({ includeInactive: true });

      if (result.data.success) {
        // Convert to CSV
        const csv = convertToCSV(result.data.patients);
        
        // Download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportError(error.message || 'Failed to export patients');
    } finally {
      setExporting(false);
    }
  };

  // Convert JSON to CSV
  const convertToCSV = (patients) => {
    if (!patients.length) return '';

    const headers = CSV_HEADERS;
    const rows = patients.map(patient => {
      return headers.map(header => {
        const value = patient[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        // Escape quotes and wrap in quotes if contains comma
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setParseErrors([{ row: 0, error: 'Please select a CSV file' }]);
      return;
    }

    setImportFile(file);
    parseCSV(file);
  };

  // Parse CSV file
  const parseCSV = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          setParseErrors([{ row: 0, error: 'File must have headers and at least one data row' }]);
          return;
        }

        // Parse headers
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        
        // Map headers to expected fields
        const headerMap = {};
        headers.forEach((header, index) => {
          const matchedField = CSV_HEADERS.find(
            f => f.toLowerCase() === header || 
                 f.toLowerCase().replace(/([A-Z])/g, ' $1').trim().toLowerCase() === header
          );
          if (matchedField) {
            headerMap[index] = matchedField;
          }
        });

        // Check for required fields
        const mappedFields = Object.values(headerMap);
        if (!mappedFields.includes('name')) {
          setParseErrors([{ row: 0, error: 'CSV must include a "name" column' }]);
          return;
        }

        // Parse data rows
        const patients = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const patient = {};

          values.forEach((value, index) => {
            const field = headerMap[index];
            if (field && value.trim()) {
              patient[field] = value.trim();
            }
          });

          if (patient.name) {
            patients.push(patient);
          } else if (Object.keys(patient).length > 0) {
            errors.push({ row: i + 1, error: 'Missing required name field' });
          }
        }

        setParsedData(patients);
        setParseErrors(errors);
        setImportResult(null);

      } catch (error) {
        console.error('Parse error:', error);
        setParseErrors([{ row: 0, error: 'Failed to parse CSV: ' + error.message }]);
      }
    };

    reader.readAsText(file);
  };

  // Parse a single CSV line (handles quoted values)
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  };

  // Import patients
  const handleImport = async () => {
    if (!parsedData?.length) return;

    setImporting(true);
    setImportResult(null);

    try {
      const importFn = httpsCallable(functions, 'importPatients');
      const result = await importFn({ 
        patients: parsedData,
        mode: importMode 
      });

      setImportResult(result.data);
      
      if (result.data.success > 0) {
        onImportComplete?.();
      }

    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: 0,
        failed: parsedData.length,
        errors: [{ row: 0, error: error.message || 'Import failed' }]
      });
    } finally {
      setImporting(false);
    }
  };

  // Reset import state
  const resetImport = () => {
    setImportFile(null);
    setParsedData(null);
    setParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Download template
  const downloadTemplate = () => {
    const headers = CSV_HEADERS.join(',');
    const example = 'John Smith,MR001,1945-03-15,2024-01-10,2024-01-10,Dr. Johnson,1,No,0,No,No,,,No,,No,,active,New admission';
    const csv = `${headers}\n${example}`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'patient_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="import-export-container">
      {/* Export Section */}
      <section className="ie-section">
        <div className="ie-header">
          <Download size={20} />
          <div>
            <h3>Export Patients</h3>
            <p>Download all patient data as a CSV file</p>
          </div>
        </div>

        <div className="ie-actions">
          <button 
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                Export to CSV
              </>
            )}
          </button>
        </div>

        {exportError && (
          <div className="ie-error">
            <AlertCircle size={16} />
            <span>{exportError}</span>
          </div>
        )}
      </section>

      {/* Import Section */}
      <section className="ie-section">
        <div className="ie-header">
          <Upload size={20} />
          <div>
            <h3>Import Patients</h3>
            <p>Upload a CSV file to add or update patients</p>
          </div>
        </div>

        {/* Template Download */}
        <button className="template-link" onClick={downloadTemplate}>
          <FileText size={14} />
          Download CSV template
        </button>

        {/* File Input */}
        {!importFile ? (
          <div 
            className="file-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} />
            <span>Click to select a CSV file</span>
            <span className="dropzone-hint">or drag and drop</span>
          </div>
        ) : (
          <div className="file-selected">
            <FileSpreadsheet size={20} />
            <div className="file-info">
              <span className="file-name">{importFile.name}</span>
              {parsedData && (
                <span className="file-meta">{parsedData.length} patients found</span>
              )}
            </div>
            <button className="remove-file" onClick={resetImport}>
              <X size={16} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Parse Errors */}
        {parseErrors.length > 0 && (
          <div className="ie-error">
            <AlertCircle size={16} />
            <span>{parseErrors[0].error}</span>
          </div>
        )}

        {/* Import Options */}
        {parsedData && parsedData.length > 0 && !importResult && (
          <div className="import-options">
            <div className="import-mode">
              <label>Import Mode:</label>
              <select 
                value={importMode} 
                onChange={(e) => setImportMode(e.target.value)}
              >
                <option value="add">Add new only (skip existing)</option>
                <option value="update">Update existing (by MR#)</option>
                <option value="replace">Add or replace</option>
              </select>
            </div>

            <div className="import-preview">
              <h4>Preview</h4>
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>MR#</th>
                      <th>DOB</th>
                      <th>Admission</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((patient, i) => (
                      <tr key={i}>
                        <td>{patient.name}</td>
                        <td>{patient.mrNumber || '-'}</td>
                        <td>{patient.dateOfBirth || '-'}</td>
                        <td>{patient.admissionDate || '-'}</td>
                        <td>{patient.status || 'active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && (
                <p className="preview-more">and {parsedData.length - 5} more...</p>
              )}
            </div>

            <button 
              className="btn-primary"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Import {parsedData.length} Patients
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`import-result ${importResult.failed > 0 ? 'has-errors' : 'success'}`}>
            <div className="result-summary">
              {importResult.success > 0 && (
                <div className="result-stat success">
                  <CheckCircle size={16} />
                  <span>{importResult.success} imported</span>
                </div>
              )}
              {importResult.skipped > 0 && (
                <div className="result-stat skipped">
                  <AlertTriangle size={16} />
                  <span>{importResult.skipped} skipped</span>
                </div>
              )}
              {importResult.failed > 0 && (
                <div className="result-stat failed">
                  <AlertCircle size={16} />
                  <span>{importResult.failed} failed</span>
                </div>
              )}
            </div>

            {importResult.errors?.length > 0 && (
              <div className="result-errors">
                <button 
                  className="errors-toggle"
                  onClick={() => setShowErrors(!showErrors)}
                >
                  {showErrors ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showErrors ? 'Hide' : 'Show'} {importResult.errors.length} errors
                </button>

                {showErrors && (
                  <ul className="errors-list">
                    {importResult.errors.slice(0, 20).map((err, i) => (
                      <li key={i}>
                        <span className="error-row">Row {err.row}:</span>
                        <span className="error-msg">{err.error}</span>
                        {err.name && <span className="error-name">({err.name})</span>}
                      </li>
                    ))}
                    {importResult.errors.length > 20 && (
                      <li className="errors-more">
                        and {importResult.errors.length - 20} more errors...
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <button className="btn-secondary" onClick={resetImport}>
              Import Another File
            </button>
          </div>
        )}
      </section>

      <style>{`
        .import-export-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .ie-section {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        }

        .ie-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
          color: var(--color-gray-700);
        }

        .ie-header h3 {
          margin: 0;
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--color-gray-900);
        }

        .ie-header p {
          margin: 0.25rem 0 0;
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
        }

        .ie-actions {
          display: flex;
          gap: 0.75rem;
        }

        .ie-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.75rem;
          background: var(--color-error-light);
          color: var(--color-error-dark);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        /* Buttons */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
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
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: white;
          color: var(--color-gray-700);
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: var(--color-gray-50);
        }

        .template-link {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: var(--font-size-sm);
          cursor: pointer;
          margin-bottom: 1rem;
        }

        .template-link:hover {
          text-decoration: underline;
        }

        /* File Dropzone */
        .file-dropzone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 2rem;
          border: 2px dashed var(--color-gray-300);
          border-radius: var(--radius-lg);
          background: var(--color-gray-50);
          color: var(--color-gray-500);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .file-dropzone:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-50);
          color: var(--color-primary);
        }

        .dropzone-hint {
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
        }

        .file-selected {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-lg);
          color: var(--color-gray-700);
        }

        .file-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .file-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
        }

        .file-meta {
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .remove-file {
          padding: 0.375rem;
          background: none;
          border: none;
          color: var(--color-gray-400);
          cursor: pointer;
          border-radius: var(--radius-sm);
        }

        .remove-file:hover {
          background: var(--color-gray-200);
          color: var(--color-gray-600);
        }

        /* Import Options */
        .import-options {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .import-mode {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .import-mode label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-700);
        }

        .import-mode select {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        /* Preview Table */
        .import-preview h4 {
          margin: 0 0 0.5rem;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-700);
        }

        .preview-table-wrapper {
          overflow-x: auto;
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-md);
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-xs);
        }

        .preview-table th,
        .preview-table td {
          padding: 0.5rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--color-gray-100);
        }

        .preview-table th {
          background: var(--color-gray-50);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-600);
        }

        .preview-more {
          margin: 0.5rem 0 0;
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        /* Import Result */
        .import-result {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: var(--radius-lg);
          background: var(--color-success-light);
        }

        .import-result.has-errors {
          background: var(--color-warning-light);
        }

        .result-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .result-stat {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
        }

        .result-stat.success {
          color: var(--color-success-dark);
        }

        .result-stat.skipped {
          color: var(--color-warning-dark);
        }

        .result-stat.failed {
          color: var(--color-error-dark);
        }

        .result-errors {
          margin-bottom: 1rem;
        }

        .errors-toggle {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          background: none;
          border: none;
          color: var(--color-gray-700);
          font-size: var(--font-size-sm);
          cursor: pointer;
        }

        .errors-list {
          margin: 0.5rem 0 0;
          padding: 0.75rem;
          background: white;
          border-radius: var(--radius-md);
          list-style: none;
          font-size: var(--font-size-xs);
        }

        .errors-list li {
          padding: 0.25rem 0;
          display: flex;
          gap: 0.5rem;
        }

        .error-row {
          color: var(--color-gray-500);
          font-weight: var(--font-weight-medium);
        }

        .error-msg {
          color: var(--color-error);
        }

        .error-name {
          color: var(--color-gray-400);
        }

        .errors-more {
          color: var(--color-gray-500);
          font-style: italic;
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

export default PatientImportExport;