/**
 * functions/testEmail.js
 * Improved email test function with consistent Secret handling
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const nodemailer = require('nodemailer');
const { defineSecret } = require('firebase-functions/params');

// Define secrets (must match declaration in index.js)
const emailUser = defineSecret('EMAIL_USER');
const emailPass = defineSecret('EMAIL_PASS');

exports.testEmail = onCall(
  {
    secrets: [emailUser, emailPass],
    region: 'us-central1'
  },
  async (request) => {
    console.log('📧 Starting email test...');
    
    // Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated to test email');
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser.value(),
          pass: emailPass.value(),
        },
      });

      await transporter.verify();

      const recipient = request.data.email || emailUser.value(); // Default to sender if no email provided
      const now = new Date();
      
      const mailOptions = {
        from: `"Harmony Health" <${emailUser.value()}>`,
        to: recipient,
        subject: '✅ Harmony System: Email Configuration Verified',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
            <h2 style="color: #0369a1; margin-top: 0;">✅ System Configuration Verified</h2>
            <p>Your Harmony Health Care Assistant email system is fully operational.</p>
            <ul style="color: #334155;">
              <li><strong>Time:</strong> ${now.toLocaleString()}</li>
              <li><strong>Triggered By:</strong> ${request.auth.uid}</li>
              <li><strong>Sender:</strong> ${emailUser.value()}</li>
            </ul>
            <p style="font-size: 0.9em; color: #64748b;">This is an automated test message.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Email test failed:', error);
      throw new HttpsError('internal', `Email test failed: ${error.message}`);
    }
  }
);