const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { admin, db, Timestamp } = require('./firebase');

const updateUserClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { uid, orgId, role } = request.data;
  
  if (!uid) {
    throw new HttpsError('invalid-argument', 'User ID required');
  }
  
  try {
    const updates = {};
    if (orgId) updates.orgId = orgId;
    if (role) updates.role = role;
    
    // Update custom claims
    await admin.setCustomUserClaims(uid, updates);
    
    // Update Firestore
    await db.collection('users').doc(uid).update({
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    return { success: true, message: 'Claims updated successfully' };
  } catch (error) {
    console.error('Error updating claims:', error);
    throw new HttpsError('internal', 'Failed to update claims');
  }
});

module.exports = { updateUserClaims };