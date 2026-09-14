const db = require('../config/db');

async function checkDatabaseHealth() {
  try {
    const result = await db.query('SELECT NOW() as current_time');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      latency: 0 // We could measure actual latency here
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function checkServicesHealth() {
  const checks = {
    database: await checkDatabaseHealth(),
    cache: { status: 'active' }, // NodeCache is always active unless it crashes
    timestamp: new Date().toISOString()
  };
  
  // Only check services that have a status field
  const serviceChecks = Object.entries(checks).filter(([key, value]) => 
    key !== 'timestamp' && value.status
  );
  
  const allHealthy = serviceChecks.every(([key, value]) => 
    value.status === 'healthy' || value.status === 'active'
  );
  
  return {
    overall: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  checkDatabaseHealth,
  checkServicesHealth
};