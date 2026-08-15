const path = require('path');
const nodemailer = require('nodemailer');

const logger = require('../utils/logger');

const getSmtpConfig = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER || '';
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  };
};

const createTransporter = () => nodemailer.createTransport(getSmtpConfig());

const normalizeRecipients = (recipients = []) => {
  if (!Array.isArray(recipients)) return [];
  return [...new Set(recipients.map((item) => String(item).trim()).filter((value) => {
    const email = String(value).trim();
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }))];
};

const sendCampaignEmails = async ({
  subject,
  html,
  text,
  to,
  attachments = [],
  fromName = 'CRM Mail Campaign',
}) => {
  const recipients = normalizeRecipients(to);
  const config = getSmtpConfig();
  const smtpUser = config.auth.user;

  logger.info('mail-campaign.email.send.start', {
    smtpUser: smtpUser || 'undefined',
    recipientCount: recipients.length,
    attachments: attachments.length,
  });

  if (!smtpUser || !config.auth.pass) {
    const message = 'SMTP credentials are not configured. EMAIL_USER and EMAIL_PASS are required.';
    logger.error('mail-campaign.email.config.invalid', { message });
    return {
      totalRecipients: recipients.length,
      successfullySent: 0,
      failed: recipients.length,
      results: recipients.map((recipient) => ({
        recipientEmail: recipient,
        status: 'Failed',
        messageId: '',
        errorMessage: message,
      })),
    };
  }

  if (!recipients.length) {
    return {
      totalRecipients: 0,
      successfullySent: 0,
      failed: 0,
      results: [],
    };
  }

  const transporter = createTransporter();

  try {
    await transporter.verify();
    logger.info('mail-campaign.email.smtp.verified', { smtpUser });
  } catch (error) {
    logger.error('mail-campaign.email.smtp.verify.failed', {
      smtpUser,
      error: error?.message || 'Unknown SMTP verify error',
      stack: error?.stack,
    });

    return {
      totalRecipients: recipients.length,
      successfullySent: 0,
      failed: recipients.length,
      results: recipients.map((recipient) => ({
        recipientEmail: recipient,
        status: 'Failed',
        messageId: '',
        errorMessage: error?.message || 'SMTP verification failed',
      })),
    };
  }

  const results = [];

  for (const recipient of recipients) {
    try {
      const mailOptions = {
        from: `${fromName} <${smtpUser}>`,
        to: recipient,
        subject,
        text: text || 'Email from CRM Mail Campaign',
        html: html || '<p>Email from CRM Mail Campaign</p>',
        attachments: attachments.map((attachment) => {
          const attachmentPath = attachment.path || attachment.filename || '';
          return {
            filename: attachment.filename || attachment.originalname || path.basename(attachmentPath) || 'attachment',
            path: attachmentPath,
            contentType: attachment.mimetype,
          };
        }),
      };

      const info = await transporter.sendMail(mailOptions);
      results.push({
        recipientEmail: recipient,
        status: 'Sent',
        messageId: info.messageId,
        errorMessage: '',
      });
    } catch (error) {
      logger.error('mail-campaign.email.send.failed', {
        recipient,
        error: error?.message || 'Unknown email sending error',
        stack: error?.stack,
      });
      results.push({
        recipientEmail: recipient,
        status: 'Failed',
        messageId: '',
        errorMessage: error?.response || error?.message || 'Unknown email sending error',
      });
    }
  }

  const successfullySent = results.filter((item) => item.status === 'Sent').length;
  const failed = results.filter((item) => item.status === 'Failed').length;

  logger.info('mail-campaign.email.send.complete', {
    smtpUser,
    totalRecipients: recipients.length,
    successfullySent,
    failed,
  });

  return {
    totalRecipients: recipients.length,
    successfullySent,
    failed,
    results,
  };
};

module.exports = {
  sendCampaignEmails,
};
