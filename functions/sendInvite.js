/**
 * sendInvite.js - Email Invitation Cloud Function
 * 
 * Triggers when a new document is created in pendingInvites subcollection.
 * Sends an invitation email and generates a secure invite token.
 * 
 * Firestore structure:
 *   organizations/{orgId}/pendingInvites/{inviteId}
 *     - email: string
 *     - role: 'staff' | 'admin'
 *     - invitedBy: userId
 *     - invitedAt: timestamp
 *     - status: 'pending' | 'sent' | 'accepted' | 'expired'
 *     - token: string (generated)
 *     - tokenExpires: timestamp
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { defineSecret } = require('firebase-functions/params');

// Secrets
const emailUser = defineSecret('EMAIL_USER');
const emailPass = defineSecret('EMAIL_PASS');

// App URL - update for production
const APP_URL = process.env.APP_URL || 'https://parrish-harmonyhca.web.app';

exports.sendInvite = onDocumentCreated(
  {
    document: 'organizations/{orgId}/pendingInvites/{inviteId}',
    /*secrets: [emailUser, emailPass],*/
    region: 'us-central1',
    invoker: 'public',
  },
  async (event) => {
    const db = getFirestore();
    const snapshot = event.data;
    
    if (!snapshot) {
      console.log('No data in snapshot');
      return;
    }

    const inviteData = snapshot.data();
    const { orgId, inviteId } = event.params;

    console.log(`Processing invite ${inviteId} for org ${orgId}`);

    // Validate required fields
    if (!inviteData.email || !inviteData.invitedBy) {
      console.error('Missing required fields');
      await snapshot.ref.update({ 
        status: 'failed', 
        error: 'Missing required fields' 
      });
      return;
    }

    try {
      // Get organization details
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      const orgData = orgDoc.exists ? orgDoc.data() : {};
      const orgName = orgData.name || 'Harmony Health';

      // Get inviter details
      const inviterDoc = await db.collection('users').doc(inviteData.invitedBy).get();
      const inviterData = inviterDoc.exists ? inviterDoc.data() : {};
      const inviterName = inviterData.displayName || inviterData.email || 'A team member';

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenExpires = Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      );

      // Create invite link
      const inviteLink = `${APP_URL}/invite?token=${token}&org=${orgId}`;

      // Configure email transport
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser.value(),
          pass: emailPass.value(),
        },
      });

      // Email content
      const roleName = inviteData.role === 'admin' ? 'Administrator' : 'Staff Member';
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 12px 20px; border-radius: 10px; font-size: 20px; font-weight: 600;">
                  ♥ Harmony
                </div>
              </div>

              <!-- Content -->
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                You're invited to join ${orgName}
              </h1>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563; text-align: center;">
                ${inviterName} has invited you to join <strong>${orgName}</strong> on Harmony as a <strong>${roleName}</strong>.
              </p>

              <p style="margin: 0 0 32px; font-size: 15px; line-height: 1.6; color: #6b7280; text-align: center;">
                Harmony helps healthcare teams track hospice compliance, certifications, and patient care requirements.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; text-decoration: none;">
                  Accept Invitation
                </a>
              </div>

              <!-- Link fallback -->
              <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af; text-align: center;">
                Or copy and paste this link:
              </p>
              <p style="margin: 0 0 32px; font-size: 12px; color: #6b7280; text-align: center; word-break: break-all;">
                ${inviteLink}
              </p>

              <!-- Footer -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                  This invitation expires in 7 days.
                </p>
                <p style="margin: 8px 0 0; font-size: 13px; color: #9ca3af;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>

            </div>
          </div>
        </body>
        </html>
      `;

      const emailText = `
You're invited to join ${orgName}

${inviterName} has invited you to join ${orgName} on Harmony as a ${roleName}.

Harmony helps healthcare teams track hospice compliance, certifications, and patient care requirements.

Accept your invitation: ${inviteLink}

This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
      `;

      // Send email
      await transporter.sendMail({
        from: `"Harmony Health" <${emailUser.value()}>`,
        to: inviteData.email,
        subject: `You're invited to join ${orgName} on Harmony`,
        text: emailText,
        html: emailHtml,
      });

      console.log(`Invite email sent to ${inviteData.email}`);

      // Update invite document with token and status
      await snapshot.ref.update({
        status: 'sent',
        token: token,
        tokenExpires: tokenExpires,
        sentAt: Timestamp.now(),
      });

      console.log(`Invite ${inviteId} updated with token`);

    } catch (error) {
      console.error('Error sending invite:', error);
      
      await snapshot.ref.update({
        status: 'failed',
        error: error.message,
        failedAt: Timestamp.now(),
      });
    }
  }
);