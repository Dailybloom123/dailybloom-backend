const db = require('../config/db');
const { validateUUID, validateInteger } = require('../utils/validation');

/**
 * Multi-Slot Cart & Split Manifests Service
 * Handles dynamic cart grouping by delivery windows and sub-order splitting
 */

class CartService {
  /**
   * Delivery slot definitions
   */
  static DELIVERY_SLOTS = {
    MORNING_630_830: {
      id: 'morning_630_830',
      name: 'Morning (6:30 AM – 8:30 AM)',
      priority: 1,
      cutoff_time: '21:30',
      manifest_time: '05:30'
    },
    MID_MORNING_1000_1300: {
      id: 'mid_morning_1000_1300',
      name: 'Mid-Morning Bakery (10:00 AM – 1:00 PM)',
      priority: 2,
      cutoff_time: '09:00',
      manifest_time: '09:00'
    },
    EVENING_600_830: {
      id: 'evening_600_830',
      name: 'Evening (6:00 PM – 8:30 PM)',
      priority: 3,
      cutoff_time: '16:00',
      manifest_time: '16:30'
    }
  };

  /**
   * Group cart items by delivery slot
   */
  static groupCartByDeliverySlot(cartItems, products) {
    const groupedCart = {
      morning_630_830: [],
      mid_morning_1000_1300: [],
      evening_600_830: []
    };

    cartItems.forEach(cartItem => {
      const product = products.find(p => p.id === cartItem.product_id);
      if (!product) return;

      const availableSlots = this.getAvailableSlotsForProduct(product);
      
      // Default to morning slot if multiple slots available
      const selectedSlot = cartItem.selected_slot || availableSlots[0];
      
      if (groupedCart[selectedSlot]) {
        groupedCart[selectedSlot].push({
          ...cartItem,
          product: product,
          available_slots: availableSlots,
          selected_slot: selectedSlot
        });
      }
    });

    // Remove empty slots
    Object.keys(groupedCart).forEach(slot => {
      if (groupedCart[slot].length === 0) {
        delete groupedCart[slot];
      }
    });

    return groupedCart;
  }

  /**
   * Get available delivery slots for a product
   */
  static getAvailableSlotsForProduct(product) {
    const fulfillmentType = product.fulfillment_type || this.getFulfillmentType(product.category);
    
    switch (fulfillmentType) {
      case 'zone_routed': // Milk/Paneer
        return ['morning_630_830', 'evening_600_830'];
      case 'first_claim': // Flowers
        return ['morning_630_830', 'evening_600_830'];
      case 'proximity_assignment': // Bakery
        return ['mid_morning_1000_1300'];
      case 'manual_assignment': // Specialized Dairy & Organics
        return ['morning_630_830'];
      default:
        return ['morning_630_830'];
    }
  }

  /**
   * Get fulfillment type for a category
   */
  static getFulfillmentType(category) {
    const fulfillmentMap = {
      'dairy': 'zone_routed',
      'flowers': 'first_claim',
      'honey': 'manual_assignment',
      'bakery': 'proximity_assignment'
    };
    return fulfillmentMap[category] || 'zone_routed';
  }

  /**
   * Update cart item delivery slot
   */
  static updateCartItemSlot(cartItem, newSlot) {
    const availableSlots = this.getAvailableSlotsForProduct(cartItem.product);
    
    if (!availableSlots.includes(newSlot)) {
      throw new Error(`Slot ${newSlot} is not available for this product`);
    }

    return {
      ...cartItem,
      selected_slot: newSlot
    };
  }

  /**
   * Calculate slot totals
   */
  static calculateSlotTotals(groupedCart) {
    const slotTotals = {};

    Object.keys(groupedCart).forEach(slot => {
      const items = groupedCart[slot];
      const total = items.reduce((sum, item) => {
        return sum + (item.product.price * item.quantity);
      }, 0);

      slotTotals[slot] = {
        total: total,
        item_count: items.length,
        items: items
      };
    });

    return slotTotals;
  }

  /**
   * Create split orders from cart
   */
  async createSplitOrders(userId, addressId, groupedCart, deliveryDate) {
    if (!validateUUID(userId) || !validateUUID(addressId)) {
      throw new Error('Invalid user ID or address ID');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create parent order
      const parentOrderResult = await client.query(
        `INSERT INTO orders (user_id, address_id, status, total, delivery_date, created_at)
         VALUES ($1, $2, 'split_pending', 0, $3, NOW())
         RETURNING *`,
        [userId, addressId, deliveryDate]
      );

      const parentOrder = parentOrderResult.rows[0];
      const subOrders = [];

      // Create sub-orders for each delivery slot
      for (const [slot, items] of Object.entries(groupedCart)) {
        if (items.length === 0) continue;

        const slotTotal = items.reduce((sum, item) => {
          return sum + (item.product.price * item.quantity);
        }, 0);

        // Create sub-order
        const subOrderResult = await client.query(
          `INSERT INTO orders (user_id, address_id, parent_order_id, status, total, delivery_date, delivery_slot, created_at)
           VALUES ($1, $2, $3, 'pending', $4, $5, $6, NOW())
           RETURNING *`,
          [userId, addressId, parentOrder.id, slotTotal, deliveryDate, slot]
        );

        const subOrder = subOrderResult.rows[0];

        // Add order items
        for (const item of items) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price)
             VALUES ($1, $2, $3, $4)`,
            [subOrder.id, item.product_id, item.quantity, item.product.price]
          );
        }

        subOrders.push(subOrder);
      }

      // Update parent order total
      const grandTotal = subOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
      await client.query(
        `UPDATE orders SET total = $1 WHERE id = $2`,
        [grandTotal, parentOrder.id]
      );

      await client.query('COMMIT');

      return {
        parent_order: parentOrder,
        sub_orders: subOrders,
        total_orders: subOrders.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get delivery slot info
   */
  static getSlotInfo(slotId) {
    return this.DELIVERY_SLOTS[slotId.toUpperCase()] || null;
  }

  /**
   * Get all delivery slots
   */
  static getAllSlots() {
    return Object.values(this.DELIVERY_SLOTS).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate cart for checkout
   */
  static validateCartForCheckout(groupedCart) {
    const validationErrors = [];

    // Check if cart is empty
    const totalItems = Object.values(groupedCart).reduce((sum, items) => sum + items.length, 0);
    if (totalItems === 0) {
      validationErrors.push('Cart is empty');
    }

    // Check if all items have valid slots
    Object.keys(groupedCart).forEach(slot => {
      groupedCart[slot].forEach(item => {
        if (!item.selected_slot) {
          validationErrors.push(`Item ${item.product.name} has no delivery slot selected`);
        }
      });
    });

    // Check cut-off times
    const now = new Date();
    Object.keys(groupedCart).forEach(slot => {
      const slotInfo = this.getSlotInfo(slot);
      if (slotInfo) {
        const cutOff = this.calculateCutOffTime(slot, now);
        if (now > cutOff) {
          validationErrors.push(`Cut-off time passed for ${slotInfo.name}`);
        }
      }
    });

    return {
      valid: validationErrors.length === 0,
      errors: validationErrors
    };
  }

  /**
   * Calculate cut-off time for a slot
   */
  static calculateCutOffTime(slotId, orderDate = new Date()) {
    const slot = this.DELIVERY_SLOTS[slotId.toUpperCase()];
    if (!slot) return null;

    const cutOff = new Date(orderDate);
    const [hours, minutes] = slot.cutoff_time.split(':').map(Number);
    
    // If morning slot, cut-off is previous night
    if (slotId === 'morning_630_830') {
      cutOff.setDate(cutOff.getDate() - 1);
    }
    
    cutOff.setHours(hours, minutes, 0, 0);
    return cutOff;
  }

  /**
   * Get cart summary for display
   */
  static getCartSummary(groupedCart) {
    const slotTotals = this.calculateSlotTotals(groupedCart);
    const grandTotal = Object.values(slotTotals).reduce((sum, slot) => sum + slot.total, 0);
    const totalItems = Object.values(groupedCart).reduce((sum, items) => sum + items.length, 0);

    return {
      total_items: totalItems,
      total_slots: Object.keys(groupedCart).length,
      grand_total: grandTotal,
      slot_breakdown: slotTotals,
      delivery_slots: Object.keys(groupedCart).map(slot => this.getSlotInfo(slot))
    };
  }
}

module.exports = CartService;
