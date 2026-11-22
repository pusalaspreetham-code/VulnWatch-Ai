const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.mode = process.env.EMAIL_SERVICE_MODE || 'console';
    this.from = process.env.EMAIL_FROM || 'VulnWatch AI <no-reply@vulnwatch.ai>';
  }

  getTransporter() {
    if (this.mode !== 'smtp' || !process.env.SMTP_HOST) return null;
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendOtpEmail({ to, otp, purpose }) {
    let subject = 'Your VulnWatch AI Verification Code';
    let actionDescription = 'verify your request';

    if (purpose === 'REGISTER') {
      subject = 'Verify your email - VulnWatch AI';
      actionDescription = 'complete your account registration';
    } else if (purpose === 'FORGOT_PASSWORD') {
      subject = 'Reset your password - VulnWatch AI';
      actionDescription = 'reset your password';
    } else if (purpose === 'CHANGE_PASSWORD') {
      subject = 'Confirm password change - VulnWatch AI';
      actionDescription = 'confirm changing your password';
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">VulnWatch AI</h2>
        <p style="color: #334155; font-size: 15px;">Use the verification code below to ${actionDescription}:</p>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e293b;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes. If you did not make this request, you can safely ignore this email.</p>
      </div>
    `;

    // In development or local testing, ALWAYS print the code to the terminal console
    // so local testing is never blocked even if SMTP network drops.
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n=========================================');
      console.log(`[VERIFICATION OTP DISPATCH]`);
      console.log(`To:      ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Purpose: ${purpose}`);
      console.log(`OTP:     >>> ${otp} <<<`);
      console.log(`Expires: 10 minutes`);
      console.log('=========================================\n');
    }

    // Pure console mode
    if (this.mode === 'console') {
      return { success: true, mode: 'console' };
    }

    // SMTP Mode with automatic retry and socket resilience
    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const transporter = this.getTransporter();
        if (!transporter) {
          throw new Error('SMTP transporter is not configured.');
        }

        const info = await transporter.sendMail({
          from: this.from,
          to,
          subject,
          html: htmlContent,
        });

        console.log(`[EMAIL DISPATCH] Sent ${purpose} code to ${to} via SMTP (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        lastError = err;
        console.warn(`[EMAIL WARNING] Attempt ${attempt} failed to send email via SMTP (${err.code || err.message}).`);
        if (attempt < maxRetries) {
          // Wait 1 second before retrying with a fresh socket connection
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    console.error('[EMAIL ERROR] All SMTP delivery attempts failed:', lastError);

    // Development fallback: if SMTP fails due to socket drop/ISP block in dev mode,
    // don't fail the user request — the OTP was already printed to the terminal console above!
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EMAIL NOTICE] Development fallback: returning success so you can use the code printed in the terminal console above.');
      return { success: true, mode: 'dev-fallback' };
    }

    throw new Error('Unable to send verification email. Please try again later.');
  }
}

module.exports = new EmailService();
