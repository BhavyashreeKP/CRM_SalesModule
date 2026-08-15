const express = require('express');
const router = express.Router();
const {
  uploads,
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  getRecipientCounts,
  getRecipientData,
} = require('../controllers/mailCampaignController');

router.get('/recipient-counts', getRecipientCounts);
router.get('/recipient-data', getRecipientData);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.post('/', uploads, createCampaign);
router.put('/:id', uploads, updateCampaign);
router.post('/:id/send', sendCampaign);
router.delete('/:id', deleteCampaign);

module.exports = router;
