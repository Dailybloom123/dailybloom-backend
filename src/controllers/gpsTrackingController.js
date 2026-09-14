const db = require('../config/db');
const { validateUUID, validateCoordinates, validateDecimal } = require('../utils/validation');

/**
 * GPS Tracking Controller
 * Handles real-time GPS tracking for delivery orders
 */

// POST /api/tracking/start-tracking/:orderId
// Start GPS tracking for an order
async function startGPSTracking(req, res) {
  const { orderId } = req.params;
  const vendorId = req.user.userId;

  if (!validateUUID(orderId) || !validateUUID(vendorId)) {
    return res.status(400).json({ error: 'Invalid order ID or vendor ID' });
  }

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify order belongs to this vendor
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND partner_id = $2',
        [orderId, vendorId]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found or not assigned to you' });
      }

      const order = orderResult.rows[0];

      // Check if order is in correct status for GPS tracking
      if (order.status !== 'out_for_delivery') {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'GPS tracking can only be started for orders out for delivery',
          current_status: order.status
        });
      }

      // Check if GPS tracking is already enabled
      if (order.gps_tracking_enabled) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'GPS tracking is already enabled for this order' });
      }

      // Enable GPS tracking
      await client.query(
        `UPDATE orders 
         SET gps_tracking_enabled = true,
             live_tracking_started_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'GPS tracking started successfully',
        order_id: orderId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error starting GPS tracking:', error);
    res.status(500).json({ error: error.message || 'Failed to start GPS tracking' });
  }
}

// POST /api/tracking/stop-tracking/:orderId
// Stop GPS tracking for an order
async function stopGPSTracking(req, res) {
  const { orderId } = req.params;
  const vendorId = req.user.userId;

  if (!validateUUID(orderId) || !validateUUID(vendorId)) {
    return res.status(400).json({ error: 'Invalid order ID or vendor ID' });
  }

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify order belongs to this vendor
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND partner_id = $2',
        [orderId, vendorId]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found or not assigned to you' });
      }

      // Stop GPS tracking
      await client.query(
        `UPDATE orders 
         SET gps_tracking_enabled = false,
             live_tracking_ended_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'GPS tracking stopped successfully',
        order_id: orderId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error stopping GPS tracking:', error);
    res.status(500).json({ error: error.message || 'Failed to stop GPS tracking' });
  }
}

// POST /api/tracking/update-location/:orderId
// Update GPS coordinates for an order
async function updateGPSCoordinates(req, res) {
  const { orderId } = req.params;
  const { latitude, longitude, heading } = req.body;
  const vendorId = req.user.userId;

  if (!validateUUID(orderId) || !validateUUID(vendorId)) {
    return res.status(400).json({ error: 'Invalid order ID or vendor ID' });
  }

  if (!validateCoordinates(latitude, longitude)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  if (heading !== undefined && !validateDecimal(heading, 0, 360)) {
    return res.status(400).json({ error: 'Invalid heading value' });
  }

  try {
    // Verify order belongs to this vendor and GPS tracking is enabled
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND partner_id = $2 AND gps_tracking_enabled = true',
      [orderId, vendorId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found, not assigned to you, or GPS tracking not enabled' });
    }

    // Insert GPS coordinates
    await db.query(
      `INSERT INTO gps_tracking_coordinates (order_id, latitude, longitude, heading, recorded_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [orderId, latitude, longitude, heading || null]
    );

    res.json({
      success: true,
      message: 'GPS coordinates updated successfully'
    });
  } catch (error) {
    console.error('Error updating GPS coordinates:', error);
    res.status(500).json({ error: error.message || 'Failed to update GPS coordinates' });
  }
}

// GET /api/tracking/coordinates/:orderId
// Get GPS coordinates for an order (customer view)
async function getGPSCoordinates(req, res) {
  const { orderId } = req.params;
  const userId = req.user.userId;

  if (!validateUUID(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  try {
    // Verify order belongs to this user
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Get latest GPS coordinates
    const coordinatesResult = await db.query(
      `SELECT * FROM gps_tracking_coordinates 
       WHERE order_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 50`,
      [orderId]
    );

    // Get customer address for destination
    const addressResult = await db.query(
      'SELECT * FROM addresses WHERE id = $1',
      [order.address_id]
    );

    const address = addressResult.rows[0];

    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        gps_tracking_enabled: order.gps_tracking_enabled,
        live_tracking_started_at: order.live_tracking_started_at,
        live_tracking_ended_at: order.live_tracking_ended_at
      },
      destination: {
        latitude: address.latitude,
        longitude: address.longitude,
        address: `${address.line1}, ${address.locality}, ${address.city}`
      },
      coordinates: coordinatesResult.rows,
      tracking_active: order.gps_tracking_enabled && order.status === 'out_for_delivery'
    });
  } catch (error) {
    console.error('Error getting GPS coordinates:', error);
    res.status(500).json({ error: error.message || 'Failed to get GPS coordinates' });
  }
}

// GET /api/tracking/order-status/:orderId
// Get order tracking status
async function getOrderTrackingStatus(req, res) {
  const { orderId } = req.params;
  const userId = req.user.userId;

  if (!validateUUID(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  try {
    // Verify order belongs to this user
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Calculate ETA (simplified - would use routing API in production)
    let eta = null;
    if (order.gps_tracking_enabled && order.status === 'out_for_delivery') {
      const coordinatesResult = await db.query(
        `SELECT * FROM gps_tracking_coordinates 
         WHERE order_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT 1`,
        [orderId]
      );

      if (coordinatesResult.rows.length > 0) {
        const latestCoord = coordinatesResult.rows[0];
        const addressResult = await db.query(
          'SELECT latitude, longitude FROM addresses WHERE id = $1',
          [order.address_id]
        );
        const address = addressResult.rows[0];

        // Calculate distance (simplified)
        const distance = calculateDistance(
          latestCoord.latitude,
          latestCoord.longitude,
          address.latitude,
          address.longitude
        );

        // Estimate ETA (assuming 20 km/h average speed)
        const etaMinutes = (distance / 20) * 60;
        eta = new Date(Date.now() + etaMinutes * 60000);
      }
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        gps_tracking_enabled: order.gps_tracking_enabled,
        live_tracking_started_at: order.live_tracking_started_at,
        live_tracking_ended_at: order.live_tracking_ended_at
      },
      eta: eta ? eta.toISOString() : null,
      tracking_active: order.gps_tracking_enabled && order.status === 'out_for_delivery'
    });
  } catch (error) {
    console.error('Error getting order tracking status:', error);
    res.status(500).json({ error: error.message || 'Failed to get tracking status' });
  }
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = {
  startGPSTracking,
  stopGPSTracking,
  updateGPSCoordinates,
  getGPSCoordinates,
  getOrderTrackingStatus
};
