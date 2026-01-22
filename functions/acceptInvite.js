/**
 * acceptInvite.js - Accept Invitation Cloud Function
 * 
 * Called when a user clicks the invite link and completes signup.
 * Validates the token, creates user document, and sets custom claims.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

exports.acceptInvite = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    /*secrets: [emailUser, emailPass],*/
  },
  async (request) => {
    const db = getFirestore();
    const auth = getAuth();

    const { token, orgId } = request.data;
    const userId = request.auth?.uid;

    // Validate authentication
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in to accept invite');
    }

    // Validate input
    if (!token || !orgId) {
      throw new HttpsError('invalid-argument', 'Token and orgId are required');
    }

    console.log(`Processing invite acceptance for user ${userId}, org ${orgId}`);

    try {
      // Find the invite by token
      const invitesRef = db.collection('organizations').doc(orgId).collection('pendingInvites');
      const inviteQuery = await invitesRef.where('token', '==', token).limit(1).get();

      if (inviteQuery.empty) {
        throw new HttpsError('not-found', 'Invalid or expired invitation');
      }

      const inviteDoc = inviteQuery.docs[0];
      const inviteData = inviteDoc.data();

      // Validate invite status
      if (inviteData.status === 'accepted') {
        throw new HttpsError('already-exists', 'This invitation has already been used');
      }

      if (inviteData.status === 'expired' || inviteData.status === 'failed') {
        throw new HttpsError('failed-precondition', 'This invitation is no longer valid');
      }

      // Check expiration
      if (inviteData.tokenExpires && inviteData.tokenExpires.toDate() < new Date()) {
        await inviteDoc.ref.update({ status: 'expired' });
        throw new HttpsError('deadline-exceeded', 'This invitation has expired');
      }

      // Get user's email from Auth
      const userRecord = await auth.getUser(userId);
      
      // Verify email matches invite (case-insensitive)
      if (userRecord.email?.toLowerCase() !== inviteData.email?.toLowerCase()) {
        throw new HttpsError(
          'permission-denied', 
          'Please sign up with the email address the invitation was sent to'
        );
      }

      // Get organization data
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      const orgData = orgDoc.exists ? orgDoc.data() : {};

      // Set custom claims
      await auth.setCustomUserClaims(userId, {
        orgId: orgId,
        role: inviteData.role || 'staff',
      });

      console.log(`Set custom claims for user ${userId}: orgId=${orgId}, role=${inviteData.role}`);

      // Create/update user document
      await db.collection('users').doc(userId).set({
        email: userRecord.email,
        displayName: userRecord.displayName || userRecord.email.split('@')[0],
        organizationId: orgId,
        organizationName: orgData.name || 'Harmony Health',
        role: inviteData.role || 'staff',
        customClaimsSet: true,
        inviteAcceptedAt: Timestamp.now(),
        invitedBy: inviteData.invitedBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });

      console.log(`Created user document for ${userId}`);

      // Update invite status
      await inviteDoc.ref.update({
        status: 'accepted',
        acceptedBy: userId,
        acceptedAt: Timestamp.now(),
      });

      console.log(`Invite ${inviteDoc.id} marked as accepted`);

      return {
        success: true,
        organizationName: orgData.name,
        role: inviteData.role,
      };

    } catch (error) {
      console.error('Error accepting invite:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', 'Failed to accept invitation');
    }
  }
);