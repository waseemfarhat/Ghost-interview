import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (!env.smtp.host) {
    // No SMTP configured (typical for local/self-hosted dev). Fall back to
    // a console-logging "transport" so registration/reset flows still work
    // end-to-end without requiring a mail account to demo the app.
    transporter = {
      sendMail: async (msg) => {
        logger.info(`[email:dev-fallback] To: ${msg.to} | Subject: ${msg.subject}\n${msg.text}`);
        return { messageId: 'dev-fallback' };
      }
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined
  });
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = getTransporter();
  await t.sendMail({ from: env.smtp.from, to, subject, text, html });
}

export const emailService = {
  async sendWelcomeEmail(user) {
    await send({
      to: user.email,
      subject: 'Welcome to Ghost Interview',
      text: `Hi ${user.fullName},\n\nYour Ghost Interview account has been created successfully. You can now log in and start practicing AI mock interviews.\n\n- Ghost Interview Team`
    });
  },

  async sendPasswordResetEmail(user, rawToken) {
    const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
    await send({
      to: user.email,
      subject: 'Reset your Ghost Interview password',
      text: `Hi ${user.fullName},\n\nWe received a request to reset your password. This link expires in 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\n- Ghost Interview Team`
    });
  }
};
