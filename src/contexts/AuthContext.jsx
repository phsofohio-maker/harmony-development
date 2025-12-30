// Artifact ID: auth-context
// Branch: 1 (main) (019b4c98...)
// Version: 1
// Command: create
// UUID: 822ecc2e-0f6a-4444-aa22-39da4d953dd0
// Created: 12/23/2025, 11:12:24 AM
// Change: Created

// ---

// src/contexts/AuthContext.jsx
// Authentication context with organization and role support

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const profile = userDoc.data();
            setUserProfile(profile);
            
            // Fetch organization details
            if (profile.organizationId) {
              const orgDoc = await getDoc(doc(db, 'organizations', profile.organizationId));
              if (orgDoc.exists()) {
                setOrganization({ id: orgDoc.id, ...orgDoc.data() });
              }
            }
          } else {
            console.warn('User profile not found in Firestore');
            setError('User profile not configured. Contact administrator.');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user profile');
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setOrganization(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = async (email, password) => {
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      const message = getAuthErrorMessage(err.code);
      setError(message);
      throw new Error(message);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  };

  // Password reset
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const message = getAuthErrorMessage(err.code);
      setError(message);
      throw new Error(message);
    }
  };

  // Check if user has specific role
  const hasRole = (requiredRoles) => {
    if (!userProfile?.role) return false;
    if (typeof requiredRoles === 'string') {
      return userProfile.role === requiredRoles;
    }
    return requiredRoles.includes(userProfile.role);
  };

  // Role hierarchy checks
  const isOwner = () => hasRole('owner');
  const isAdmin = () => hasRole(['owner', 'admin']);
  const isStaff = () => hasRole(['owner', 'admin', 'staff']);
  const canEdit = () => isStaff();
  const canDelete = () => isAdmin();
  const canManageUsers = () => isAdmin();

  const value = {
    user,
    userProfile,
    organization,
    loading,
    error,
    signIn,
    signOut,
    resetPassword,
    hasRole,
    isOwner,
    isAdmin,
    isStaff,
    canEdit,
    canDelete,
    canManageUsers,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Helper: Convert Firebase auth error codes to user-friendly messages
function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Check your connection'
  };
  return messages[code] || 'Authentication failed. Please try again.';
}