const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    campaignId: { type: String, required: true, index: true },
    campaignName: { type: String, default: '' },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ['Sent', 'Failed'],
      default: 'Failed',
    },
    sentAt: { type: Date, default: Date.now },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

emailLogSchema.index({ campaignId: 1, recipientEmail: 1, sentAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
