const Supplier = require('../models/Supplier');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex } = require('../utils/queryUtils');

const normalizeSupplierPayload = (payload = {}) => {
  const source = payload || {};
  return {
    createdBy: `${source.createdBy || 'Admin'}`.trim(),
    supplierName: `${source.supplierName || ''}`.trim(),
    gstNumber: `${source.gstNumber || ''}`.trim(),
    category: `${source.category || ''}`.trim(),
    paymentTerms: `${source.paymentTerms || ''}`.trim(),
    addressLine1: `${source.addressLine1 || ''}`.trim(),
    country: `${source.country || ''}`.trim(),
    state: `${source.state || ''}`.trim(),
    city: `${source.city || ''}`.trim(),
    pinCode: `${source.pinCode || ''}`.trim(),
    bankName: `${source.bankName || ''}`.trim(),
    bankAddress: `${source.bankAddress || ''}`.trim(),
    accountHolder: `${source.accountHolder || ''}`.trim(),
    accountNumber: `${source.accountNumber || ''}`.trim(),
    ifscCode: `${source.ifscCode || ''}`.trim(),
    loginEmailId: `${source.loginEmailId || ''}`.trim(),
    loginPassword: `${source.loginPassword || ''}`.trim(),
    contactType: `${source.contactType || ''}`.trim(),
    contactName: `${source.contactName || ''}`.trim(),
    designation: `${source.designation || ''}`.trim(),
    emailId: `${source.emailId || ''}`.trim(),
    contactNumber: `${source.contactNumber || ''}`.trim(),
    product: `${source.product || ''}`.trim(),
  };
};

const normalizeSupplierRecord = (supplier = {}) => {
  const source = supplier?.toObject ? supplier.toObject() : supplier || {};
  return {
    _id: source._id ? `${source._id}` : '',
    ...source,
    createdBy: source.createdBy || 'Admin',
    supplierName: source.supplierName || '',
    gstNumber: source.gstNumber || '',
    category: source.category || '',
    paymentTerms: source.paymentTerms || '',
    addressLine1: source.addressLine1 || '',
    country: source.country || '',
    state: source.state || '',
    city: source.city || '',
    pinCode: source.pinCode || '',
    bankName: source.bankName || '',
    bankAddress: source.bankAddress || '',
    accountHolder: source.accountHolder || '',
    accountNumber: source.accountNumber || '',
    ifscCode: source.ifscCode || '',
    loginEmailId: source.loginEmailId || '',
    loginPassword: source.loginPassword || '',
    contactType: source.contactType || '',
    contactName: source.contactName || '',
    designation: source.designation || '',
    emailId: source.emailId || '',
    contactNumber: source.contactNumber || '',
    product: source.product || '',
  };
};

exports.getSuppliers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      product = '',
      createdBy = '',
    } = req.query;
    const query = {};
    const searchValue = regexFromSearch(search);

    if (searchValue) {
      query.$or = [
        { supplierName: searchValue },
        { contactName: searchValue },
        { emailId: searchValue },
        { contactNumber: searchValue },
        { product: searchValue },
      ];
    }

    if (product) {
      query.product = new RegExp(`^${escapeRegex(product)}$`, 'i');
    }

    if (createdBy) {
      query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const projection = {
      _id: 1,
      createdBy: 1,
      supplierName: 1,
      contactName: 1,
      emailId: 1,
      contactNumber: 1,
      product: 1,
      category: 1,
      createdAt: 1,
    };
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdAt', 'supplierName', 'contactName', 'product', 'createdBy']);

    const [suppliers, total] = await Promise.all([
      Supplier.find(query, projection).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Supplier.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: suppliers.map(normalizeSupplierRecord),
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

exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json({ success: true, data: normalizeSupplierRecord(supplier) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    const { supplierName, category, paymentTerms, addressLine1, country, state } = payload;

    if (!supplierName || !category || !paymentTerms || !addressLine1 || !country || !state) {
      return res.status(400).json({ success: false, message: 'Supplier Name, Category, Payment Terms, Address, Country, and State are required.' });
    }

    const supplier = await Supplier.create(payload);
    res.status(201).json({ success: true, message: 'Supplier created successfully', data: normalizeSupplierRecord(supplier) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    const { supplierName, category, paymentTerms, addressLine1, country, state } = payload;

    if (!supplierName || !category || !paymentTerms || !addressLine1 || !country || !state) {
      return res.status(400).json({ success: false, message: 'Supplier Name, Category, Payment Terms, Address, Country, and State are required.' });
    }

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json({ success: true, message: 'Supplier updated successfully', data: normalizeSupplierRecord(supplier) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSuppliers: exports.getSuppliers,
  getSupplierById: exports.getSupplierById,
  createSupplier: exports.createSupplier,
  updateSupplier: exports.updateSupplier,
  deleteSupplier: exports.deleteSupplier,
};
