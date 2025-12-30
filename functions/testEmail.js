/**
 * Test Email Function - CORS Enabled
 * Manually trigger to verify email configuration works
 * Deploy with: firebase deploy --only functions:testEmail
 */

const { onRequest } = require('firebase-functions/v2/https');
const nodemailer = require('nodemailer');

exports.testEmail = onRequest(
  {
    secrets: ['EMAIL_USER', 'EMAIL_PASS'],
    region: 'us-central1',
    // CORS configuration for Firebase Studio and localhost
    cors: [
      'https://3000-firebase-harmony-dashboard-1766516274763.cluster-lrr5y7z5yndkqxji6hu4ekvtbq.cloudworkstations.dev',
      /^https:\/\/.*-firebase-.*\.cloudworkstations\.dev$/,  // Any Firebase Studio URL
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173'
    ]
  },
  async (req, res) => {
    console.log('📧 Starting email test...');
    console.log('📍 Request origin:', req.headers.origin);

    try {
      // Create transporter with environment variables
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Verify transporter configuration
      console.log('🔍 Verifying transporter...');
      await transporter.verify();
      console.log('✅ Transporter verified successfully');

      // Test email details
      const testEmailList = [
        'kobet@parrishhealthsystems.org',
        'phsofohio@gmail.com'
      ];

      const mailOptions = {
        from: {
          name: 'Harmony Health Care Assistant',
          address: process.env.EMAIL_USER
        },
        to: testEmailList.join(','),
        subject: '✅ Test Email - Harmony System',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">✅ Email Test Successful</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Harmony Health Care Assistant</p>
            </div>
            
            <div style="padding: 30px 20px;">
              <h2 style="color: #2563eb; margin-top: 0;">Test Results</h2>
              
              <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0;"><strong>✓ Email Configuration:</strong> Working</p>
                <p style="margin: 10px 0 0 0;"><strong>✓ SMTP Connection:</strong> Verified</p>
                <p style="margin: 10px 0 0 0;"><strong>✓ Email Delivery:</strong> Successful</p>
              </div>
              
              <h3 style="color: #2563eb;">System Information</h3>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Sender:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>${process.env.EMAIL_USER}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Test Time:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Recipients:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>${testEmailList.length}</strong></td>
                </tr>
              </table>
              
              <div style="background: #dcfce7; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #065f46;"><strong>✅ All Systems Operational</strong></p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #065f46;">
                  Your daily certification notifications and weekly summaries are configured correctly and ready to send.
                </p>
              </div>
              
              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                This is an automated test message from your Harmony Health Care Assistant system. 
                If you received this email, your notification system is working correctly.
              </p>
            </div>
            
            <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              Parrish Health Systems | Automated Email Test
            </div>
          </body>
          </html>
        `,
        text: `
EMAIL TEST SUCCESSFUL
Harmony Health Care Assistant

✓ Email Configuration: Working
✓ SMTP Connection: Verified  
✓ Email Delivery: Successful

System Information:
- Sender: ${process.env.EMAIL_USER}
- Test Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
- Recipients: ${testEmailList.length}

All Systems Operational
Your daily certification notifications and weekly summaries are configured correctly and ready to send.

---
This is an automated test message from your Harmony Health Care Assistant system.
Parrish Health Systems
        `.trim()
      };

      // Send the email
      console.log('📨 Sending test email...');
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully');
      console.log('📬 Message ID:', info.messageId);

      // Return success response
      res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        details: {
          messageId: info.messageId,
          recipients: testEmailList,
          sender: process.env.EMAIL_USER,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Email test failed:', error);
      
      // Return detailed error information
      res.status(500).json({
        success: false,
        message: 'Email test failed',
        error: {
          message: error.message,
          code: error.code,
          command: error.command
        },
        troubleshooting: {
          checkEmailUser: 'Verify EMAIL_USER secret is set correctly',
          checkEmailPass: 'Verify EMAIL_PASS is your Gmail App Password (not regular password)',
          checkGmailSettings: 'Ensure 2-factor authentication is enabled and App Password is generated',
          documentation: 'https://support.google.com/accounts/answer/185833'
        }
      });
    }
  }
);