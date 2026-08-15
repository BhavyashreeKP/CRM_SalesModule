const mongoose = require('mongoose');

const mailCampaignSchema = new mongoose.Schema(
  {
    campaignId: { type: String, required: true, unique: true },
    campaignName: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    campaignType: { type: String, default: 'Promotional' },
    priority: { type: String, default: 'Medium' },
    imageAlignment: { type: String, default: 'Image Before Text' },
    tags: [{ type: String }],
    recipientModules: [{ type: String }],
    recipientGroup: [{ type: String }],
    recipientEmails: [{ type: String }],
    recipientCount: { type: Number, default: 0 },
    campaignBody: { type: String, default: '' },
    footer: { type: String, default: '' },
    image: { type: String, default: '' },
    attachments: [{ type: String }],
    status: { type: String, enum: ['Draft', 'Scheduled', 'Sending', 'Sent', 'Partially Sent', 'Failed', 'Trash'], default: 'Draft' },
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    createdBy: { type: String, default: 'Admin' },
    createdDate: { type: String, default: '' },
    scheduledDate: { type: String, default: '' },
    scheduledTime: { type: String, default: '' },
    timezone: { type: String, default: 'UTC' },
    sentDate: { type: String, default: '' },
    testEmail: { type: String, default: '' },
    deliveryResults: [{ recipientEmail: String, status: String, messageId: String, errorMessage: String, sentAt: { type: Date, default: Date.now } }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

mailCampaignSchema.index({ campaignName: 'text', subject: 'text', status: 1, createdBy: 1, createdAt: -1 });
mailCampaignSchema.index({ recipientGroup: 1, status: 1, createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('MailCampaign', mailCampaignSchema);
