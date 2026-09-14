const WhatsAppService = require('../services/whatsappService');
const db = require('../config/db');
const { validateUUID } = require('../utils/validation');

/**
 * WhatsApp Controller
 * Handles WhatsApp deep-link generation and message formatting
 */

// POST /api/whatsapp/generate-product-link
// Generate WhatsApp link for single product order
async function generateProductWhatsAppLink(req, res) {
  const { product_id, address_id, preferred_slot } = req.body;
  const userId = req.user.userId;

  if (!validateUUID(product_id) || !validateUUID(address_id)) {
    return res.status(400).json({ error: 'Invalid product ID or address ID' });
  }

  if (!preferred_slot) {
    return res.status(400).json({ error: 'Preferred delivery slot is required' });
  }

  try {
    // Get product details
    const productResult = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get customer details
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customerDetails = userResult.rows[0];

    // Get address details
    const addressResult = await db.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [address_id, userId]
    );

    if (addressResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const address = addressResult.rows[0];

    // Format preferred slot
    const formattedSlot = WhatsAppService.formatDeliverySlot(preferred_slot);

    // Generate WhatsApp link
    const whatsappLink = WhatsAppService.generateProductWhatsAppLink(
      product,
      customerDetails,
      address,
      formattedSlot
    );

    res.json({
      success: true,
      whatsapp_link: whatsappLink,
      product: product.name,
      price: product.price
    });
  } catch (error) {
    console.error('Error generating WhatsApp link:', error);
    res.status(500).json({ error: error.message || 'Failed to generate WhatsApp link' });
  }
}

// POST /api/whatsapp/generate-subscription-link
// Generate WhatsApp link for subscription order
async function generateSubscriptionWhatsAppLink(req, res) {
  const { product_id, address_id, frequency, preferred_slot } = req.body;
  const userId = req.user.userId;

  if (!validateUUID(product_id) || !validateUUID(address_id)) {
    return res.status(400).json({ error: 'Invalid product ID or address ID' });
  }

  if (!frequency || !preferred_slot) {
    return res.status(400).json({ error: 'Frequency and preferred slot are required' });
  }

  try {
    // Get product details
    const productResult = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get customer details
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customerDetails = userResult.rows[0];

    // Get address details
    const addressResult = await db.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [address_id, userId]
    );

    if (addressResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const address = addressResult.rows[0];

    // Format frequency and slot
    const formattedFrequency = WhatsAppService.formatSubscriptionFrequency(frequency);
    const formattedSlot = WhatsAppService.formatDeliverySlot(preferred_slot);

    // Generate WhatsApp link
    const whatsappLink = WhatsAppService.generateSubscriptionWhatsAppLink(
      product,
      customerDetails,
      address,
      formattedFrequency,
      formattedSlot
    );

    res.json({
      success: true,
      whatsapp_link: whatsappLink,
      product: product.name,
      frequency: formattedFrequency
    });
  } catch (error) {
    console.error('Error generating subscription WhatsApp link:', error);
    res.status(500).json({ error: error.message || 'Failed to generate WhatsApp link' });
  }
}

// GET /api/whatsapp/delivery-slots
// Get available delivery slots for WhatsApp ordering
async function getWhatsAppDeliverySlots(req, res) {
  try {
    const slots = [
      {
        id: 'morning_630_830',
        name: 'Morning 6:30–8:30 AM',
        display_name: 'Morning 6:30–8:30 AM'
      },
      {
        id: 'mid_morning_1000_1300',
        name: 'Mid-Morning Bakery 10:00 AM–1:00 PM',
        display_name: 'Mid-Morning Bakery 10:00 AM–1:00 PM'
      },
      {
        id: 'evening_600_830',
        name: 'Evening 6:00–8:30 PM',
        display_name: 'Evening 6:00–8:30 PM'
      }
    ];

    res.json({
      success: true,
      slots: slots
    });
  } catch (error) {
    console.error('Error getting delivery slots:', error);
    res.status(500).json({ error: 'Failed to get delivery slots' });
  }
}

// GET /api/whatsapp/business-number
// Get business WhatsApp number (for frontend display)
async function getBusinessWhatsAppNumber(req, res) {
  try {
    const phoneNumber = WhatsAppService.getBusinessWhatsAppNumber();

    res.json({
      success: true,
      phone_number: phoneNumber,
      display_number: `+${phoneNumber}`
    });
  } catch (error) {
    console.error('Error getting business WhatsApp number:', error);
    res.status(500).json({ error: 'Failed to get business WhatsApp number' });
  }
}

module.exports = {
  generateProductWhatsAppLink,
  generateSubscriptionWhatsAppLink,
  getWhatsAppDeliverySlots,
  getBusinessWhatsAppNumber
};
