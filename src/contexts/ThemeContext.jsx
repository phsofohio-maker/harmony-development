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

// Expanded color presets - organized by hue
export const COLOR_PRESETS = [
  // Blues
  { name: 'Blue', value: '#2563eb' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Indigo', value: '#4f46e5' },
  // Greens
  { name: 'Emerald', value: '#059669' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Green', value: '#16a34a' },
  // Warm
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#e11d48' },
  // Cool
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Fuchsia', value: '#c026d3' },
  // Neutrals
  { name: 'Slate', value: '#475569' },
  { name: 'Gray', value: '#4b5563' },
  { name: 'Zinc', value: '#52525b' },
  { name: 'Stone', value: '#57534e' },
];

/**
 * Calculate relative luminance of a color
 * Returns value between 0 (black) and 1 (white)
 */
function getLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Determine if text should be light or dark based on background
 */
function shouldUseLightText(bgColor) {
  return getLuminance(bgColor) < 0.5;
}

/**
 * Generate sidebar colors from primary color
 */
function generateSidebarColors(primaryColor) {
  const { h, s, l } = hexToHSL(primaryColor);
  
  // Create darker, more saturated versions for sidebar gradient
  const sidebarStart = hslToHex(h, Math.min(s + 10, 100), Math.max(l - 35, 10));
  const sidebarEnd = hslToHex(h, Math.min(s + 5, 100), Math.max(l - 25, 15));
  
  return [sidebarStart, sidebarEnd];
}

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
  
  // Generate sidebar colors from primary
  const sidebarColors = generateSidebarColors(branding.primaryColor);
  
  // Determine text colors based on sidebar background luminance
  const useLightText = shouldUseLightText(sidebarColors[0]);

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
  root.style.setProperty('--color-primary-700', colors.primaryHover);
  root.style.setProperty('--color-primary-800', colors.primaryDark);
  root.style.setProperty('--color-primary-900', colors.primaryDark);

  // Sidebar gradient
  root.style.setProperty('--sidebar-bg-start', sidebarColors[0]);
  root.style.setProperty('--sidebar-bg-end', sidebarColors[1]);
  
  // Auto-contrast sidebar text colors
  if (useLightText) {
    root.style.setProperty('--sidebar-text', 'rgba(255, 255, 255, 0.95)');
    root.style.setProperty('--sidebar-text-muted', 'rgba(255, 255, 255, 0.7)');
    root.style.setProperty('--sidebar-hover', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--sidebar-active', 'rgba(255, 255, 255, 0.15)');
    root.style.setProperty('--sidebar-border', 'rgba(255, 255, 255, 0.1)');
  } else {
    root.style.setProperty('--sidebar-text', 'rgba(0, 0, 0, 0.9)');
    root.style.setProperty('--sidebar-text-muted', 'rgba(0, 0, 0, 0.6)');
    root.style.setProperty('--sidebar-hover', 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--sidebar-active', 'rgba(0, 0, 0, 0.12)');
    root.style.setProperty('--sidebar-border', 'rgba(0, 0, 0, 0.1)');
  }

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