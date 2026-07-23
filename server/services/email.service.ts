/**
 * server/services/email.service.ts
 * 
 * Central Email Service for Aswaq Platform
 * Supports SMTP Transporter, Resend, SendGrid, and fallback safe logger.
 */

import { logger } from '../lib/logger.ts';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static async getTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const nodemailer = await import('nodemailer');
        return nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
      } catch (err: any) {
        logger.error({ message: `Failed initializing Nodemailer SMTP: ${err.message}` });
      }
    }
    return null;
  }

  /**
   * Send an email with automatic provider resolution (SMTP -> Resend -> Safe Fallback Log)
   */
  public static async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    const { to, subject, html, text } = options;
    const from = process.env.EMAIL_FROM || 'no-reply@aswaq.app';

    // 1. Try Nodemailer SMTP
    const transporter = await this.getTransporter();
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: `منصة أسواق <${from}>`,
          to,
          subject,
          html,
          text: text || subject,
        });
        logger.info({ message: `Email sent via SMTP to ${to}, ID: ${info.messageId}` });
        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        logger.error({ message: `SMTP send error: ${err.message}` });
      }
    }

    // 2. Try Resend API if key is present
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `منصة أسواق <${from}>`,
            to: [to],
            subject,
            html,
          }),
        });
        if (response.ok) {
          const resJson = await response.json();
          logger.info({ message: `Email sent via Resend to ${to}, ID: ${resJson.id}` });
          return { success: true, messageId: resJson.id };
        }
      } catch (err: any) {
        logger.error({ message: `Resend API error: ${err.message}` });
      }
    }

    // 3. Fallback: Log email contents safely for dev/staging
    logger.info({
      message: `[EmailService Safe Fallback] To: ${to} | Subject: ${subject}`,
      detail: text || html.replace(/<[^>]*>?/gm, '').substring(0, 150),
    });
    return { success: true, messageId: `fallback_${Date.now()}` };
  }

  /**
   * Template: Password Reset Link/Code
   */
  public static async sendPasswordResetEmail(to: string, resetToken: string, resetUrl: string) {
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 16px;">
        <h2 style="color: #10b981; margin-bottom: 10px;">إعادة ضبط كلمة المرور - منصة أسواق</h2>
        <p style="font-size: 14px; color: #cbd5e1;">تلقينا طلباً لإعادة ضبط كلمة المرور الخاصة بحسابك (${to}).</p>
        <div style="background-color: #1e293b; padding: 20px; text-align: center; border-radius: 12px; margin: 20px 0;">
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">رمز التحقق الخاص بك:</p>
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #34d399;">${resetToken}</span>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">أو يمكنك النقر على الرابط التالي لإعادة الضبط المباشر:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">إعادة ضبط كلمة المرور</a>
        <p style="font-size: 11px; color: #64748b; margin-top: 30px;">إذا لم تطلب هذا التغيير، يمكنك تجاهل هذا البريد بأمان.</p>
      </div>
    `;
    return this.sendEmail({
      to,
      subject: 'إعادة ضبط كلمة المرور - منصة أسواق',
      html,
      text: `رمز إعادة ضبط كلمة المرور الخاص بك في منصة أسواق هو: ${resetToken}. أو استخدم الرابط: ${resetUrl}`,
    });
  }

  /**
   * Template: Welcome Email
   */
  public static async sendWelcomeEmail(to: string, name: string) {
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 16px;">
        <h2 style="color: #10b981;">أهلاً بك في منصة أسواق! 🚀</h2>
        <p style="font-size: 15px; color: #cbd5e1;">مرحباً ${name}، سعداء بإنضمامك لمنصة التجارة الرقمية الأولى.</p>
        <p style="font-size: 13px; color: #94a3b8;">يمكنك الآن التصفح، نشر إعلاناتك، والبدء في البيع والشراء بكل أمان وسرعة.</p>
      </div>
    `;
    return this.sendEmail({
      to,
      subject: 'مرحباً بك في منصة أسواق 🌟',
      html,
      text: `مرحباً ${name}، أهلاً بك في منصة أسواق!`,
    });
  }
}
