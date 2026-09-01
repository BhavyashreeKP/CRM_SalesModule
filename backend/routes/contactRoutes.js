const express = require('express');
const router = express.Router();
const {
  getContacts,
  getContactById,
  createContact,
  importContacts,
  importUpload,
  updateContact,
  deleteContact,
} = require('../controllers/contactController');

router.get('/', getContacts);
router.get('/:id', getContactById);
router.post('/import', importUpload.single('file'), importContacts);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;
