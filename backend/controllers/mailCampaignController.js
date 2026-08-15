const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const multer = require('multer');
const mongoose = require('mongoose');
const MailCampaign = require('../models/MailCampaign');
const EmailLog = require('../models/EmailLog');
const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const Lead = require('../models/Lead');
const Supplier = require('../models/Supplier');
const { sendCampaignEmails } = require('../services/emailService');
const logger = require('../utils/logger');

let Employee = null;
try {
  Employee = require('../models/Employee');
} catch (_error) {
  Employee = null;
}

const uploadDir = path.join(__dirname, '../uploads/mail-campaigns');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  const attachmentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-7z-compressed',
  ];
  const allowedTypes = file.fieldname === 'image' ? imageTypes : attachmentTypes;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

const uploads = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'attachments', maxCount: 10 },
]);

const sanitize = (value = '') => sanitizeHtml(value, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'span', 'font']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'title'] } });

const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [parsed].filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const normalizeCampaign = (campaign) => ({
  ...campaign,
  _id: campaign._id?.toString(),
  recipientModules: campaign.recipientModules || [],
  recipientGroup: campaign.recipientGroup || [],
  recipientEmails: campaign.recipientEmails || [],
  attachments: campaign.attachments || [],
  image: campaign.image || '',
  tags: campaign.tags || [],
  deliveryResults: campaign.deliveryResults || [],
});

// const getNextCampaignId = async () => {
//   const counter = await Counter.findOneAndUpdate(
//     { name: 'mailCampaign' },
//     { $inc: { value: 1 } },
//     { new: true, upsert: true, setDefaultsOnInsert: true }
//   );

//   if (!counter || typeof counter.value !== 'number') {
//     throw new Error('Failed to generate campaign ID sequence');
//   }

//   return `CMP-${String(counter.value).padStart(6, '0')}`;
// };

const getNextCampaignId = async () => {
  // Get the highest campaign ID already stored
  const lastCampaign = await MailCampaign.findOne(
    { campaignId: { $exists: true } },
    { campaignId: 1 }
  )
    .sort({ campaignId: -1 })
    .lean();

  let highestNumber = 0;

  if (lastCampaign?.campaignId) {
    highestNumber = parseInt(
      lastCampaign.campaignId.replace("CMP-", ""),
      10
    ) || 0;
  }

  // Get or create the counter
  let counter = await Counter.findOne({ name: "mailCampaign" });

  if (!counter) {
    counter = await Counter.create({
      name: "mailCampaign",
      value: highestNumber,
    });
  }

  // If the counter is behind the database, repair it
  if (counter.value < highestNumber) {
    counter.value = highestNumber;
    await counter.save();
  }

  // Generate the next ID atomically
  counter = await Counter.findOneAndUpdate(
    { name: "mailCampaign" },
    { $inc: { value: 1 } },
    { new: true }
  );

  return `CMP-${String(counter.value).padStart(6, "0")}`;
};

const isValidEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const getEmailList = async (Model, fieldName, filter = {}) => {
  if (!Model) return [];
  const docs = await Model.find({ ...filter, [fieldName]: { $regex: validEmailRegex } }).select(fieldName).lean();
  return docs
    .map((doc) => String(doc[fieldName] || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((email, index, arr) => arr.indexOf(email) === index);
};

exports.getRecipientCounts = async (_req, res) => {
  try {
    const [customers, contacts, leads, suppliers, employees] = await Promise.all([
      Customer.countDocuments({ email: { $regex: validEmailRegex } }),
      Contact.countDocuments({ email: { $regex: validEmailRegex } }),
      Lead.countDocuments({ email: { $regex: validEmailRegex } }),
      Supplier.countDocuments({ emailId: { $regex: validEmailRegex } }),
      Employee ? Employee.countDocuments({ email: { $regex: validEmailRegex } }) : 0,
    ]);

    res.status(200).json({
      success: true,
      data: {
        Customers: customers,
        Contacts: contacts,
        Leads: leads,
        Suppliers: suppliers,
        Employees: employees,
      },
    });
  } catch (error) {
    console.error('Failed to load recipient counts:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load recipient counts.' });
  }
};

exports.getRecipientData = async (req, res) => {
  try {
    const requestedModules = String(req.query.modules || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const selectedModules = requestedModules.length ? requestedModules : ['Customers', 'Contacts', 'Leads', 'Suppliers', 'Employees'];
    const data = {};

    for (const moduleName of selectedModules) {
      if (moduleName === 'Customers') {
        data[moduleName] = await getEmailList(Customer, 'email');
      } else if (moduleName === 'Contacts') {
        data[moduleName] = await getEmailList(Contact, 'email');
      } else if (moduleName === 'Leads') {
        data[moduleName] = await getEmailList(Lead, 'email');
      } else if (moduleName === 'Suppliers') {
        data[moduleName] = await getEmailList(Supplier, 'emailId');
      } else if (moduleName === 'Employees' && Employee) {
        data[moduleName] = await getEmailList(Employee, 'email');
      } else {
        data[moduleName] = [];
      }
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to load recipient details:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load recipient details.' });
  }
};

exports.uploads = uploads;

exports.getCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      status = '',
      recipientGroup = '',
      createdBy = '',
    } = req.query;
    const query = { deletedAt: null };

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { campaignName: regex },
        { campaignId: regex },
        { subject: regex },
        { recipientGroup: regex },
      ];
    }

    if (status) query.status = status;
    if (recipientGroup) query.recipientGroup = new RegExp(`^${recipientGroup}$`, 'i');
    if (createdBy) query.createdBy = new RegExp(`^${createdBy}$`, 'i');

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const projection = {
      campaignId: 1,
      campaignName: 1,
      subject: 1,
      campaignType: 1,
      priority: 1,
      recipientGroup: 1,
      recipientEmails: 1,
      recipientCount: 1,
      status: 1,
      createdBy: 1,
      createdDate: 1,
      scheduledDate: 1,
      scheduledTime: 1,
      opens: 1,
      clicks: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [campaigns, total] = await Promise.all([
      MailCampaign.find(query, projection).sort({ [sortBy]: sortDirection }).skip(skip).limit(limitNum).lean(),
      MailCampaign.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: campaigns.map(normalizeCampaign),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.status(200).json({ success: true, data: normalizeCampaign(campaign) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const recipientEmails = parseArrayField(req.body.recipientEmails);
    if (!req.body.campaignName || !req.body.subject || recipientEmails.length === 0 || !req.body.campaignBody || !req.body.footer) {
      return res.status(400).json({ success: false, message: 'Please fill out all required fields.' });
    }

    const campaignId = await getNextCampaignId();
    const payload = {
      campaignId,
      campaignName: req.body.campaignName || '',
      subject: req.body.subject || '',
      campaignType: req.body.campaignType || 'Promotional',
      priority: req.body.priority || 'Medium',
      imageAlignment: req.body.imageAlignment || 'Image Before Text',
      tags: parseArrayField(req.body.tags),
      recipientModules: parseArrayField(req.body.recipientModules),
      recipientGroup: parseArrayField(req.body.recipientGroup),
      recipientEmails,
      recipientCount: Number(req.body.recipientCount || recipientEmails.length),
      campaignBody: sanitize(req.body.campaignBody || ''),
      footer: sanitize(req.body.footer || ''),
      image: req.files?.image?.[0]?.filename ? `/uploads/mail-campaigns/${req.files.image[0].filename}` : req.body.image || '',
      attachments: (req.files?.attachments || []).map((file) => `/uploads/mail-campaigns/${file.filename}`),
      status: req.body.status || 'Draft',
      createdBy: req.body.createdBy || process.env.DEFAULT_CREATED_BY || 'Admin',
      createdDate: req.body.createdDate || new Date().toISOString().split('T')[0],
      scheduledDate: req.body.scheduledDate || '',
      scheduledTime: req.body.scheduledTime || '',
      timezone: req.body.timezone || 'UTC',
      sentDate: req.body.sentDate || '',
      testEmail: req.body.testEmail || '',
    };

    const campaign = await MailCampaign.create(payload);

    logger.info('mail-campaign.created', {
      campaignId,
      campaignName: payload.campaignName,
      recipientCount: payload.recipientCount,
      recipientEmails: payload.recipientEmails,
      status: payload.status,
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', data: normalizeCampaign(campaign.toObject()) });
  } catch (error) {
    logger.error('mail-campaign.createCampaign.failed', {
      message: error?.message,
      stack: error?.stack,
    });
    const message = error?.code === 11000 ? 'A campaign with this ID already exists. Please retry.' : error.message || 'Failed to create campaign.';
    res.status(500).json({ success: false, message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const existing = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null });
    if (!existing) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const recipientEmails = parseArrayField(req.body.recipientEmails || existing.recipientEmails);
    const payload = {
      campaignName: req.body.campaignName || existing.campaignName || '',
      subject: req.body.subject || existing.subject || '',
      campaignType: req.body.campaignType || existing.campaignType || 'Promotional',
      priority: req.body.priority || existing.priority || 'Medium',
      imageAlignment: req.body.imageAlignment || existing.imageAlignment || 'Image Before Text',
      tags: parseArrayField(req.body.tags || existing.tags),
      recipientModules: parseArrayField(req.body.recipientModules || existing.recipientModules),
      recipientGroup: parseArrayField(req.body.recipientGroup || existing.recipientGroup),
      recipientEmails,
      recipientCount: Number(req.body.recipientCount || existing.recipientCount || recipientEmails.length),
      campaignBody: sanitize(req.body.campaignBody || existing.campaignBody || ''),
      footer: sanitize(req.body.footer || existing.footer || ''),
      image: req.files?.image?.[0]?.filename ? `/uploads/mail-campaigns/${req.files.image[0].filename}` : req.body.image || existing.image || '',
      attachments: (req.files?.attachments || []).length > 0
        ? (req.files?.attachments || []).map((file) => `/uploads/mail-campaigns/${file.filename}`)
        : (req.body.attachments ? parseArrayField(req.body.attachments) : existing.attachments || []),
      status: req.body.status || existing.status || 'Draft',
      createdBy: req.body.createdBy || existing.createdBy || process.env.DEFAULT_CREATED_BY || 'Admin',
      createdDate: req.body.createdDate || existing.createdDate || new Date().toISOString().split('T')[0],
      scheduledDate: req.body.scheduledDate || existing.scheduledDate || '',
      scheduledTime: req.body.scheduledTime || existing.scheduledTime || '',
      timezone: req.body.timezone || existing.timezone || 'UTC',
      sentDate: req.body.sentDate || existing.sentDate || '',
      testEmail: req.body.testEmail || existing.testEmail || '',
    };

    if (!payload.campaignName || !payload.subject || payload.recipientEmails.length === 0 || !payload.campaignBody || !payload.footer) {
      return res.status(400).json({ success: false, message: 'Please fill out all required fields.' });
    }

    const campaign = await MailCampaign.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Campaign updated successfully', data: normalizeCampaign(campaign.toObject()) });
  } catch (error) {
    console.error('[mail-campaign] updateCampaign failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update campaign.' });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await MailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    campaign.deletedAt = new Date();
    campaign.status = 'Trash';
    await campaign.save();
    res.status(200).json({ success: true, message: 'Campaign moved to trash' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await MailCampaign.findOne({ _id: id, deletedAt: null });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    let recipients = [];
    if (Array.isArray(req.body?.recipients) && req.body.recipients.length) {
      recipients = req.body.recipients;
    } else if (typeof req.body?.recipients === 'string' && req.body.recipients.trim()) {
      recipients = req.body.recipients.split(',').map((item) => item.trim()).filter(Boolean);
    } else {
      recipients = campaign.recipientEmails || [];
    }

    const normalizedRecipients = [...new Set(recipients.map((item) => String(item).trim()).filter(Boolean))];

    if (!normalizedRecipients.length) {
      return res.status(400).json({ success: false, message: 'No recipients found for this campaign.' });
    }

    campaign.status = 'Sending';
    campaign.recipientCount = normalizedRecipients.length;
    await campaign.save();

    const htmlBody = campaign.campaignBody || '<p>Campaign email</p>';
    const report = await sendCampaignEmails({
      subject: campaign.subject,
      html: `${htmlBody}${campaign.footer ? `<div>${campaign.footer}</div>` : ''}`,
      text: campaign.footer || campaign.subject,
      to: normalizedRecipients,
      attachments: (campaign.attachments || []).map((attachmentPath) => ({
        path: path.join(__dirname, '..', attachmentPath.replace(/^[\/]+/, '')),
      })),
      fromName: process.env.MAIL_FROM_NAME || 'CRM Mail Campaign',
    });

    const sentCount = report.results.filter((item) => item.status === 'Sent').length;
    const failedCount = report.results.filter((item) => item.status === 'Failed').length;

    const emailLogs = report.results.map((item) => ({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      recipientEmail: item.recipientEmail,
      status: item.status,
      sentAt: new Date(),
      errorMessage: item.errorMessage || '',
    }));

    await EmailLog.insertMany(emailLogs);

    if (failedCount === 0) {
      campaign.status = 'Sent';
    } else if (sentCount > 0) {
      campaign.status = 'Partially Sent';
    } else {
      campaign.status = 'Failed';
    }

    campaign.sentDate = new Date().toISOString();
    campaign.recipientCount = normalizedRecipients.length;
    campaign.deliveryResults = report.results;
    campaign.opens = Number(campaign.opens || 0);
    campaign.clicks = Number(campaign.clicks || 0);
    await campaign.save();

    logger.info('mail-campaign.send', {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      recipientCount: normalizedRecipients.length,
      successfullySent: report.successfullySent,
      failed: report.failed,
      status: campaign.status,
    });

    res.status(200).json({
      success: true,
      message: campaign.status === 'Sent' ? 'Campaign Sent Successfully' : campaign.status === 'Partially Sent' ? 'Campaign Partially Sent' : 'Campaign Failed',
      data: {
        campaignId: campaign.campaignId,
        totalRecipients: report.totalRecipients,
        successfullySent: report.successfullySent,
        failed: report.failed,
        results: report.results,
        status: campaign.status,
      },
    });
  } catch (error) {
    console.error('[mail-campaign] sendCampaign failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send campaign email.', details: error?.response || error?.stack || '' });
  }
};
