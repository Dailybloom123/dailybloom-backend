const winston = require('winston');
const path = require('path');

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom colors for console output
const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  http: '\x1b[35m',
  debug: '\x1b[32m',
  reset: '\x1b[0m',
};

// Custom format with timestamps and colors
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    const color = colors[level] || colors.reset;
    let msg = `${color}[${timestamp}]\t${level.toUpperCase()}${colors.reset}\t${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    if (stack) {
      msg += `\n${stack}`;
    }
    
    return msg;
  })
);

// Create logs directory
const logsDir = path.join(__dirname, '../../logs');

// Create different transports for different log levels
const transports = [
  // Console transport with colors
  new winston.transports.Console({
    format: customFormat,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for errors only
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for API requests
  new winston.transports.File({
    filename: path.join(logsDir, 'api.log'),
    level: 'http',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create logger instance
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  transports,
  exitOnError: false, // Don't exit on error
});

// Logging helper functions
const logApiRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
};

const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context
  });
};

const logInfo = (message, context = {}) => {
  logger.info({
    message,
    ...context
  });
};

const logWarn = (message, context = {}) => {
  logger.warn({
    message,
    ...context
  });
};

const logDebug = (message, context = {}) => {
  logger.debug({
    message,
    ...context
  });
};

// Performance monitoring
const logPerformance = (operation, duration, context = {}) => {
  logger.info({
    message: `Performance: ${operation}`,
    duration: `${duration}ms`,
    ...context
  });
};

// Security event logging
const logSecurityEvent = (event, details = {}) => {
  logger.warn({
    message: `Security Event: ${event}`,
    ...details
  });
};

module.exports = {
  logger,
  logApiRequest,
  logError,
  logInfo,
  logWarn,
  logDebug,
  logPerformance,
  logSecurityEvent
};