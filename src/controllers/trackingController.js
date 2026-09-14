const db = require('../config/db');

// POST /api/tracking/start - Start live tracking for an order
async function startTracking(req, res) {
  try {
    const { order_id, partner_id } = req.body;

    if (!order_id || !partner_id) {
      return res.status(400).json({ error: 'Order ID and Partner ID are required' });
    }

    // Enable tracking on the order
    const orderResult = await db.query(
      `UPDATE orders 
       SET tracking_enabled = true, live_tracking_started_at = now()
       WHERE id = $1 AND partner_id = $2
       RETURNING *`,
      [order_id, partner_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to this partner' });
    }

    // Create initial milestone
    await db.query(
      `INSERT INTO delivery_milestones (order_id, milestone_type, created_at)
       VALUES ($1, 'picked_up', now())`,
      [order_id]
    );

    res.json({ success: true, order: orderResult.rows[0] });
  } catch (error) {
    console.error('Error starting tracking:', error);
    res.status(500).json({ error: 'Failed to start tracking' });
  }
}

// POST /api/tracking/location - Update delivery location
async function updateLocation(req, res) {
  try {
    const { order_id, partner_id, latitude, longitude, accuracy, speed, heading } = req.body;

    if (!order_id || !partner_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'Order ID, Partner ID, and coordinates are required' });
    }

    // Insert new location point
    const result = await db.query(
      `INSERT INTO delivery_tracking (order_id, partner_id, latitude, longitude, accuracy, speed, heading, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING *`,
      [order_id, partner_id, latitude, longitude, accuracy || null, speed || null, heading || null]
    );

    // Update milestone if significant progress
    const latestMilestone = await db.query(
      `SELECT * FROM delivery_milestones 
       WHERE order_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [order_id]
    );

    if (latestMilestone.rows.length > 0) {
      const currentMilestone = latestMilestone.rows[0];
      
      // Auto-update milestones based on tracking data
      if (currentMilestone.milestone_type === 'picked_up') {
        await db.query(
          `INSERT INTO delivery_milestones (order_id, milestone_type, latitude, longitude, created_at)
           VALUES ($1, 'on_the_way', $2, $3, now())`,
          [order_id, latitude, longitude]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
}

// GET /api/tracking/:order_id - Get tracking history for an order
async function getTrackingHistory(req, res) {
  try {
    const { order_id } = req.params;

    const result = await db.query(
      `SELECT * FROM delivery_tracking 
       WHERE order_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 100`,
      [order_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting tracking history:', error);
    res.status(500).json({ error: 'Failed to get tracking history' });
  }
}

// GET /api/tracking/:order_id/latest - Get latest location
async function getLatestLocation(req, res) {
  try {
    const { order_id } = req.params;

    const result = await db.query(
      `SELECT * FROM delivery_tracking 
       WHERE order_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No tracking data found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting latest location:', error);
    res.status(500).json({ error: 'Failed to get latest location' });
  }
}

// GET /api/tracking/:order_id/milestones - Get delivery milestones
async function getMilestones(req, res) {
  try {
    const { order_id } = req.params;

    const result = await db.query(
      `SELECT * FROM delivery_milestones 
       WHERE order_id = $1 
       ORDER BY created_at ASC`,
      [order_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting milestones:', error);
    res.status(500).json({ error: 'Failed to get milestones' });
  }
}

// POST /api/tracking/:order_id/milestone - Add delivery milestone
async function addMilestone(req, res) {
  try {
    const { order_id } = req.params;
    const { milestone_type, latitude, longitude, estimated_arrival, notes } = req.body;

    if (!milestone_type) {
      return res.status(400).json({ error: 'Milestone type is required' });
    }

    const validTypes = ['picked_up', 'on_the_way', 'nearby', 'at_location'];
    if (!validTypes.includes(milestone_type)) {
      return res.status(400).json({ error: `Invalid milestone type. Must be one of: ${validTypes.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO delivery_milestones (order_id, milestone_type, latitude, longitude, estimated_arrival, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING *`,
      [order_id, milestone_type, latitude || null, longitude || null, estimated_arrival || null, notes || null]
    );

    // Update actual arrival time for completed milestones
    if (milestone_type === 'at_location') {
      await db.query(
        `UPDATE delivery_milestones 
         SET actual_arrival = now() 
         WHERE id = $1`,
        [result.rows[0].id]
      );
      
      // End tracking
      await db.query(
        `UPDATE orders 
         SET tracking_enabled = false, live_tracking_ended_at = now() 
         WHERE id = $1`,
        [order_id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding milestone:', error);
    res.status(500).json({ error: 'Failed to add milestone' });
  }
}

// POST /api/tracking/:order_id/stop - Stop live tracking
async function stopTracking(req, res) {
  try {
    const { order_id } = req.params;

    const result = await db.query(
      `UPDATE orders 
       SET tracking_enabled = false, live_tracking_ended_at = now() 
       WHERE id = $1 
       RETURNING *`,
      [order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update tracking status in recent records
    await db.query(
      `UPDATE delivery_tracking 
       SET tracking_status = 'completed' 
       WHERE order_id = $1 AND tracking_status = 'active'`,
      [order_id]
    );

    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error('Error stopping tracking:', error);
    res.status(500).json({ error: 'Failed to stop tracking' });
  }
}

module.exports = {
  startTracking,
  updateLocation,
  getTrackingHistory,
  getLatestLocation,
  getMilestones,
  addMilestone,
  stopTracking
};