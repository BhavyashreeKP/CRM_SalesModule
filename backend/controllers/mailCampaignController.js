const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const multer = require('multer');
const mongoose = require('mongoose');
const MailCampaign = require('../models/MailCampaign');
const EmailLog = require('../models/EmailLog');
const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const CompanyProfile = require('../models/CompanyProfile');
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
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per uploaded file
    fieldSize: 5 * 1024 * 1024,  // 5 MB for text fields such as campaign body
    files: 11,                   // 1 image + up to 10 attachments
  },
  fileFilter,
});

const uploads = (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
  ])(req, res, (error) => {
    if (error) {
      console.error('========== CAMPAIGN UPLOAD ERROR ==========');
      console.error('Name:', error.name);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Field:', error.field);
      console.error('============================================');

      return res.status(400).json({
        success: false,
        message: error.message || 'Campaign file upload failed.',
        errorCode: error.code || 'UPLOAD_ERROR',
        field: error.field || null,
      });
    }

    next();
  });
};
const sanitize = (value = '') => sanitizeHtml(value, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'span', 'font']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style'], img: ['src', 'alt', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]*\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]*\)$/i],
      'font-size': [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/i],
      'font-weight': [/^(?:normal|bold|[1-9]00)$/i],
      'text-align': [/^(?:left|center|right|justify)$/i],
      'text-decoration': [/^(?:none|underline|line-through)$/i],
    },
  },
});

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

const parseCampaignGroups = (value) => {
  if (!value) return [];
  const rawGroups = Array.isArray(value) ? value : typeof value === 'string' ? (() => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })() : [];

  return rawGroups.map((group, index) => {
    const contactIds = Array.isArray(group?.contactIds) ? group.contactIds.map((id) => String(id)).filter(Boolean) : [];
    const recipientEmails = Array.isArray(group?.recipientEmails) ? group.recipientEmails.map((item) => String(item).trim()).filter(Boolean) : [];
    const cleanGroup = {
      groupName: String(group?.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
      contactIds: [...new Set(contactIds)],
      subject: String(group?.subject || '').trim(),
      message: String(group?.message || '').trim(),
      status: group?.status || 'Draft',
      recipientEmails: [...new Set(recipientEmails)],
      sentDate: group?.sentDate || '',
      deliveryResults: Array.isArray(group?.deliveryResults) ? group.deliveryResults : [],
    };
    return cleanGroup;
  });
};

const resolveContactRecipients = async (groups) => {
  const requestedContactIds = [...new Set(groups.flatMap((group) => group.contactIds).filter(Boolean))];
  const contactIds = requestedContactIds.filter((id) => mongoose.isValidObjectId(id));
  if (requestedContactIds.length && contactIds.length !== requestedContactIds.length) {
    const error = new Error('One or more Contact identifiers are invalid.');
    error.name = 'CastError';
    throw error;
  }
  const contactQuery = contactIds.length
    ? { _id: { $in: contactIds }, email: { $regex: validEmailRegex } }
    : { email: { $regex: validEmailRegex } };
  const contacts = await Contact.find(contactQuery).select('_id email').lean();
  const emailByContactId = new Map(contacts.map((contact) => [String(contact._id), String(contact.email).trim().toLowerCase()]));

  return groups.map((group) => {
      const validContactIds = requestedContactIds.length
      ? group.contactIds.filter((id) => emailByContactId.has(String(id)))
      : contacts.map((contact) => String(contact._id));
    return {
      ...group,
      contactIds: validContactIds,
      recipientEmails: [...new Set(validContactIds.map((id) => emailByContactId.get(String(id))).filter(Boolean))],
    };
  });
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
  campaignGroups: Array.isArray(campaign.campaignGroups) ? campaign.campaignGroups.map((group) => ({
    ...group,
    _id: group._id ? group._id.toString() : undefined,
    contactIds: Array.isArray(group.contactIds) ? group.contactIds.map((id) => String(id)) : [],
    recipientEmails: Array.isArray(group.recipientEmails) ? group.recipientEmails : [],
    deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
  })) : [],
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
  const campaignIds = await MailCampaign.find({ campaignId: /^CMP-\d+$/ }, { campaignId: 1 }).lean();
  const highestNumber = campaignIds.reduce((highest, campaign) => Math.max(highest, Number(campaign.campaignId.slice(4)) || 0), 0);

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

  return `CMP-${counter.value}`;
};

const isValidEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const respondToDatabaseError = (res, error, fallback) => {
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: 'A campaign with this ID already exists. Please retry.' });
  }
  if (error?.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Campaign data is invalid. Check the required fields and values.' });
  }
  if (error?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Campaign or Contact identifier is invalid.' });
  }
  logger.error('mail-campaign.database.failed', { message: error?.message, stack: error?.stack, fallback });
  return res.status(500).json({ success: false, message: fallback });
};

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

    const campaignIds = campaigns.map((campaign) => campaign.campaignId);
    const openCounts = await EmailLog.aggregate([
      { $match: { campaignId: { $in: campaignIds }, openedAt: { $ne: null } } },
      { $group: { _id: '$campaignId', recipients: { $addToSet: '$recipientEmail' } } },
      { $project: { _id: 1, count: { $size: '$recipients' } } },
    ]);
    const openCountByCampaign = new Map(openCounts.map((item) => [item._id, item.count]));

    res.status(200).json({
      success: true,
      data: campaigns.map((campaign) => normalizeCampaign({
        ...campaign,
        opens: openCountByCampaign.get(campaign.campaignId) || 0,
      })),
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
    respondToDatabaseError(res, error, 'Unable to load campaign.');
  }
};

const buildPublicTrackingBaseUrl = (req) => {
  const configuredBaseUrl = process.env.PUBLIC_API_URL || process.env.APP_URL || process.env.BACKEND_URL || process.env.BASE_URL || '';
  const forwardedProto = (req.headers && req.headers['x-forwarded-proto']) || req.protocol || 'https';
  const forwardedHost = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || req.get('host') || '';
  const rawBaseUrl = configuredBaseUrl || `${Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto}://${Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost}`;
  const normalizedBaseUrl = String(rawBaseUrl)
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');

  return normalizedBaseUrl;
};

const getTrackingBaseUrl = (req) => buildPublicTrackingBaseUrl(req);

const buildTrackingPixelUrl = (baseUrl, trackingId) => `${baseUrl}/api/mail-campaigns/open/${trackingId}`;

const buildCampaignEmailHtml = ({ htmlBody, footer, logoHtml }) => `<div style="margin: 0; padding: 0; color: #1f2937; font-family: 'Times New Roman', Times, serif !important; font-size: 16px; line-height: 1.5;"><style>div, p, h1, h2, h3, span, li { font-family: 'Times New Roman', Times, serif !important; } p { margin: 0 0 16px; min-height: 1.5em; } img { width: auto; max-width: 100%; height: auto; }</style>${logoHtml}${htmlBody}${footer ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-family: 'Times New Roman', Times, serif !important;">${footer}</div>` : ''}</div>`;

const addEmailTracking = (html, campaignId, trackingId, baseUrl) => {
  const trackedHtml = String(html || '').replace(/href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote, destination) => (
    `href=${quote}${baseUrl}/api/mail-campaigns/tracking/click/${trackingId}?url=${encodeURIComponent(destination)}${quote}`
  ));
  const trackingPixelUrl = buildTrackingPixelUrl(baseUrl, trackingId);
  return `${trackedHtml}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" />`;
};

const syncCampaignOpenCount = async (campaignId) => {
  const openedRecipients = await EmailLog.distinct('recipientEmail', {
    campaignId,
    openedAt: { $ne: null },
  });
  await MailCampaign.updateOne({ campaignId }, { $set: { opens: openedRecipients.length } });
};

exports.trackOpen = async (req, res) => {
  const trackingId = String(req.params.trackingId || req.params.token || '').trim();

  try {
    const log = await EmailLog.findOne({
      $or: [{ trackingId }, { trackingToken: trackingId }],
    }).select('campaignId campaignName recipientEmail openedAt trackingId trackingToken').lean();

    if (log) {
      const wasAlreadyOpened = !!log.openedAt;
      if (!wasAlreadyOpened) {
        await EmailLog.updateOne(
          {
            $or: [{ trackingId }, { trackingToken: trackingId }],
            openedAt: null,
          },
          {
            $set: {
              openedAt: new Date(),
              trackingId: log.trackingId || trackingId,
              trackingToken: log.trackingToken || trackingId,
            },
          }
        );
      }
      await syncCampaignOpenCount(log.campaignId);
      logger.info('EMAIL OPEN TRACKED', {
        campaignId: log.campaignId,
        campaignName: log.campaignName,
        recipientEmail: log.recipientEmail,
        trackingId,
        uniqueOpen: !wasAlreadyOpened,
      });
    } else {
      logger.info('mail-campaign.track-open.unknown-token', { trackingId });
    }
  } catch (error) {
    logger.error('mail-campaign.track-open.failed', { trackingId, message: error?.message, stack: error?.stack });
  }

  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.type('gif').send(Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'));
};

exports.trackClick = async (req, res) => {
  const destination = String(req.query.url || '');
  if (!/^https?:\/\//i.test(destination)) return res.status(400).json({ success: false, message: 'Tracked destination is invalid.' });
  try {
    const result = await EmailLog.updateOne(
      { trackingToken: req.params.token, clickedAt: null },
      { $set: { clickedAt: new Date() } }
    );
    if (result.modifiedCount) {
      const log = await EmailLog.findOne({ trackingToken: req.params.token }).select('campaignId').lean();
      if (log) await MailCampaign.updateOne({ campaignId: log.campaignId }, { $inc: { clicks: 1 } });
    }
  } catch (error) {
    logger.error('mail-campaign.track-click.failed', { message: error?.message, stack: error?.stack });
  }
  return res.redirect(destination);
};

exports.getCampaignReport = async (req, res) => {
  try {
    const campaign = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null }).select('campaignId campaignName subject').lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const logs = await EmailLog.find({ campaignId: campaign.campaignId }).sort({ sentAt: 1 }).lean();
    res.status(200).json({
      success: true,
      data: logs.map((log, index) => ({
        serialNumber: index + 1,
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        sentBy: log.senderEmail || process.env.EMAIL_USER || process.env.SMTP_USER || '',
        sentTo: log.recipientEmail,
        subject: campaign.subject,
        opens: log.openedAt ? 1 : 0,
        clicks: log.clickedAt ? 1 : 0,
      })),
    });
  } catch (error) {
    logger.error('mail-campaign.report.failed', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Unable to load the campaign report.' });
  }
};

exports.getCampaignPreview = async (req, res) => {
  try {
    const campaign = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const companyProfile = await CompanyProfile.findOne().sort({ createdAt: -1 }).select('companyLogo').lean();
    const logoPath = companyProfile?.companyLogo?.filePath || '';
    const logoUrl = logoPath ? `${getTrackingBaseUrl(req)}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}` : '';
    const imageBeforeText = ['Image Before Text', 'Image Above Text'].includes(campaign.imageAlignment);
    const logoHtml = logoUrl
      ? `<p style="margin: 0 0 20px; min-height: 1.5em;"><img src="${logoUrl}" alt="Company logo" style="display: block; width: 120px; max-width: 120px; height: auto;" /></p>`
      : '';
    const htmlBody = imageBeforeText ? `${logoHtml}${campaign.campaignBody || '<p>Campaign email</p>'}` : `${campaign.campaignBody || '<p>Campaign email</p>'}${logoHtml}`;
    const logs = await EmailLog.find({ campaignId: campaign.campaignId }).sort({ sentAt: -1 }).select('recipientEmail senderEmail').lean();
    res.status(200).json({
      success: true,
      data: {
        from: logs[0]?.senderEmail || process.env.EMAIL_USER || process.env.SMTP_USER || '',
        to: logs[0]?.recipientEmail || campaign.recipientEmails?.[0] || '',
        subject: campaign.subject,
        html: buildCampaignEmailHtml({ htmlBody, footer: campaign.footer, logoHtml: '' }),
      },
    });
  } catch (error) {
    logger.error('mail-campaign.preview.failed', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Unable to load the campaign email preview.' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const incomingGroups = parseCampaignGroups(req.body.campaignGroups);
    const recipientEmails = parseArrayField(req.body.recipientEmails);
    const legacyGroups = incomingGroups.length ? incomingGroups : [{
      groupName: 'Campaign Group 1',
      contactIds: parseArrayField(req.body.contactIds),
      subject: req.body.subject || '',
      message: req.body.campaignBody || '',
      status: req.body.status || 'Draft',
      recipientEmails,
    }];
    const finalGroups = legacyGroups.map((group, index) => ({
      groupName: String(group.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
      contactIds: Array.isArray(group.contactIds) ? group.contactIds.map((id) => String(id)).filter(Boolean) : [],
      subject: String(group.subject || req.body.subject || '').trim(),
      message: sanitize(String(group.message || req.body.campaignBody || '')),
      status: group.status || req.body.status || 'Draft',
      recipientEmails: [...new Set((Array.isArray(group.recipientEmails) ? group.recipientEmails : recipientEmails).map((item) => String(item).trim()).filter(Boolean))],
      sentDate: group.sentDate || '',
      deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
    }));

    const resolvedGroups = await resolveContactRecipients(finalGroups);
    const flattenedRecipientEmails = [...new Set(resolvedGroups.flatMap((group) => group.recipientEmails))];
    const campaignStatus = req.body.status || 'Draft';

    if (!req.body.campaignName?.trim()) {
      return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    }
    if (!req.body.subject?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required.' });
    }
    if (!flattenedRecipientEmails.length && campaignStatus !== 'Draft') {
      return res.status(400).json({ success: false, message: 'No Contacts with valid email addresses are available for this campaign.' });
    }
    if (campaignStatus === 'Scheduled' && (!req.body.scheduledDate || !req.body.scheduledTime)) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required.' });
    }

    const campaignId = await getNextCampaignId();
    const payload = {
      campaignId,
      campaignName: req.body.campaignName || '',
      subject: finalGroups[0]?.subject || req.body.subject || '',
      campaignType: req.body.campaignType || 'Promotional',
      priority: req.body.priority || 'Medium',
      imageAlignment: req.body.imageAlignment || 'Image Before Text',
      tags: parseArrayField(req.body.tags),
      recipientModules: parseArrayField(req.body.recipientModules),
      recipientGroup: parseArrayField(req.body.recipientGroup),
      recipientEmails: flattenedRecipientEmails,
      recipientCount: flattenedRecipientEmails.length,
      campaignBody: sanitize(req.body.campaignBody || finalGroups[0]?.message || ''),
      footer: sanitize(req.body.footer || ''),
      image: req.files?.image?.[0]?.filename ? `/uploads/mail-campaigns/${req.files.image[0].filename}` : req.body.image || '',
      attachments: (req.files?.attachments || []).map((file) => `/uploads/mail-campaigns/${file.filename}`),
      status: campaignStatus,
      createdBy: req.body.createdBy || process.env.DEFAULT_CREATED_BY || 'Admin',
      createdDate: req.body.createdDate || new Date().toISOString().split('T')[0],
      scheduledDate: req.body.scheduledDate || '',
      scheduledTime: req.body.scheduledTime || '',
      timezone: req.body.timezone || 'UTC',
      sentDate: req.body.sentDate || '',
      testEmail: req.body.testEmail || '',
      campaignGroups: resolvedGroups,
    };

    console.log({
      campaignNameLength: payload.campaignName?.length,
      subjectLength: payload.subject?.length,
      campaignBodyLength: payload.campaignBody?.length,
      footerLength: payload.footer?.length,
      imageLength: payload.image?.length,
      recipientCount: payload.recipientEmails?.length,
    });

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
    respondToDatabaseError(res, error, 'Unable to create campaign due to an unexpected database error.');
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const existing = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null });
    if (!existing) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const incomingGroups = parseCampaignGroups(req.body.campaignGroups);
    const recipientEmails = parseArrayField(req.body.recipientEmails || existing.recipientEmails);
    const legacyGroups = incomingGroups.length ? incomingGroups : [{
      groupName: 'Campaign Group 1',
      contactIds: parseArrayField(req.body.contactIds),
      subject: req.body.subject || existing.subject || '',
      message: req.body.campaignBody || existing.campaignBody || '',
      status: req.body.status || existing.status || 'Draft',
      recipientEmails,
    }];
    const finalGroups = legacyGroups.map((group, index) => ({
      groupName: String(group.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
      contactIds: Array.isArray(group.contactIds) ? group.contactIds.map((id) => String(id)).filter(Boolean) : [],
      subject: String(group.subject || req.body.subject || existing.subject || '').trim(),
      message: sanitize(String(group.message || req.body.campaignBody || existing.campaignBody || '')),
      status: group.status || req.body.status || existing.status || 'Draft',
      recipientEmails: [...new Set((Array.isArray(group.recipientEmails) ? group.recipientEmails : recipientEmails).map((item) => String(item).trim()).filter(Boolean))],
      sentDate: group.sentDate || existing.sentDate || '',
      deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
    }));

    const resolvedGroups = await resolveContactRecipients(finalGroups);
    const flattenedRecipientEmails = [...new Set(resolvedGroups.flatMap((group) => group.recipientEmails))];
    const campaignStatus = req.body.status || existing.status || 'Draft';

    const payload = {
      campaignName: req.body.campaignName || existing.campaignName || '',
      subject: finalGroups[0]?.subject || req.body.subject || existing.subject || '',
      campaignType: req.body.campaignType || existing.campaignType || 'Promotional',
      priority: req.body.priority || existing.priority || 'Medium',
      imageAlignment: req.body.imageAlignment || existing.imageAlignment || 'Image Before Text',
      tags: parseArrayField(req.body.tags || existing.tags),
      recipientModules: parseArrayField(req.body.recipientModules || existing.recipientModules),
      recipientGroup: parseArrayField(req.body.recipientGroup || existing.recipientGroup),
      recipientEmails: flattenedRecipientEmails,
      recipientCount: flattenedRecipientEmails.length,
      campaignBody: sanitize(req.body.campaignBody || finalGroups[0]?.message || existing.campaignBody || ''),
      footer: sanitize(req.body.footer || existing.footer || ''),
      image: req.files?.image?.[0]?.filename ? `/uploads/mail-campaigns/${req.files.image[0].filename}` : req.body.image || existing.image || '',
      attachments: (req.files?.attachments || []).length > 0
        ? (req.files?.attachments || []).map((file) => `/uploads/mail-campaigns/${file.filename}`)
        : (req.body.attachments ? parseArrayField(req.body.attachments) : existing.attachments || []),
      status: campaignStatus,
      createdBy: req.body.createdBy || existing.createdBy || process.env.DEFAULT_CREATED_BY || 'Admin',
      createdDate: req.body.createdDate || existing.createdDate || new Date().toISOString().split('T')[0],
      scheduledDate: req.body.scheduledDate || existing.scheduledDate || '',
      scheduledTime: req.body.scheduledTime || existing.scheduledTime || '',
      timezone: req.body.timezone || existing.timezone || 'UTC',
      sentDate: req.body.sentDate || existing.sentDate || '',
      testEmail: req.body.testEmail || existing.testEmail || '',
      campaignGroups: resolvedGroups,
    };

    if (!payload.campaignName || !resolvedGroups.length || (campaignStatus !== 'Draft' && !flattenedRecipientEmails.length)) {
      return res.status(400).json({ success: false, message: 'Please select at least one contact with a valid email address.' });
    }
    if (campaignStatus === 'Scheduled' && (!payload.scheduledDate || !payload.scheduledTime)) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required.' });
    }

    const campaign = await MailCampaign.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Campaign updated successfully', data: normalizeCampaign(campaign.toObject()) });
  } catch (error) {
    console.error('[mail-campaign] updateCampaign failed:', error);
    respondToDatabaseError(res, error, 'Unable to update campaign due to an unexpected database error.');
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const identifier = String(req.params.id || '').trim();
    const campaignQuery = mongoose.isValidObjectId(identifier)
      ? { $or: [{ _id: identifier }, { campaignId: identifier }] }
      : { campaignId: identifier };
    const campaign = await MailCampaign.findOne(campaignQuery);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const campaignFiles = [campaign.image, ...(campaign.attachments || [])]
      .filter((filePath) => typeof filePath === 'string' && filePath.startsWith('/uploads/mail-campaigns/'))
      .map((filePath) => path.join(__dirname, '..', filePath.replace(/^\/+/, '')));

    await Promise.all([
      MailCampaign.deleteOne({ _id: campaign._id }),
      EmailLog.deleteMany({ campaignId: campaign.campaignId }),
    ]);
    await Promise.all(campaignFiles.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') logger.error('mail-campaign.file-delete.failed', { message: error.message, campaignId: campaign.campaignId });
      }
    }));

    res.status(200).json({ success: true, message: 'Campaign deleted successfully.' });
  } catch (error) {
    logger.error('mail-campaign.delete.failed', { message: error?.message, stack: error?.stack });
    respondToDatabaseError(res, error, 'Unable to delete campaign.');
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await MailCampaign.findOne({ _id: id, deletedAt: null });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const groupId = req.body?.groupId || req.query?.groupId || '';
    let subject = campaign.subject || '';
    let htmlBody = campaign.campaignBody || '<p>Campaign email</p>';
    let recipients = [];
    let targetGroup = null;

    if (groupId) {
      targetGroup = (campaign.campaignGroups || []).find((group) => String(group._id) === String(groupId) || String(group.groupName) === String(groupId));
      if (!targetGroup) {
        return res.status(404).json({ success: false, message: 'Campaign group not found.' });
      }
      subject = targetGroup.subject || campaign.subject || '';
      htmlBody = targetGroup.message || campaign.campaignBody || '<p>Campaign email</p>';
      const [refreshedGroup] = await resolveContactRecipients([targetGroup]);
      recipients = refreshedGroup.recipientEmails;
      targetGroup.contactIds = refreshedGroup.contactIds;
      targetGroup.recipientEmails = refreshedGroup.recipientEmails;
      targetGroup.status = 'Sending';
      targetGroup.sentDate = '';
      await campaign.save();
    } else {
      const refreshedGroups = await resolveContactRecipients(campaign.campaignGroups || [{ contactIds: [] }]);
      recipients = refreshedGroups.flatMap((group) => group.recipientEmails);
      campaign.campaignGroups = refreshedGroups;
      campaign.recipientEmails = [...new Set(recipients)];
      campaign.status = 'Sending';
      campaign.recipientCount = recipients.length;
      await campaign.save();
    }

    const normalizedRecipients = [...new Set(recipients.map((item) => String(item).trim()).filter(Boolean))];

    if (!normalizedRecipients.length) {
      return res.status(400).json({ success: false, message: 'No recipients found for this campaign group.' });
    }

    const companyProfile = await CompanyProfile.findOne().sort({ createdAt: -1 }).select('companyLogo').lean();
    const logoPath = companyProfile?.companyLogo?.filePath || '';
    const localLogoPath = logoPath ? path.join(__dirname, '..', logoPath.replace(/^\/+/, '')) : '';
    const hasLogo = localLogoPath && fs.existsSync(localLogoPath);
    const logoHtml = hasLogo ? '<p style="margin: 0 0 20px; min-height: 1.5em;"><img src="cid:synov-company-logo" alt="Synov company logo" style="display: block; width: 120px; max-width: 120px; height: auto;" /></p>' : '';
    const imageBeforeText = ['Image Before Text', 'Image Above Text'].includes(campaign.imageAlignment);
    const emailBody = imageBeforeText ? `${logoHtml}${htmlBody}` : `${htmlBody}${logoHtml}`;
    const logoAttachment = hasLogo ? [{
      filename: path.basename(localLogoPath),
      path: localLogoPath,
      cid: 'synov-company-logo',
    }] : [];

    const trackingIds = new Map(normalizedRecipients.map((recipient) => [recipient, crypto.randomBytes(24).toString('hex')]));
    const trackingBaseUrl = getTrackingBaseUrl(req);
    const trackingUrlIsLocal = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i.test(trackingBaseUrl);
    logger.info('mail-campaign.tracking-config', {
      campaignId: campaign.campaignId,
      trackingBaseUrl,
      trackingUrlIsLocal,
      warning: trackingUrlIsLocal ? 'External recipients cannot reach a local tracking URL.' : '',
    });
    const emailLogs = normalizedRecipients.map((recipient) => {
      const trackingId = trackingIds.get(recipient);
      return {
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        recipientEmail: recipient,
        status: 'Failed',
        sentAt: new Date(),
        errorMessage: '',
        senderEmail: process.env.EMAIL_USER || process.env.SMTP_USER || '',
        trackingId,
        trackingToken: trackingId,
      };
    });

    await EmailLog.insertMany(emailLogs);

    const report = await sendCampaignEmails({
      subject,
      html: (recipient) => {
        const trackingId = trackingIds.get(recipient);
        const trackedHtml = addEmailTracking(buildCampaignEmailHtml({ htmlBody: emailBody, footer: campaign.footer, logoHtml: '' }), campaign.campaignId, trackingId, trackingBaseUrl);
        logger.info('mail-campaign.tracking-pixel-injected', {
          campaignId: campaign.campaignId,
          recipientEmail: recipient,
          trackingId,
          trackingPixelUrl: buildTrackingPixelUrl(trackingBaseUrl, trackingId),
          trackingPixelIncluded: trackedHtml.includes(buildTrackingPixelUrl(trackingBaseUrl, trackingId)),
        });
        return trackedHtml;
      },
      text: campaign.footer || subject || 'Campaign email',
      to: normalizedRecipients,
      attachments: (campaign.attachments || []).map((attachmentPath) => ({
        path: path.join(__dirname, '..', attachmentPath.replace(/^[\/]+/, '')),
      })).concat(logoAttachment),
      fromName: process.env.MAIL_FROM_NAME || 'CRM Mail Campaign',
    });

    const sentCount = report.results.filter((item) => item.status === 'Sent').length;
    const failedCount = report.results.filter((item) => item.status === 'Failed').length;

    await Promise.all(report.results.map((item) => EmailLog.updateOne(
      { $or: [{ trackingId: trackingIds.get(item.recipientEmail) }, { trackingToken: trackingIds.get(item.recipientEmail) }] },
      {
        $set: {
          status: item.status,
          sentAt: new Date(),
          errorMessage: item.errorMessage || '',
          trackingId: trackingIds.get(item.recipientEmail),
          trackingToken: trackingIds.get(item.recipientEmail),
        },
      }
    )));

    if (groupId && targetGroup) {
      targetGroup.recipientEmails = normalizedRecipients;
      targetGroup.deliveryResults = report.results;
      targetGroup.sentDate = new Date().toISOString();
      targetGroup.status = failedCount === 0 ? 'Sent' : sentCount > 0 ? 'Partially Sent' : 'Failed';
    } else {
      if (failedCount === 0) {
        campaign.status = 'Sent';
      } else if (sentCount > 0) {
        campaign.status = 'Partially Sent';
      } else {
        campaign.status = 'Failed';
      }
      campaign.sentDate = new Date().toISOString();
      campaign.deliveryResults = report.results;
    }

    campaign.recipientCount = normalizedRecipients.length;
    campaign.opens = Number(campaign.opens || 0);
    campaign.clicks = Number(campaign.clicks || 0);
    await campaign.save();

    logger.info('mail-campaign.send', {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      groupId: groupId || null,
      recipientCount: normalizedRecipients.length,
      successfullySent: report.successfullySent,
      failed: report.failed,
      status: groupId ? (targetGroup ? targetGroup.status : campaign.status) : campaign.status,
    });

    if (failedCount === report.totalRecipients) {
      return res.status(502).json({
        success: false,
        message: 'Campaign was saved, but email delivery failed. Check the mail server configuration and delivery report.',
        data: {
          campaignId: campaign.campaignId,
          groupId: groupId || null,
          totalRecipients: report.totalRecipients,
          successfullySent: report.successfullySent,
          failed: report.failed,
          status: groupId ? (targetGroup ? targetGroup.status : campaign.status) : campaign.status,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: groupId ? 'Campaign group sent successfully.' : (campaign.status === 'Sent' ? 'Campaign Sent Successfully' : campaign.status === 'Partially Sent' ? 'Campaign Partially Sent' : 'Campaign Failed'),
      data: {
        campaignId: campaign.campaignId,
        groupId: groupId || null,
        totalRecipients: report.totalRecipients,
        successfullySent: report.successfullySent,
        failed: report.failed,
        results: report.results,
        status: groupId ? (targetGroup ? targetGroup.status : campaign.status) : campaign.status,
      },
    });
  } catch (error) {
    console.error('[mail-campaign] sendCampaign failed:', error);
    if (error?.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Campaign identifier is invalid.' });
    }
    logger.error('mail-campaign.send.failed', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Unable to complete email delivery due to an unexpected server error.' });
  }
};

let scheduledCampaignCheckRunning = false;

exports.processScheduledCampaigns = async (baseUrl) => {
  if (scheduledCampaignCheckRunning) return;
  scheduledCampaignCheckRunning = true;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const candidates = await MailCampaign.find({
      status: 'Scheduled',
      scheduledDate: { $ne: '', $lte: today },
    }).select('_id scheduledDate scheduledTime').lean();

    for (const candidate of candidates) {
      const scheduledAt = new Date(`${candidate.scheduledDate}T${candidate.scheduledTime || '00:00'}:00`);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt > new Date()) continue;

      const claimed = await MailCampaign.findOneAndUpdate(
        { _id: candidate._id, status: 'Scheduled' },
        { $set: { status: 'Sending' } },
        { new: true },
      ).select('_id');
      if (!claimed) continue;

      try {
        const response = await fetch(`${baseUrl}/api/mail-campaigns/${candidate._id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!response.ok && response.status >= 500) {
          const current = await MailCampaign.findById(candidate._id).select('status').lean();
          if (current?.status === 'Sending') {
            await MailCampaign.updateOne({ _id: candidate._id, status: 'Sending' }, { $set: { status: 'Scheduled' } });
          }
        }
      } catch (error) {
        logger.error('mail-campaign.scheduler.send.failed', { campaignId: candidate._id.toString(), message: error?.message, stack: error?.stack });
        await MailCampaign.updateOne({ _id: candidate._id, status: 'Sending' }, { $set: { status: 'Scheduled' } });
      }
    }
  } catch (error) {
    logger.error('mail-campaign.scheduler.failed', { message: error?.message, stack: error?.stack });
  } finally {
    scheduledCampaignCheckRunning = false;
  }
};
