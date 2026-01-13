const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { admin, db, Timestamp } = require('./firebase');

const setUserClaims = onCall(async (request) => {
  // Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { uid, orgId, role } = request.data;
  
  // Validate inputs
  if (!uid || !orgId || !role) {
    throw new HttpsError('invalid-argument', 'Missing required fields: uid, orgId, role');
  }
  
  // Validate role
  const validRoles = ['owner', 'admin', 'staff', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  try {
    // Set custom claims
    await admin.setCustomUserClaims(uid, { orgId, role });
    
    // Update user document in Firestore
    await db.collection('users').doc(uid).update({
      organizationId: orgId,
      role: role,
      customClaimsSet: true,
      updatedAt: Timestamp.now()
    });
    
    return { 
      success: true, 
      message: 'Custom claims set successfully',
      uid,
      orgId,
      role
    };
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw new HttpsError('internal', 'Failed to set custom claims');
  }
});

module.exports = { setUserClaims };