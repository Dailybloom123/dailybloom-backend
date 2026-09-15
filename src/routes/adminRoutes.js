const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const { uploadImageFromBuffer, deleteImage, extractPublicId } = require('../config/cloudinary');
const productController = require('../controllers/productController');

// Configure multer for memory storage (no disk I/O)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Existing Admin Endpoints
router.get('/orders', authenticate, adminController.listAllOrders);
router.patch('/orders/:id', authenticate, adminController.updateOrderStatus);
router.get('/stats', authenticate, adminController.getStats);
router.get('/locality-summary', authenticate, adminController.getLocalitySummary);

// NEW: Tripartite System Endpoints
router.post('/orders/:id/notify', authenticate, adminController.triggerSemiAutoNotification);
router.post('/disputes/resolve', authenticate, adminController.resolveDispute);

// NEW: Partner Management Endpoints
router.get('/partners', authenticate, adminController.listPartners);
router.post('/partners', authenticate, adminController.addPartner);
router.put('/partners/:id', authenticate, adminController.updatePartner);
router.delete('/partners/:id', authenticate, adminController.deletePartner);
router.patch('/orders/:id/assign', authenticate, adminController.assignOrderToPartner);

// NEW: Complaint Management Endpoints
router.get('/complaints', authenticate, adminController.getComplaints);
router.post('/complaints/:id/escalate', authenticate, adminController.escalateComplaint);
router.post('/complaints/:id/resolve', authenticate, adminController.resolveComplaintDirectly);
router.get('/partners/:id/warnings', authenticate, adminController.getPartnerWarnings);

// NEW: Partner Warning System Endpoints (3-strike rule)
router.post('/partners/:id/warn', authenticate, adminController.warnPartner);
router.post('/partners/:id/block', authenticate, adminController.blockPartner);
router.post('/partners/:id/unblock', authenticate, adminController.unblockPartner);

// NEW: Staging Queue for Category C (Specialized Dairy & Organics)
router.get('/staging-queue', authenticate, adminController.getStagingQueue);
router.post('/staging-queue/:orderId/assign', authenticate, adminController.assignStagingOrder);

// NEW: Image Upload Endpoint
router.post('/upload-image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadImageFromBuffer(req.file.buffer);
    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// NEW: Image Delete Endpoint
router.delete('/images/:publicId', authenticate, async (req, res) => {
  try {
    const { publicId } = req.params;
    const result = await deleteImage(publicId);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// NEW: Product management endpoints
router.delete('/products/:id', authenticate, adminController.deleteProduct);
router.put('/products/:id/stock', authenticate, productController.updateProductStock);

module.exports = router;