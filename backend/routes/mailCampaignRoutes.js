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
  trackOpen,
  trackClick,
  getCampaignReport,
  getCampaignPreview,
  getRecipientCounts,
  getRecipientData,
} = require('../controllers/mailCampaignController');

router.get('/recipient-counts', getRecipientCounts);
router.get('/recipient-data', getRecipientData);
router.get('/open/:trackingId', trackOpen);
router.get('/tracking/open/:trackingId', trackOpen);
router.get('/tracking/open/:token', trackOpen);
router.get('/tracking/click/:token', trackClick);
router.get('/:id/report', getCampaignReport);
router.get('/:id/preview', getCampaignPreview);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.post('/', uploads, createCampaign);
router.put('/:id', uploads, updateCampaign);
router.post('/:id/send', sendCampaign);
router.delete('/:id', deleteCampaign);

module.exports = router;
