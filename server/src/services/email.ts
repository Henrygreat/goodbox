import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Create transporter based on environment
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn('[Email] SMTP not configured. Email not sent:', options.subject);
    console.warn('[Email] To:', options.to);
    console.warn('[Email] Content:', options.text);
    return false;
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    console.log('[Email] Sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  userName: string
): Promise<boolean> {
  const frontendUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  const subject = 'Password Reset Request - Church CRM';
  const text = `
Hello ${userName},

You requested a password reset for your Church CRM account.

Click the link below to reset your password:
${resetLink}

This link will expire in 60 minutes.

If you did not request this reset, please ignore this email.

Best regards,
Church CRM Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #4F46E5;">Password Reset Request</h2>
    <p>Hello ${userName},</p>
    <p>You requested a password reset for your Church CRM account.</p>
    <p>Click the button below to reset your password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px;">This link will expire in 60 minutes.</p>
    <p style="color: #666; font-size: 14px;">If you did not request this reset, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Church CRM Team</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
}
