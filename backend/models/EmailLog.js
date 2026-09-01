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
    senderEmail: { type: String, default: '', trim: true, lowercase: true },
    trackingToken: { type: String, default: '', unique: true, sparse: true, index: true },
    openedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailLogSchema.index({ campaignId: 1, recipientEmail: 1, sentAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
