const db = require('../config/db');
const { validateUUID, validateCoordinates, validateInteger } = require('../utils/validation');

/**
 * Product Verticals & Multi-Slot Routing Engine
 * Handles order routing based on fulfillment type and delivery windows
 */

class RoutingService {
  /**
   * Delivery slot definitions
   */
  static DELIVERY_SLOTS = {
    MORNING_630_830: {
      id: 'morning_630_830',
      name: 'Morning (6:30 AM – 8:30 AM)',
      cutoff_time: '21:30', // 9:30 PM previous night
      manifest_time: '05:30', // 5:30 AM
      applicable_categories: ['dairy', 'flowers']
    },
    MID_MORNING_1000_1300: {
      id: 'mid_morning_1000_1300',
      name: 'Mid-Morning Bakery (10:00 AM – 1:00 PM)',
      cutoff_time: '09:00', // 9:00 AM same day
      manifest_time: '09:00', // 9:00 AM
      applicable_categories: ['bakery']
    },
    EVENING_600_830: {
      id: 'evening_600_830',
      name: 'Evening (6:00 PM – 8:30 PM)',
      cutoff_time: '16:00', // 4:00 PM same day
      manifest_time: '16:30', // 4:30 PM
      applicable_categories: ['dairy', 'flowers']
    }
  };

  /**
   * Determine fulfillment type based on product category
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
   * Get available delivery slots for a product
   */
  static getAvailableDeliverySlots(product) {
    const fulfillmentType = product.fulfillment_type || this.getFulfillmentType(product.category);
    
    switch (fulfillmentType) {
      case 'zone_routed': // Milk/Paneer
        return ['morning_630_830', 'evening_600_830'];
      case 'first_claim': // Flowers
        return ['morning_630_830', 'evening_600_830'];
      case 'proximity_assignment': // Bakery
        return ['mid_morning_1000_1300'];
      case 'manual_assignment': // Specialized Dairy & Organics
        return ['morning_630_830']; // Next-day morning only
      default:
        return ['morning_630_830'];
    }
  }

  /**
   * Calculate delivery cut-off time for a slot
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
   * Calculate manifest generation time for a slot
   */
  static calculateManifestTime(slotId, orderDate = new Date()) {
    const slot = this.DELIVERY_SLOTS[slotId.toUpperCase()];
    if (!slot) return null;

    const manifestTime = new Date(orderDate);
    const [hours, minutes] = slot.manifest_time.split(':').map(Number);
    manifestTime.setHours(hours, minutes, 0, 0);
    return manifestTime;
  }

  /**
   * Route order based on fulfillment type
   */
  async routeOrder(orderId, address, products) {
    if (!validateUUID(orderId)) {
      throw new Error('Invalid order ID');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get order details
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      // Determine fulfillment type from products
      const fulfillmentType = this.determineOrderFulfillmentType(products);
      
      // Route based on fulfillment type
      let routedOrder;
      switch (fulfillmentType) {
        case 'zone_routed':
          routedOrder = await this.routeZoneRouted(client, order, address);
          break;
        case 'first_claim':
          routedOrder = await this.routeFirstClaim(client, order, address);
          break;
        case 'proximity_assignment':
          routedOrder = await this.routeProximityAssignment(client, order, address);
          break;
        case 'manual_assignment':
          routedOrder = await this.routeManualAssignment(client, order);
          break;
        default:
          throw new Error(`Unknown fulfillment type: ${fulfillmentType}`);
      }

      await client.query('COMMIT');
      return routedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Determine order fulfillment type based on mixed cart
   */
  determineOrderFulfillmentType(products) {
    // If all products are same category, use that category's fulfillment type
    const categories = [...new Set(products.map(p => p.category))];
    if (categories.length === 1) {
      return this.getFulfillmentType(categories[0]);
    }

    // Mixed cart - default to manual assignment for admin staging
    return 'manual_assignment';
  }

  /**
   * Zone-based routing for Milk/Paneer
   */
  async routeZoneRouted(client, order, address) {
    // Get zone_id from address
    const zoneId = address.zone_id;
    if (!zoneId) {
      throw new Error('Address must have a zone_id for zone-based routing');
    }

    // Find active milk vendors in this zone
    const vendorResult = await client.query(
      `SELECT p.* FROM partners p
       WHERE p.zone_id = $1 
       AND p.partner_type = 'milk_van'
       AND p.is_active = true
       ORDER BY p.rating DESC
       LIMIT 1`,
      [zoneId]
    );

    if (vendorResult.rows.length === 0) {
      throw new Error('No active milk vendors available in this zone');
    }

    const vendor = vendorResult.rows[0];

    // Update order with zone routing
    const updateResult = await client.query(
      `UPDATE orders 
       SET partner_id = $1, 
           fulfillment_type = 'zone_routed',
           zone_id = $2,
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [vendor.id, zoneId, order.id]
    );

    return updateResult.rows[0];
  }

  /**
   * First-to-claim routing for Flowers
   */
  async routeFirstClaim(client, order, address) {
    // Calculate customer coordinates
    const customerLat = address.latitude;
    const customerLng = address.longitude;

    if (!validateCoordinates(customerLat, customerLng)) {
      throw new Error('Valid customer coordinates required for first-to-claim routing');
    }

    // Find active florists within coverage radius
    const floristResult = await client.query(
      `SELECT p.*, 
              (6371 * acos(cos(radians($1)) * cos(radians(p.latitude)) * 
               cos(radians(p.longitude) - radians($2)) + 
               sin(radians($1)) * sin(radians(p.latitude)))) AS distance
       FROM partners p
       WHERE p.partner_type = 'florist'
       AND p.is_active = true
       AND p.coverage_radius_km >= (
         6371 * acos(cos(radians($1)) * cos(radians(p.latitude)) * 
         cos(radians(p.longitude) - radians($2)) + 
         sin(radians($1)) * sin(radians(p.latitude)))
       )
       ORDER BY distance ASC`,
      [customerLat, customerLng]
    );

    if (floristResult.rows.length === 0) {
      throw new Error('No active florists available within coverage area');
    }

    // Set order to first-claim status (not assigned yet)
    const updateResult = await client.query(
      `UPDATE orders 
       SET fulfillment_type = 'first_claim',
           claimed_by_vendor_id = NULL,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [order.id]
    );

    return {
      ...updateResult.rows[0],
      available_florists: floristResult.rows
    };
  }

  /**
   * Proximity-based routing for Bakery
   */
  async routeProximityAssignment(client, order, address) {
    const customerLat = address.latitude;
    const customerLng = address.longitude;

    if (!validateCoordinates(customerLat, customerLng)) {
      throw new Error('Valid customer coordinates required for proximity routing');
    }

    // Find nearest active bakery
    const bakeryResult = await client.query(
      `SELECT p.*,
              (6371 * acos(cos(radians($1)) * cos(radians(p.latitude)) * 
               cos(radians(p.longitude) - radians($2)) + 
               sin(radians($1)) * sin(radians(p.latitude)))) AS distance
       FROM partners p
       WHERE p.partner_type = 'bakery'
       AND p.is_active = true
       ORDER BY distance ASC
       LIMIT 1`,
      [customerLat, customerLng]
    );

    if (bakeryResult.rows.length === 0) {
      throw new Error('No active bakeries available');
    }

    const bakery = bakeryResult.rows[0];

    // Update order with proximity assignment
    const updateResult = await client.query(
      `UPDATE orders 
       SET partner_id = $1, 
           fulfillment_type = 'proximity_assignment',
           updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [bakery.id, order.id]
    );

    return updateResult.rows[0];
  }

  /**
   * Manual assignment routing for Specialized Dairy & Organics
   */
  async routeManualAssignment(client, order) {
    // Route to admin staging queue
    const updateResult = await client.query(
      `UPDATE orders 
       SET fulfillment_type = 'manual_assignment',
           partner_id = NULL,
           status = 'pending_assignment',
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [order.id]
    );

    return updateResult.rows[0];
  }

  /**
   * Accept first-to-claim order (for florists)
   */
  async acceptFirstClaimOrder(orderId, vendorId) {
    if (!validateUUID(orderId) || !validateUUID(vendorId)) {
      throw new Error('Invalid order ID or vendor ID');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Try to claim the order atomically
      const result = await client.query(
        `UPDATE orders 
         SET claimed_by_vendor_id = $1,
             partner_id = $1,
             status = 'confirmed',
             updated_at = NOW()
         WHERE id = $2 
         AND claimed_by_vendor_id IS NULL
         AND fulfillment_type = 'first_claim'
         RETURNING *`,
        [vendorId, orderId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Order already claimed or not available for first-to-claim');
      }

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get available first-to-claim orders for a florist
   */
  async getAvailableFirstClaimOrders(vendorId, coverageRadius = 5) {
    if (!validateUUID(vendorId)) {
      throw new Error('Invalid vendor ID');
    }

    // Get vendor location
    const vendorResult = await db.query(
      'SELECT latitude, longitude FROM partners WHERE id = $1',
      [vendorId]
    );

    if (vendorResult.rows.length === 0) {
      throw new Error('Vendor not found');
    }

    const vendor = vendorResult.rows[0];

    // Get available orders within coverage radius
    const ordersResult = await db.query(
      `SELECT o.*, a.latitude, a.longitude, a.locality,
              (6371 * acos(cos(radians($1)) * cos(radians(a.latitude)) * 
               cos(radians(a.longitude) - radians($2)) + 
               sin(radians($1)) * sin(radians(a.latitude)))) AS distance
       FROM orders o
       JOIN addresses a ON a.id = o.address_id
       WHERE o.fulfillment_type = 'first_claim'
       AND o.claimed_by_vendor_id IS NULL
       AND o.status = 'pending'
       AND (6371 * acos(cos(radians($1)) * cos(radians(a.latitude)) * 
         cos(radians(a.longitude) - radians($2)) + 
         sin(radians($1)) * sin(radians(a.latitude)))) <= $3
       ORDER BY o.created_at ASC`,
      [vendor.latitude, vendor.longitude, coverageRadius]
    );

    return ordersResult.rows;
  }
}

module.exports = RoutingService;
