/**
 * manageInvites.js - Invite Management Cloud Functions
 * 
 * Provides functions to:
 * - Resend invitations
 * - Cancel/revoke invitations
 * - List pending invitations
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

/**
 * Resend an invitation email
 */
exports.resendInvite = onCall(
  { region: 'us-central1',
    invoker: 'public' },
  async (request) => {
    const db = getFirestore();
    
    const { inviteId } = request.data;
    const userId = request.auth?.uid;
    const orgId = request.auth?.token?.orgId;
    const userRole = request.auth?.token?.role;

    // Validate authentication and permissions
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!orgId) {
      throw new HttpsError('permission-denied', 'No organization access');
    }

    if (userRole !== 'owner' && userRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Only owners and admins can resend invites');
    }

    if (!inviteId) {
      throw new HttpsError('invalid-argument', 'Invite ID is required');
    }

    try {
      const inviteRef = db.collection('organizations').doc(orgId)
        .collection('pendingInvites').doc(inviteId);
      
      const inviteDoc = await inviteRef.get();

      if (!inviteDoc.exists) {
        throw new HttpsError('not-found', 'Invitation not found');
      }

      const inviteData = inviteDoc.data();

      if (inviteData.status === 'accepted') {
        throw new HttpsError('failed-precondition', 'Invitation already accepted');
      }

      // Delete the old invite and create a new one (triggers sendInvite)
      const newInviteData = {
        email: inviteData.email,
        role: inviteData.role,
        invitedBy: userId,
        invitedAt: Timestamp.now(),
        status: 'pending',
        resentFrom: inviteId,
      };

      // Create new invite (will trigger sendInvite function)
      const newInviteRef = await db.collection('organizations').doc(orgId)
        .collection('pendingInvites').add(newInviteData);

      // Mark old invite as superseded
      await inviteRef.update({
        status: 'superseded',
        supersededBy: newInviteRef.id,
        supersededAt: Timestamp.now(),
      });

      return { 
        success: true, 
        newInviteId: newInviteRef.id,
        message: 'Invitation resent successfully'
      };

    } catch (error) {
      console.error('Error resending invite:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to resend invitation');
    }
  }
);

/**
 * Cancel/revoke an invitation
 */
exports.cancelInvite = onCall(
  { region: 'us-central1',
    invoker: 'public', },
  async (request) => {
    const db = getFirestore();
    
    const { inviteId } = request.data;
    const userId = request.auth?.uid;
    const orgId = request.auth?.token?.orgId;
    const userRole = request.auth?.token?.role;

    // Validate authentication and permissions
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!orgId) {
      throw new HttpsError('permission-denied', 'No organization access');
    }

    if (userRole !== 'owner' && userRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Only owners and admins can cancel invites');
    }

    if (!inviteId) {
      throw new HttpsError('invalid-argument', 'Invite ID is required');
    }

    try {
      const inviteRef = db.collection('organizations').doc(orgId)
        .collection('pendingInvites').doc(inviteId);
      
      const inviteDoc = await inviteRef.get();

      if (!inviteDoc.exists) {
        throw new HttpsError('not-found', 'Invitation not found');
      }

      const inviteData = inviteDoc.data();

      if (inviteData.status === 'accepted') {
        throw new HttpsError('failed-precondition', 'Cannot cancel an accepted invitation');
      }

      await inviteRef.update({
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: Timestamp.now(),
      });

      return { success: true, message: 'Invitation cancelled' };

    } catch (error) {
      console.error('Error cancelling invite:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to cancel invitation');
    }
  }
);

/**
 * Create a new invitation (callable version for UI)
 */
exports.createInvite = onCall(
  { region: 'us-central1',
    /*secrets: [emailUser, emailPass],*/
    invoker: 'public', },
  async (request) => {
    const db = getFirestore();
    
    const { email, role = 'staff' } = request.data;
    const userId = request.auth?.uid;
    const orgId = request.auth?.token?.orgId;
    const userRole = request.auth?.token?.role;

    // Validate authentication and permissions
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!orgId) {
      throw new HttpsError('permission-denied', 'No organization access');
    }

    if (userRole !== 'owner' && userRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Only owners and admins can send invites');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError('invalid-argument', 'Valid email is required');
    }

    if (!['staff', 'admin'].includes(role)) {
      throw new HttpsError('invalid-argument', 'Role must be staff or admin');
    }

    // Owners cannot be invited, only promoted
    if (role === 'owner') {
      throw new HttpsError('invalid-argument', 'Owner role cannot be assigned via invitation');
    }

    try {
      // Check for existing pending invite
      const existingQuery = await db.collection('organizations').doc(orgId)
        .collection('pendingInvites')
        .where('email', '==', email.toLowerCase())
        .where('status', 'in', ['pending', 'sent'])
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        throw new HttpsError('already-exists', 'An invitation for this email is already pending');
      }

      // Check if user already exists in org
      const existingUserQuery = await db.collection('users')
        .where('email', '==', email.toLowerCase())
        .where('organizationId', '==', orgId)
        .limit(1)
        .get();

      if (!existingUserQuery.empty) {
        throw new HttpsError('already-exists', 'This user is already a member of your organization');
      }

      // Create invite (triggers sendInvite function)
      const inviteRef = await db.collection('organizations').doc(orgId)
        .collection('pendingInvites').add({
          email: email.toLowerCase(),
          role: role,
          invitedBy: userId,
          invitedAt: Timestamp.now(),
          status: 'pending',
        });

      return { 
        success: true, 
        inviteId: inviteRef.id,
        message: `Invitation sent to ${email}`
      };

    } catch (error) {
      console.error('Error creating invite:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to send invitation');
    }
  }
);