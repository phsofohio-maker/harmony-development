const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { admin } = require('./firebase');

const refreshUserClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const { uid } = request.data;
  
  try {
    // Revoke all existing tokens to force refresh
    await admin.revokeRefreshTokens(uid || request.auth.uid);
    
    return { 
      success: true, 
      message: 'Token refresh initiated. Please sign in again.' 
    };
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    throw new HttpsError('internal', 'Failed to refresh tokens');
  }
});

module.exports = { refreshUserClaims };