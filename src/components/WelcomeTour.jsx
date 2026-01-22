/**
 * BrandingSettings.jsx - Organization Branding Configuration
 * 
 * Allows admins to customize:
 * - Primary brand color (from healthcare-appropriate presets)
 * - Organization logo upload
 * - Live preview of changes
 */

import { useState, useRef } from 'react';
import { useTheme, COLOR_PRESETS } from '../contexts/ThemeContext';
import { 
  Upload, 
  X, 
  Check, 
  Image, 
  Palette,
  Building2,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Settings,
  Hash
} from 'lucide-react';

const BrandingSettings = () => {
  const { branding, updateBranding, uploadLogo, removeLogo, loading } = useTheme();
  
  // Local state for optimistic updates
  const [selectedColor, setSelectedColor] = useState(branding.primaryColor);
  const [customHex, setCustomHex] = useState('');
  const [hexError, setHexError] = useState(null);
  const [previewLogo, setPreviewLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);

  // Check if there are unsaved changes
  const hasChanges = selectedColor !== branding.primaryColor;

  // Handle color selection
  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setCustomHex('');
    setHexError(null);
    setMessage(null);
  };

  // Validate and apply custom hex color
  const validateHex = (hex) => /^#([A-Fa-f0-9]{6})$/.test(hex);
  
  const handleCustomHex = (value) => {
    // Auto-add # if missing
    let hex = value.startsWith('#') ? value : `#${value}`;
    setCustomHex(hex);
    setHexError(null);
    
    if (hex.length === 7) {
      if (validateHex(hex)) {
        setSelectedColor(hex);
      } else {
        setHexError('Invalid hex color');
      }
    }
  };

  const applyCustomHex = () => {
    if (validateHex(customHex)) {
      setSelectedColor(customHex);
      setHexError(null);
    } else {
      setHexError('Enter a valid hex color (e.g., #3B82F6)');
    }
  };

  // Save color changes
  const handleSaveColor = async () => {
    setSaving(true);
    setMessage(null);
    
    const result = await updateBranding({ primaryColor: selectedColor });
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Brand color updated successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update color' });
    }
    
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  // Handle file selection
  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate
    const maxSize = 500 * 1024;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

    if (file.size > maxSize) {
      setMessage({ type: 'error', text: 'Logo must be under 500KB' });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please upload a PNG, JPG, SVG, or WebP file' });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewLogo(e.target.result);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    setMessage(null);

    const result = await uploadLogo(file);

    if (result.success) {
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
      setPreviewLogo(null);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to upload logo' });
      setPreviewLogo(null);
    }

    setUploading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Handle logo removal
  const handleRemoveLogo = async () => {
    setSaving(true);
    const result = await removeLogo();
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Logo removed' });
    } else {
      setMessage({ type: 'error', text: 'Failed to remove logo' });
    }
    
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  // Get the preset for preview (or show custom)
  const selectedPreset = COLOR_PRESETS.find(p => p.value === selectedColor);
  const colorName = selectedPreset?.name || 'Custom';

  if (loading) {
    return (
      <div className="branding-loading">
        <Loader2 className="spin" size={24} />
        <span>Loading branding settings...</span>
      </div>
    );
  }

  return (
    <div className="branding-settings">
      {/* Message Banner */}
      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="branding-grid">
        {/* Left Column: Settings */}
        <div className="branding-controls">
          {/* Logo Section */}
          <section className="settings-section">
            <div className="section-header">
              <Image size={20} />
              <div>
                <h3>Organization Logo</h3>
                <p>Displayed in the sidebar and documents</p>
              </div>
            </div>

            <div className="logo-upload-area">
              {branding.logoUrl || previewLogo ? (
                <div className="logo-preview-container">
                  <img 
                    src={previewLogo || branding.logoUrl} 
                    alt="Organization logo" 
                    className="logo-preview-image"
                  />
                  <div className="logo-actions">
                    <button 
                      className="btn-text"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      Replace
                    </button>
                    <button 
                      className="btn-text danger"
                      onClick={handleRemoveLogo}
                      disabled={saving || uploading}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`dropzone ${dragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="spin" size={32} />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={32} />
                      <span>Drag & drop your logo here</span>
                      <span className="dropzone-hint">or click to browse</span>
                      <span className="dropzone-specs">PNG, JPG, SVG, WebP · Max 500KB</span>
                    </>
                  )}
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
            </div>
          </section>

          {/* Color Section */}
          <section className="settings-section">
            <div className="section-header">
              <Palette size={20} />
              <div>
                <h3>Brand Color</h3>
                <p>Applied to buttons, links, and accents</p>
              </div>
            </div>

            <div className="color-grid">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  className={`color-swatch ${selectedColor === preset.value ? 'selected' : ''}`}
                  style={{ '--swatch-color': preset.value }}
                  onClick={() => handleColorSelect(preset.value)}
                  title={preset.name}
                >
                  {selectedColor === preset.value && <Check size={14} />}
                </button>
              ))}
            </div>

            {/* Custom Hex Input */}
            <div className="custom-color-section">
              <label>Or enter a custom color</label>
              <div className="hex-input-row">
                <div className="hex-input-wrapper">
                  <Hash size={14} className="hex-icon" />
                  <input
                    type="text"
                    value={customHex.replace('#', '')}
                    onChange={(e) => handleCustomHex(e.target.value)}
                    onBlur={applyCustomHex}
                    onKeyDown={(e) => e.key === 'Enter' && applyCustomHex()}
                    placeholder="3B82F6"
                    maxLength={6}
                  />
                </div>
                <div 
                  className="color-preview-box"
                  style={{ background: validateHex(customHex) ? customHex : selectedColor }}
                />
              </div>
              {hexError && (
                <span className="hex-error">{hexError}</span>
              )}
            </div>

            <div className="color-info">
              <span className="color-name">{colorName}</span>
              <span className="color-value">{selectedColor}</span>
            </div>

            {hasChanges && (
              <button 
                className="btn-primary save-btn"
                onClick={handleSaveColor}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="spin" size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Save Color
                  </>
                )}
              </button>
            )}
          </section>
        </div>

        {/* Right Column: Live Preview */}
        <div className="branding-preview">
          <div className="preview-header">
            <span>Live Preview</span>
          </div>
          
          <div className="preview-container">
            {/* Mini Sidebar Preview */}
            <div 
              className="preview-sidebar"
              style={{ 
                background: `linear-gradient(180deg, color-mix(in srgb, ${selectedColor} 80%, #000 40%) 0%, color-mix(in srgb, ${selectedColor} 80%, #000 25%) 100%)`
              }}
            >
              <div className="preview-logo-area">
                {(previewLogo || branding.logoUrl) ? (
                  <img 
                    src={previewLogo || branding.logoUrl} 
                    alt="" 
                    className="preview-logo-img"
                  />
                ) : (
                  <Building2 size={20} />
                )}
                <span>Harmony</span>
              </div>
              
              <div className="preview-nav">
                <div className="preview-nav-item active" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <LayoutDashboard size={14} />
                  <span>Dashboard</span>
                </div>
                <div className="preview-nav-item">
                  <Users size={14} />
                  <span>Patients</span>
                </div>
                <div className="preview-nav-item">
                  <ClipboardCheck size={14} />
                  <span>Certifications</span>
                </div>
                <div className="preview-nav-item">
                  <Settings size={14} />
                  <span>Settings</span>
                </div>
              </div>
            </div>

            {/* Mini Content Preview */}
            <div className="preview-content">
              <div className="preview-scorecard" style={{ borderLeftColor: selectedColor }}>
                <div 
                  className="preview-scorecard-icon"
                  style={{ background: `${selectedColor}15`, color: selectedColor }}
                >
                  <Users size={14} />
                </div>
                <div className="preview-scorecard-data">
                  <span className="preview-value" style={{ color: selectedColor }}>24</span>
                  <span className="preview-label">Active Patients</span>
                </div>
              </div>

              <div className="preview-buttons">
                <button 
                  className="preview-btn primary"
                  style={{ background: selectedColor }}
                >
                  Primary Button
                </button>
                <button 
                  className="preview-btn secondary"
                  style={{ color: selectedColor, borderColor: selectedColor }}
                >
                  Secondary
                </button>
              </div>

              <div className="preview-link" style={{ color: selectedColor }}>
                Sample link text
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .branding-settings {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .branding-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: var(--color-gray-500);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Message Banner */
        .message-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
        }

        .message-banner.success {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }

        .message-banner.error {
          background: var(--color-error-light);
          color: var(--color-error-dark);
        }

        /* Grid Layout */
        .branding-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 1.5rem;
        }

        @media (max-width: 900px) {
          .branding-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Settings Sections */
        .branding-controls {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .settings-section {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          color: var(--color-gray-700);
        }

        .section-header h3 {
          margin: 0;
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--color-gray-900);
        }

        .section-header p {
          margin: 0.25rem 0 0;
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
        }

        /* Logo Upload */
        .logo-upload-area {
          margin-top: 0.5rem;
        }

        .dropzone {
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

        .dropzone:hover, .dropzone.active {
          border-color: var(--color-primary);
          background: var(--color-primary-50);
          color: var(--color-primary);
        }

        .dropzone.uploading {
          pointer-events: none;
          opacity: 0.7;
        }

        .dropzone-hint {
          font-size: var(--font-size-sm);
        }

        .dropzone-specs {
          font-size: var(--font-size-xs);
          color: var(--color-gray-400);
          margin-top: 0.25rem;
        }

        .logo-preview-container {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--color-gray-50);
          border-radius: var(--radius-lg);
        }

        .logo-preview-image {
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: var(--radius-md);
          background: white;
          padding: 0.25rem;
        }

        .logo-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn-text {
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: var(--font-size-sm);
          cursor: pointer;
          padding: 0.25rem 0.5rem;
        }

        .btn-text:hover {
          text-decoration: underline;
        }

        .btn-text.danger {
          color: var(--color-error);
        }

        /* Color Grid */
        .color-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 0.5rem;
        }

        @media (max-width: 600px) {
          .color-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .color-swatch {
          aspect-ratio: 1;
          border: 2px solid transparent;
          border-radius: var(--radius-md);
          background: var(--swatch-color);
          cursor: pointer;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          min-height: 36px;
        }

        .color-swatch:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .color-swatch.selected {
          border-color: var(--color-gray-900);
          box-shadow: 0 0 0 2px white, 0 0 0 4px var(--swatch-color);
          transform: scale(1.05);
        }

        /* Custom Hex Input */
        .custom-color-section {
          margin-top: 1.25rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--color-gray-100);
        }

        .custom-color-section label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: var(--font-size-sm);
          color: var(--color-gray-600);
        }

        .hex-input-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .hex-input-wrapper {
          position: relative;
          flex: 1;
          max-width: 160px;
        }

        .hex-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-gray-400);
        }

        .hex-input-wrapper input {
          width: 100%;
          padding: 0.5rem 0.75rem 0.5rem 2rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-mono);
          font-size: var(--font-size-sm);
          text-transform: uppercase;
        }

        .hex-input-wrapper input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-100);
        }

        .color-preview-box {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          border: 2px solid var(--color-gray-200);
        }

        .hex-error {
          display: block;
          margin-top: 0.375rem;
          font-size: var(--font-size-xs);
          color: var(--color-error);
        }

        .color-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-gray-100);
        }

        .color-name {
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-700);
        }

        .color-value {
          font-family: var(--font-family-mono);
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
        }

        .save-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          margin-top: 1rem;
          padding: 0.75rem;
        }

        .btn-primary {
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

        /* Preview Panel */
        .branding-preview {
          background: var(--color-gray-100);
          border-radius: var(--radius-xl);
          overflow: hidden;
          height: fit-content;
          position: sticky;
          top: 1.5rem;
        }

        .preview-header {
          padding: 0.75rem 1rem;
          background: var(--color-gray-200);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-600);
        }

        .preview-container {
          display: flex;
          padding: 1rem;
          gap: 0.5rem;
          min-height: 280px;
        }

        /* Mini Sidebar */
        .preview-sidebar {
          width: 120px;
          border-radius: var(--radius-md);
          padding: 0.75rem 0.5rem;
          color: white;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .preview-logo-area {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem;
          font-size: 0.6875rem;
          font-weight: var(--font-weight-semibold);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 0.625rem;
          margin-bottom: 0.25rem;
        }

        .preview-logo-img {
          width: 20px;
          height: 20px;
          object-fit: contain;
          border-radius: 2px;
        }

        .preview-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .preview-nav-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          color: rgba(255,255,255,0.7);
        }

        .preview-nav-item.active {
          color: white;
        }

        /* Mini Content */
        .preview-content {
          flex: 1;
          background: white;
          border-radius: var(--radius-md);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .preview-scorecard {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem;
          border: 1px solid var(--color-gray-200);
          border-left-width: 3px;
          border-radius: var(--radius-md);
        }

        .preview-scorecard-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-scorecard-data {
          display: flex;
          flex-direction: column;
        }

        .preview-value {
          font-size: 0.875rem;
          font-weight: var(--font-weight-bold);
          line-height: 1;
        }

        .preview-label {
          font-size: 0.5625rem;
          color: var(--color-gray-500);
        }

        .preview-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .preview-btn {
          padding: 0.375rem 0.625rem;
          border-radius: 4px;
          font-size: 0.5625rem;
          font-weight: var(--font-weight-medium);
          cursor: default;
        }

        .preview-btn.primary {
          border: none;
          color: white;
        }

        .preview-btn.secondary {
          background: white;
          border: 1px solid;
        }

        .preview-link {
          font-size: 0.625rem;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default BrandingSettings;