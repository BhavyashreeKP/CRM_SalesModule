const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch } = require('../utils/queryUtils');

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '').trim();

const buildWhatsAppUrl = (number) => {
  const normalized = normalizePhone(number);
  if (!normalized) return '';
  const withoutPlus = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  if (withoutPlus.startsWith('91') && withoutPlus.length > 10) {
    return `https://wa.me/${withoutPlus}`;
  }
  if (/^\d{10}$/.test(withoutPlus)) {
    return `https://wa.me/91${withoutPlus}`;
  }
  return `https://wa.me/${withoutPlus}`;
};

const normalizeContactPayload = (payload = {}) => {
  const source = payload || {};
  const customerName = `${source.customerName || ''}`.trim();
  const contactName = `${source.contactName || source.contactPerson || ''}`.trim();
  const designation = `${source.designation || ''}`.trim();
  const contactNumber = `${source.contactNumber || source.number || ''}`.trim();
  const email = `${source.email || ''}`.trim();
  const customerIdValue = source.customerId ? `${source.customerId}`.trim() : '';

  return {
    customerId: customerIdValue,
    customerName,
    contactName,
    designation,
    contactNumber,
    email,
  };
};

const normalizeContactRecord = (contact = {}) => {
  const source = contact?.toObject ? contact.toObject() : contact || {};
  const normalized = {
    _id: source._id ? `${source._id}` : source._doc?._id ? `${source._doc._id}` : '',
    ...source,
  };
  normalized.customerId = source.customerId || source.customer || '';
  normalized.customerName = source.customerName || '';
  normalized.contactName = source.contactName || source.contactPerson || '';
  normalized.designation = source.designation || '';
  normalized.contactNumber = source.contactNumber || source.number || '';
  normalized.email = source.email || '';
  return normalized;
};

exports.getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
    } = req.query;
    const query = {};
    const searchValue = regexFromSearch(search);

    if (searchValue) {
      query.$or = [
        { customerName: searchValue },
        { contactName: searchValue },
        { designation: searchValue },
        { contactNumber: searchValue },
        { email: searchValue },
      ];
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const projection = {
      _id: 1,
      customerId: 1,
      customerName: 1,
      contactName: 1,
      designation: 1,
      contactNumber: 1,
      email: 1,
      createdAt: 1,
    };
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdAt', 'customerName', 'contactName', 'email', 'contactNumber']);

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .select(projection)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Contact.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: contacts.map((contact) => normalizeContactRecord(contact)),
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

exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).select({ __v: 0 }).lean();
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.status(200).json({ success: true, data: normalizeContactRecord(contact) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const payload = normalizeContactPayload(req.body);
    const { customerId, customerName, contactName, designation = '', contactNumber, email } = payload;

    let resolvedCustomerId = customerId || '';
    if (!resolvedCustomerId && customerName) {
      const customer = await Customer.findOne({ $or: [{ customerName }, { companyName: customerName }] });
      if (customer) {
        resolvedCustomerId = customer._id.toString();
      }
    }

    if (!customerName || !contactName || !contactNumber || !email) {
      return res.status(400).json({ success: false, message: 'Customer Name, Contact Name, Contact Number, and Email are required.' });
    }

    const contact = await Contact.create({
      customerId: resolvedCustomerId || undefined,
      customerName,
      contactName,
      designation: designation || '',
      contactNumber,
      email,
    });

    res.status(201).json({ success: true, message: 'Contact created successfully', data: normalizeContactRecord(contact.toObject ? contact.toObject() : contact) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const payload = normalizeContactPayload(req.body);
    const { customerId, customerName, contactName, designation = '', contactNumber, email } = payload;

    let resolvedCustomerId = customerId || '';
    if (!resolvedCustomerId && customerName) {
      const customer = await Customer.findOne({ $or: [{ customerName }, { companyName: customerName }] });
      if (customer) {
        resolvedCustomerId = customer._id.toString();
      }
    }

    const contact = await Contact.findByIdAndUpdate(req.params.id, {
      customerId: resolvedCustomerId || undefined,
      customerName,
      contactName,
      designation: designation || '',
      contactNumber,
      email,
    }, { new: true, runValidators: true });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.status(200).json({ success: true, message: 'Contact updated successfully', data: normalizeContactRecord(contact.toObject ? contact.toObject() : contact) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getContacts: exports.getContacts,
  getContactById: exports.getContactById,
  createContact: exports.createContact,
  updateContact: exports.updateContact,
  deleteContact: exports.deleteContact,
  buildWhatsAppUrl,
};
