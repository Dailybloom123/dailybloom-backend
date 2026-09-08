const express = require('express');
const router = express.Router();
const {
  getInventory,
  getLowStockItems,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} = require('../controllers/inventoryController');

// Admin routes (require admin authentication)
router.get('/', getInventory);
router.get('/low-stock', getLowStockItems);
router.post('/', addInventoryItem);
router.patch('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

module.exports = router;