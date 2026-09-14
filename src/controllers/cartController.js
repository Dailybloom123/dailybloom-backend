const CartService = require('../services/cartService');
const db = require('../config/db');
const { validateUUID } = require('../utils/validation');

/**
 * Cart Controller
 * Handles multi-slot cart operations and split order creation
 */

// POST /api/cart/group-by-slot
// Group cart items by delivery slot
async function groupCartBySlot(req, res) {
  const { cart_items } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(cart_items) || cart_items.length === 0) {
    return res.status(400).json({ error: 'Cart items are required' });
  }

  try {
    // Get product details for all cart items
    const productIds = cart_items.map(item => item.product_id);
    const productsResult = await db.query(
      'SELECT * FROM products WHERE id = ANY($1)',
      [productIds]
    );

    const products = productsResult.rows;

    // Group cart by delivery slot
    const groupedCart = CartService.groupCartByDeliverySlot(cart_items, products);

    // Calculate totals
    const slotTotals = CartService.calculateSlotTotals(groupedCart);

    res.json({
      success: true,
      grouped_cart: groupedCart,
      slot_totals: slotTotals,
      summary: CartService.getCartSummary(groupedCart)
    });
  } catch (error) {
    console.error('Error grouping cart by slot:', error);
    res.status(500).json({ error: error.message || 'Failed to group cart' });
  }
}

// POST /api/cart/update-item-slot
// Update delivery slot for a cart item
async function updateCartItemSlot(req, res) {
  const { cart_item, new_slot } = req.body;

  if (!cart_item || !new_slot) {
    return res.status(400).json({ error: 'Cart item and new slot are required' });
  }

  try {
    const updatedItem = CartService.updateCartItemSlot(cart_item, new_slot);

    res.json({
      success: true,
      updated_item: updatedItem
    });
  } catch (error) {
    console.error('Error updating cart item slot:', error);
    res.status(400).json({ error: error.message || 'Failed to update slot' });
  }
}

// POST /api/cart/create-split-orders
// Create split orders from multi-slot cart
async function createSplitOrders(req, res) {
  const { address_id, delivery_date, grouped_cart } = req.body;
  const userId = req.user.userId;

  if (!validateUUID(address_id)) {
    return res.status(400).json({ error: 'Invalid address ID' });
  }

  if (!delivery_date) {
    return res.status(400).json({ error: 'Delivery date is required' });
  }

  if (!grouped_cart || Object.keys(grouped_cart).length === 0) {
    return res.status(400).json({ error: 'Grouped cart is required' });
  }

  try {
    // Validate cart before checkout
    const validation = CartService.validateCartForCheckout(grouped_cart);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Cart validation failed',
        validation_errors: validation.errors
      });
    }

    // Create split orders
    const result = await CartService.createSplitOrders(userId, address_id, grouped_cart, delivery_date);

    res.json({
      success: true,
      parent_order: result.parent_order,
      sub_orders: result.sub_orders,
      total_orders: result.total_orders,
      message: `Created ${result.total_orders} split orders for different delivery slots`
    });
  } catch (error) {
    console.error('Error creating split orders:', error);
    res.status(500).json({ error: error.message || 'Failed to create split orders' });
  }
}

// GET /api/cart/delivery-slots
// Get all available delivery slots
async function getDeliverySlots(req, res) {
  try {
    const slots = CartService.getAllSlots();

    res.json({
      success: true,
      slots: slots
    });
  } catch (error) {
    console.error('Error getting delivery slots:', error);
    res.status(500).json({ error: 'Failed to get delivery slots' });
  }
}

// GET /api/cart/summary
// Get cart summary with slot breakdown
async function getCartSummary(req, res) {
  const { grouped_cart } = req.query;

  if (!grouped_cart) {
    return res.status(400).json({ error: 'Grouped cart data is required' });
  }

  try {
    const summary = CartService.getCartSummary(JSON.parse(grouped_cart));

    res.json({
      success: true,
      summary: summary
    });
  } catch (error) {
    console.error('Error getting cart summary:', error);
    res.status(500).json({ error: 'Failed to get cart summary' });
  }
}

module.exports = {
  groupCartBySlot,
  updateCartItemSlot,
  createSplitOrders,
  getDeliverySlots,
  getCartSummary
};
