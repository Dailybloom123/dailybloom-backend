const RoutingService = require('../services/routingService');
const { validateUUID } = require('../utils/validation');

/**
 * Routing Controller
 * Handles order routing based on product verticals and delivery windows
 */

// POST /api/routing/route-order/:id
// Route an order based on its fulfillment type
async function routeOrder(req, res) {
  const { id } = req.params;
  
  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  try {
    // Get order details
    const db = require('../config/db');
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Get address details
    const addressResult = await db.query(
      'SELECT * FROM addresses WHERE id = $1',
      [order.address_id]
    );

    if (addressResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const address = addressResult.rows[0];

    // Get order items to determine fulfillment type
    const itemsResult = await db.query(
      `SELECT oi.*, p.category, p.fulfillment_type
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    const products = itemsResult.rows;

    // Route the order
    const routedOrder = await RoutingService.routeOrder(id, address, products);

    res.json({
      success: true,
      order: routedOrder,
      message: 'Order routed successfully'
    });
  } catch (error) {
    console.error('Error routing order:', error);
    res.status(500).json({ error: error.message || 'Failed to route order' });
  }
}

// POST /api/routing/accept-first-claim/:id
// Accept a first-to-claim order (for florists)
async function acceptFirstClaimOrder(req, res) {
  const { id } = req.params;
  const vendorId = req.user.userId; // Assuming authenticated vendor

  if (!validateUUID(id) || !validateUUID(vendorId)) {
    return res.status(400).json({ error: 'Invalid order ID or vendor ID' });
  }

  try {
    const order = await RoutingService.acceptFirstClaimOrder(id, vendorId);

    res.json({
      success: true,
      order: order,
      message: 'Order claimed successfully'
    });
  } catch (error) {
    console.error('Error accepting first-claim order:', error);
    res.status(400).json({ error: error.message || 'Failed to accept order' });
  }
}

// GET /api/routing/available-first-claim-orders
// Get available first-to-claim orders for a florist
async function getAvailableFirstClaimOrders(req, res) {
  const vendorId = req.user.userId;
  const { coverage_radius } = req.query;

  if (!validateUUID(vendorId)) {
    return res.status(400).json({ error: 'Invalid vendor ID' });
  }

  try {
    const radius = coverage_radius ? parseFloat(coverage_radius) : 5;
    const orders = await RoutingService.getAvailableFirstClaimOrders(vendorId, radius);

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error getting available first-claim orders:', error);
    res.status(500).json({ error: error.message || 'Failed to get available orders' });
  }
}

// GET /api/routing/delivery-slots
// Get available delivery slots for products
async function getDeliverySlots(req, res) {
  const { category } = req.query;

  try {
    const slots = Object.values(RoutingService.DELIVERY_SLOTS).map(slot => ({
      id: slot.id,
      name: slot.name,
      cutoff_time: slot.cutoff_time,
      manifest_time: slot.manifest_time,
      applicable_categories: slot.applicable_categories
    }));

    // Filter by category if provided
    const filteredSlots = category 
      ? slots.filter(slot => slot.applicable_categories.includes(category))
      : slots;

    res.json({
      success: true,
      slots: filteredSlots
    });
  } catch (error) {
    console.error('Error getting delivery slots:', error);
    res.status(500).json({ error: 'Failed to get delivery slots' });
  }
}

// GET /api/routing/fulfillment-types
// Get fulfillment type for a product category
async function getFulfillmentType(req, res) {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }

  try {
    const fulfillmentType = RoutingService.getFulfillmentType(category);

    res.json({
      success: true,
      category: category,
      fulfillment_type: fulfillmentType
    });
  } catch (error) {
    console.error('Error getting fulfillment type:', error);
    res.status(500).json({ error: 'Failed to get fulfillment type' });
  }
}

module.exports = {
  routeOrder,
  acceptFirstClaimOrder,
  getAvailableFirstClaimOrders,
  getDeliverySlots,
  getFulfillmentType
};
