require('express-async-errors'); // lets async controller errors reach the error handler below automatically
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const helmet = require('helmet');
const winston = require('winston');
const compression = require('compression');
const session = require('express-session');

const { logger, logApiRequest, logError, logSecurityEvent } = require('./utils/logger');
const { checkServicesHealth } = require('./utils/healthCheck');
const { metrics } = require('./utils/metrics');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const orderRoutes = require('./routes/orderRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const addressRoutes = require('./routes/addressRoutes');
const adminRoutes = require('./routes/adminRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const refundRoutes = require('./routes/refundRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const stockCommunicationRoutes = require('./routes/stockCommunicationRoutes');
const orderTrackingRoutes = require('./routes/orderTrackingRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const { errorHandler, asyncHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Use custom logging middleware
app.use(logApiRequest);

// Metrics collection middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.recordRequest(req.method, req.path, res.statusCode, duration);
  });
  
  next();
});

// Security: Helmet for HTTP headers with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Performance: In-memory cache for frequently accessed data
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes default TTL

// Security: CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Session configuration for OAuth
app.use(session({
  secret: process.env.JWT_SECRET || 'dailybloom-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 3600000 } // 1 hour
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(limiter);
app.use(compression());

// Request timeout middleware
const timeout = require('connect-timeout');
app.use(timeout('120s')); // Increased from 30s to 120s for OAuth flows
app.use((req, res, next) => {
  if (!req.timedout) next();
});

// IMPORTANT: the Razorpay webhook needs the raw, untouched request body to verify
// its signature — so this route gets a raw parser BEFORE the general express.json()
// below. Every other route continues to get normal parsed JSON as usual.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock', stockCommunicationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/order-tracking', orderTrackingRoutes);
app.use('/api', complaintRoutes);

// Health check endpoint for monitoring
app.get('/health', async (req, res) => {
  try {
    const servicesHealth = await checkServicesHealth();
    const healthcheck = {
      status: servicesHealth.overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      services: servicesHealth.checks
    };
    
    const statusCode = servicesHealth.overall === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthcheck);
  } catch (error) {
    logError('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const servicesHealth = await checkServicesHealth();
    res.json({
      status: servicesHealth.overall === 'healthy' ? 'operational' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: servicesHealth.checks
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Metrics endpoint for monitoring
app.get('/api/metrics', (req, res) => {
  res.json(metrics.getMetrics());
});

// Use enhanced error handler from middleware
app.use(errorHandler);

// 404 handler
app.use(notFoundHandler);

module.exports = app;
