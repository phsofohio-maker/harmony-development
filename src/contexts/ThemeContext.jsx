/**
 * ThemeContext.jsx - Organization Branding & Theming
 * 
 * Loads organization branding from Firestore and applies
 * CSS custom properties for consistent theming throughout the app.
 * 
 * Usage:
 *   // Wrap your app
 *   <ThemeProvider orgId="org_parrish">
 *     <App />
 *   </ThemeProvider>
 * 
 *   // Access theme in components
 *   const { branding, updateBranding } = useTheme();
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

const ThemeContext = createContext(null);

// Default branding values
const DEFAULT_BRANDING = {
  primaryColor: '#2563eb',
  logoUrl: null,
  organizationName: 'Harmony Health',
};

// Healthcare-appropriate color presets
export const COLOR_PRESETS = [
  { name: 'Blue', value: '#2563eb', sidebar: ['#1e3a5f', '#2c5282'] },
  { name: 'Teal', value: '#0d9488', sidebar: ['#134e4a', '#115e59'] },
  { name: 'Indigo', value: '#4f46e5', sidebar: ['#312e81', '#3730a3'] },
  { name: 'Emerald', value: '#059669', sidebar: ['#064e3b', '#065f46'] },
  { name: 'Cyan', value: '#0891b2', sidebar: ['#164e63', '#155e75'] },
  { name: 'Purple', value: '#7c3aed', sidebar: ['#4c1d95', '#5b21b6'] },
  { name: 'Rose', value: '#e11d48', sidebar: ['#881337', '#9f1239'] },
  { name: 'Slate', value: '#475569', sidebar: ['#1e293b', '#334155'] },
];

/**
 * Converts hex color to HSL components
 */
function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL to hex color
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generates color variants from a base color
 */
function generateColorVariants(baseColor) {
  const { h, s, l } = hexToHSL(baseColor);
  
  return {
    primary: baseColor,
    primaryHover: hslToHex(h, s, Math.max(l - 8, 0)),
    primaryLight: hslToHex(h, Math.max(s - 30, 10), 95),
    primaryDark: hslToHex(h, s, Math.max(l - 15, 0)),
    primary50: hslToHex(h, Math.max(s - 35, 5), 97),
    primary100: hslToHex(h, Math.max(s - 30, 10), 93),
    primary200: hslToHex(h, Math.max(s - 20, 15), 85),
    primary500: hslToHex(h, s, l + 5),
    primary600: baseColor,
    primary700: hslToHex(h, s, Math.max(l - 8, 0)),
    primary800: hslToHex(h, s, Math.max(l - 15, 0)),
    primary900: hslToHex(h, s, Math.max(l - 25, 0)),
  };
}

/**
 * Applies theme variables to the document
 */
function applyThemeToDocument(branding) {
  const root = document.documentElement;
  const colors = generateColorVariants(branding.primaryColor);
  
  // Find matching preset for sidebar colors, or use default
  const preset = COLOR_PRESETS.find(p => p.value === branding.primaryColor);
  const sidebarColors = preset?.sidebar || ['#1e3a5f', '#2c5282'];

  // Primary colors
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-hover', colors.primaryHover);
  root.style.setProperty('--color-primary-light', colors.primaryLight);
  root.style.setProperty('--color-primary-dark', colors.primaryDark);
  root.style.setProperty('--color-primary-50', colors.primary50);
  root.style.setProperty('--color-primary-100', colors.primary100);
  root.style.setProperty('--color-primary-200', colors.primary200);
  root.style.setProperty('--color-primary-500', colors.primary500);
  root.style.setProperty('--color-primary-600', colors.primary600);
  root.style.setProperty('--color-primary-700', colors.primary700);
  root.style.setProperty('--color-primary-800', colors.primary800);
  root.style.setProperty('--color-primary-900', colors.primary900);

  // Sidebar gradient
  root.style.setProperty('--sidebar-bg-start', sidebarColors[0]);
  root.style.setProperty('--sidebar-bg-end', sidebarColors[1]);

  // Update scorecard blue to match primary
  root.style.setProperty('--scorecard-blue-bg', colors.primary50);
  root.style.setProperty('--scorecard-blue-text', colors.primary);
}

export function ThemeProvider({ children, orgId }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to organization branding changes
  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'organizations', orgId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const newBranding = {
            primaryColor: data.branding?.primaryColor || DEFAULT_BRANDING.primaryColor,
            logoUrl: data.branding?.logoUrl || null,
            organizationName: data.name || DEFAULT_BRANDING.organizationName,
          };
          setBranding(newBranding);
          applyThemeToDocument(newBranding);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading branding:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId]);

  // Apply default theme on mount
  useEffect(() => {
    applyThemeToDocument(branding);
  }, []);

  /**
   * Update organization branding
   */
  const updateBranding = async (updates) => {
    if (!orgId) return;

    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        'branding.primaryColor': updates.primaryColor ?? branding.primaryColor,
        'branding.logoUrl': updates.logoUrl ?? branding.logoUrl,
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (err) {
      console.error('Error updating branding:', err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Upload organization logo
   */
  const uploadLogo = async (file) => {
    if (!orgId || !file) return { success: false, error: 'Missing org or file' };

    // Validate file
    const maxSize = 500 * 1024; // 500KB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

    if (file.size > maxSize) {
      return { success: false, error: 'Logo must be under 500KB' };
    }
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Logo must be PNG, JPG, SVG, or WebP' };
    }

    try {
      const ext = file.name.split('.').pop();
      const logoRef = ref(storage, `organizations/${orgId}/assets/logo.${ext}`);
      
      await uploadBytes(logoRef, file);
      const logoUrl = await getDownloadURL(logoRef);
      
      await updateBranding({ logoUrl });
      return { success: true, logoUrl };
    } catch (err) {
      console.error('Error uploading logo:', err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Remove organization logo
   */
  const removeLogo = async () => {
    return updateBranding({ logoUrl: null });
  };

  const value = {
    branding,
    loading,
    error,
    updateBranding,
    uploadLogo,
    removeLogo,
    colorPresets: COLOR_PRESETS,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;