const db = require('../config/db');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');

/**
 * Subscription Pause Controller - Handles subscription vacation/pause functionality
 */

// Create a pause period for a subscription
const createPause = asyncHandler(async (req, res) => {
  const { subscriptionId, startDate, endDate } = req.body;
  const userId = req.user.id;

  if (!subscriptionId || !startDate || !endDate) {
    throw new ValidationError('Subscription ID, start date, and end date are required');
  }

  // Verify user owns the subscription
  const subscription = await db.query(
    'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
    [subscriptionId, userId]
  );

  if (subscription.rows.length === 0) {
    throw new AuthenticationError('Subscription not found or access denied');
  }

  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    throw new ValidationError('Start date must be before or equal to end date');
  }

  // Create pause period
  const result = await db.query(
    `INSERT INTO subscription_pauses (subscription_id, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [subscriptionId, startDate, endDate, userId]
  );

  res.json({
    success: true,
    pause: result.rows[0],
    message: 'Pause period created successfully'
  });
});

// Get all pause periods for a subscription
const getSubscriptionPauses = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;
  const userId = req.user.id;

  // Verify user owns the subscription
  const subscription = await db.query(
    'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
    [subscriptionId, userId]
  );

  if (subscription.rows.length === 0) {
    throw new AuthenticationError('Subscription not found or access denied');
  }

  const pauses = await db.query(
    'SELECT * FROM subscription_pauses WHERE subscription_id = $1 ORDER BY start_date DESC',
    [subscriptionId]
  );

  res.json({
    success: true,
    pauses: pauses.rows
  });
});

// Delete a pause period
const deletePause = asyncHandler(async (req, res) => {
  const { pauseId } = req.params;
  const userId = req.user.id;

  // Verify pause belongs to user's subscription
  const pause = await db.query(
    `SELECT sp.* FROM subscription_pauses sp
     JOIN subscriptions s ON sp.subscription_id = s.id
     WHERE sp.pause_id = $1 AND s.user_id = $2`,
    [pauseId, userId]
  );

  if (pause.rows.length === 0) {
    throw new AuthenticationError('Pause not found or access denied');
  }

  await db.query(
    'DELETE FROM subscription_pauses WHERE pause_id = $1',
    [pauseId]
  );

  res.json({
    success: true,
    message: 'Pause period deleted successfully'
  });
});

// Check if subscription is currently paused
const isSubscriptionPaused = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;
  const userId = req.user.id;

  // Verify user owns the subscription
  const subscription = await db.query(
    'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
    [subscriptionId, userId]
  );

  if (subscription.rows.length === 0) {
    throw new AuthenticationError('Subscription not found or access denied');
  }

  const result = await db.query(
    `SELECT EXISTS(
      SELECT 1 FROM subscription_pauses
      WHERE subscription_id = $1
      AND CURRENT_DATE BETWEEN start_date AND end_date
    ) as is_paused`,
    [subscriptionId]
  );

  res.json({
    success: true,
    isPaused: result.rows[0].is_paused
  });
});

module.exports = {
  createPause,
  getSubscriptionPauses,
  deletePause,
  isSubscriptionPaused
};
