const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticate } = require('../middleware/auth');

// Generate WhatsApp link for single product order
router.post('/generate-product-link', authenticate, whatsappController.generateProductWhatsAppLink);

// Generate WhatsApp link for subscription order
router.post('/generate-subscription-link', authenticate, whatsappController.generateSubscriptionWhatsAppLink);

// Get available delivery slots for WhatsApp ordering
router.get('/delivery-slots', whatsappController.getWhatsAppDeliverySlots);

// Get business WhatsApp number
router.get('/business-number', whatsappController.getBusinessWhatsAppNumber);

module.exports = router;
