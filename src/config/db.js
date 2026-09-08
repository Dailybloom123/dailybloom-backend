const { Pool } = require('pg');
require('dotenv').config();

// Enhanced database configuration with robust error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  min: 2, // Minimum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  acquireTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be acquired
});

// Enhanced error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  // Don't exit process in production, just log the error
  if (process.env.NODE_ENV === 'production') {
    console.error('Database error occurred but process continues running');
  } else {
    process.exit(1);
  }
});

// Monitor pool health with better logging
pool.on('connect', (client) => {
  console.log('New client connected to database pool');
  console.log('Pool status:', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

pool.on('remove', () => {
  console.log('Client removed from database pool');
  console.log('Pool status:', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

// Query wrapper with retry logic and enhanced error handling
const queryWithRetry = async (text, params, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 1 second)
      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.code && error.code.startsWith('4')) {
        throw error;
      }
      
      // Retry on connection errors or server errors (5xx)
      if (attempt < maxRetries) {
        console.warn(`Query attempt ${attempt} failed, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  throw lastError;
};

// Health check function
const checkDatabaseHealth = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    return {
      status: 'healthy',
      timestamp: result.rows[0].now,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('Closing database pool...');
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Handle process termination
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
  query: queryWithRetry,
  pool,
  checkDatabaseHealth,
  shutdown
};
