const { pool } = require('../config/db');

// Get partner earnings and payout information
const getPartnerEarnings = async (req, res) => {
  try {
    const { partnerId } = req.params;
    
    const query = `
      SELECT 
        p.id,
        p.name,
        p.bank_account_name,
        p.bank_account_number,
        p.bank_ifsc_code,
        p.bank_account_type,
        p.payout_percentage,
        p.minimum_payout_amount,
        p.payout_frequency,
        p.last_payout_date,
        p.total_earnings,
        p.pending_payout,
        COUNT(CASE WHEN po.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN po.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN po.status = 'pending' THEN po.partner_share ELSE 0 END) as pending_payout_amount
      FROM partners p
      LEFT JOIN partner_payouts po ON p.id = po.partner_id
      WHERE p.id = $1
      GROUP BY p.id
    `;
    
    const result = await pool.query(query, [partnerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching partner earnings:', error);
    res.status(500).json({ error: 'Failed to fetch partner earnings' });
  }
};

// Create payout record for a completed order
const createOrderPayout = async (orderId, partnerId, orderTotal) => {
  try {
    // Get partner payout percentage
    const partnerQuery = 'SELECT payout_percentage FROM partners WHERE id = $1';
    const partnerResult = await pool.query(partnerQuery, [partnerId]);
    
    if (partnerResult.rows.length === 0) {
      throw new Error('Partner not found');
    }
    
    const payoutPercentage = partnerResult.rows[0].payout_percentage || 85.00;
    const partnerShare = (orderTotal * payoutPercentage) / 100;
    const dailybloomShare = orderTotal - partnerShare;
    
    // Create payout record
    const payoutQuery = `
      INSERT INTO partner_payouts (
        partner_id, order_id, order_total, partner_share, 
        dailybloom_share, payout_percentage, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `;
    
    const payoutResult = await pool.query(payoutQuery, [
      partnerId, orderId, orderTotal, partnerShare, 
      dailybloomShare, payoutPercentage
    ]);
    
    // Update partner's pending payout
    const updatePartnerQuery = `
      UPDATE partners 
      SET total_earnings = total_earnings + $1,
          pending_payout = pending_payout + $1
      WHERE id = $2
    `;
    
    await pool.query(updatePartnerQuery, [partnerShare, partnerId]);
    
    // Update order with commission info
    const updateOrderQuery = `
      UPDATE orders 
      SET commission_amount = $1,
          partner_payout_id = $2
      WHERE id = $3
    `;
    
    await pool.query(updateOrderQuery, [partnerShare, payoutResult.rows[0].id, orderId]);
    
    return payoutResult.rows[0];
  } catch (error) {
    console.error('Error creating order payout:', error);
    throw error;
  }
};

// Get all pending payouts for admin
const getPendingPayouts = async (req, res) => {
  try {
    const query = `
      SELECT 
        po.id,
        po.partner_id,
        po.order_id,
        po.order_total,
        po.partner_share,
        po.dailybloom_share,
        po.payout_percentage,
        po.status,
        po.created_at,
        p.name as partner_name,
        p.bank_account_name,
        p.bank_account_number,
        p.bank_ifsc_code,
        o.customer_name,
        o.total as order_amount
      FROM partner_payouts po
      JOIN partners p ON po.partner_id = p.id
      JOIN orders o ON po.order_id = o.id
      WHERE po.status = 'pending'
      ORDER BY po.created_at ASC
    `;
    
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({ error: 'Failed to fetch pending payouts' });
  }
};

// Create bulk payout request
const createPayoutRequest = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { adminId } = req.body;
    
    // Get partner's pending payouts
    const pendingQuery = `
      SELECT 
        COUNT(*) as order_count,
        SUM(partner_share) as total_amount
      FROM partner_payouts
      WHERE partner_id = $1 AND status = 'pending'
    `;
    
    const pendingResult = await pool.query(pendingQuery, [partnerId]);
    const { order_count, total_amount } = pendingResult.rows[0];
    
    if (order_count === 0 || total_amount === null) {
      return res.status(400).json({ error: 'No pending payouts for this partner' });
    }
    
    // Get partner bank details
    const partnerQuery = `
      SELECT bank_account_name, bank_account_number, bank_ifsc_code, minimum_payout_amount
      FROM partners WHERE id = $1
    `;
    
    const partnerResult = await pool.query(partnerQuery, [partnerId]);
    const partner = partnerResult.rows[0];
    
    if (total_amount < partner.minimum_payout_amount) {
      return res.status(400).json({ 
        error: `Minimum payout amount is ₹${partner.minimum_payout_amount}. Current pending: ₹${total_amount}` 
      });
    }
    
    // Create payout request
    const requestQuery = `
      INSERT INTO payout_requests (
        partner_id, total_amount, order_count, status, 
        requested_by, bank_account_name, bank_account_number, bank_ifsc_code
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
      RETURNING *
    `;
    
    const requestResult = await pool.query(requestQuery, [
      partnerId, total_amount, order_count, adminId,
      partner.bank_account_name, partner.bank_account_number, partner.bank_ifsc_code
    ]);
    
    res.json({ success: true, data: requestResult.rows[0] });
  } catch (error) {
    console.error('Error creating payout request:', error);
    res.status(500).json({ error: 'Failed to create payout request' });
  }
};

// Process payout (approve and mark as processing)
const processPayout = async (req, res) => {
  try {
    const { payoutRequestId } = req.params;
    const { adminId, utrNumber, remarks } = req.body;
    
    // Get payout request details
    const requestQuery = `
      SELECT * FROM payout_requests 
      WHERE id = $1 AND status = 'pending'
    `;
    
    const requestResult = await pool.query(requestQuery, [payoutRequestId]);
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payout request not found or already processed' });
    }
    
    const payoutRequest = requestResult.rows[0];
    
    // Update payout request status
    const updateRequestQuery = `
      UPDATE payout_requests 
      SET status = 'completed',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          processed_at = CURRENT_TIMESTAMP,
          utr_number = $2,
          remarks = $3
      WHERE id = $4
      RETURNING *
    `;
    
    await pool.query(updateRequestQuery, [adminId, utrNumber, remarks, payoutRequestId]);
    
    // Update all related partner_payouts to completed
    const updatePayoutsQuery = `
      UPDATE partner_payouts 
      SET status = 'completed',
          processed_at = CURRENT_TIMESTAMP,
          utr_number = $1
      WHERE partner_id = $2 AND status = 'pending'
    `;
    
    await pool.query(updatePayoutsQuery, [utrNumber, payoutRequest.partner_id]);
    
    // Update partner's pending payout and last payout date
    const updatePartnerQuery = `
      UPDATE partners 
      SET pending_payout = pending_payout - $1,
          last_payout_date = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await pool.query(updatePartnerQuery, [payoutRequest.total_amount, payoutRequest.partner_id]);
    
    res.json({ success: true, message: 'Payout processed successfully' });
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
};

// Get payout history for a partner
const getPayoutHistory = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        pr.id,
        pr.total_amount,
        pr.order_count,
        pr.status,
        pr.created_at,
        pr.processed_at,
        pr.utr_number,
        pr.remarks
      FROM payout_requests pr
      WHERE pr.partner_id = $1
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [partnerId, limit, offset]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching payout history:', error);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
};

// Update partner bank details
const updatePartnerBankDetails = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { bankAccountName, bankAccountNumber, bankIfscCode, bankAccountType } = req.body;
    
    const query = `
      UPDATE partners 
      SET bank_account_name = $1,
          bank_account_number = $2,
          bank_ifsc_code = $3,
          bank_account_type = $4
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      bankAccountName, bankAccountNumber, bankIfscCode, bankAccountType, partnerId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating partner bank details:', error);
    res.status(500).json({ error: 'Failed to update partner bank details' });
  }
};

// Get payout statistics for admin dashboard
const getPayoutStatistics = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payouts,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payouts,
        SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as completed_amount,
        COUNT(DISTINCT partner_id) as active_partners
      FROM payout_requests
    `;
    
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching payout statistics:', error);
    res.status(500).json({ error: 'Failed to fetch payout statistics' });
  }
};

module.exports = {
  getPartnerEarnings,
  createOrderPayout,
  getPendingPayouts,
  createPayoutRequest,
  processPayout,
  getPayoutHistory,
  updatePartnerBankDetails,
  getPayoutStatistics
};