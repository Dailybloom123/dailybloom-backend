const { logger } = require('./logger');

/**
 * Monitoring and Analytics Service
 * Handles error tracking, performance monitoring, and business metrics
 */

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      performance: new Map(),
      business: new Map()
    };
    this.startTime = Date.now();
  }

  /**
   * Track API request metrics
   */
  trackRequest(method, path, statusCode, duration) {
    const key = `${method}:${path}`;
    const metrics = this.metrics.requests.get(key) || {
      count: 0,
      success: 0,
      errors: 0,
      avgDuration: 0,
      statusCodeDistribution: {}
    };

    metrics.count++;
    metrics.avgDuration = (metrics.avgDuration * (metrics.count - 1) + duration) / metrics.count;
    
    if (statusCode >= 200 && statusCode < 400) {
      metrics.success++;
    } else {
      metrics.errors++;
    }

    metrics.statusCodeDistribution[statusCode] = (metrics.statusCodeDistribution[statusCode] || 0) + 1;
    this.metrics.requests.set(key, metrics);

    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request detected: ${method} ${path} - ${duration}ms`);
    }
  }

  /**
   * Track error occurrence
   */
  trackError(error, context = {}) {
    const errorKey = error.name || 'UnknownError';
    const metrics = this.metrics.errors.get(errorKey) || {
      count: 0,
      lastOccurrence: null,
      contexts: []
    };

    metrics.count++;
    metrics.lastOccurrence = new Date().toISOString();
    metrics.contexts.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      ...context
    });

    // Keep only last 10 contexts to prevent memory issues
    if (metrics.contexts.length > 10) {
      metrics.contexts = metrics.contexts.slice(-10);
    }

    this.metrics.errors.set(errorKey, metrics);
    logger.error(`Error tracked: ${errorKey}`, { message: error.message, context });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(operation, duration, metadata = {}) {
    const metrics = this.metrics.performance.get(operation) || {
      count: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      p95Duration: 0,
      samples: []
    };

    metrics.count++;
    metrics.avgDuration = (metrics.avgDuration * (metrics.count - 1) + duration) / metrics.count;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    
    metrics.samples.push(duration);
    
    // Keep only last 100 samples for percentile calculation
    if (metrics.samples.length > 100) {
      metrics.samples = metrics.samples.slice(-100);
    }
    
    // Calculate 95th percentile
    const sorted = [...metrics.samples].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    metrics.p95Duration = sorted[p95Index] || duration;

    this.metrics.performance.set(operation, metrics);

    // Log slow operations
    if (duration > 2000) {
      logger.warn(`Slow operation detected: ${operation} - ${duration}ms`, metadata);
    }
  }

  /**
   * Track business metrics
   */
  trackBusinessEvent(event, data = {}) {
    const metrics = this.metrics.business.get(event) || {
      count: 0,
      lastOccurrence: null,
      data: []
    };

    metrics.count++;
    metrics.lastOccurrence = new Date().toISOString();
    metrics.data.push({
      timestamp: new Date().toISOString(),
      ...data
    });

    // Keep only last 50 business events
    if (metrics.data.length > 50) {
      metrics.data = metrics.data.slice(-50);
    }

    this.metrics.business.set(event, metrics);
    logger.info(`Business event: ${event}`, data);
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      uptime: Date.now() - this.startTime,
      requests: Object.fromEntries(this.metrics.requests),
      errors: Object.fromEntries(this.metrics.errors),
      performance: Object.fromEntries(this.metrics.performance),
      business: Object.fromEntries(this.metrics.business)
    };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const errorRate = this.calculateErrorRate();
    const avgResponseTime = this.calculateAvgResponseTime();

    return {
      status: errorRate < 0.05 && avgResponseTime < 1000 ? 'healthy' : 'degraded',
      uptime: metrics.uptime,
      errorRate,
      avgResponseTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    let totalRequests = 0;
    let totalErrors = 0;

    for (const [_, metrics] of this.metrics.requests) {
      totalRequests += metrics.count;
      totalErrors += metrics.errors;
    }

    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  /**
   * Calculate average response time
   */
  calculateAvgResponseTime() {
    let totalDuration = 0;
    let totalRequests = 0;

    for (const [_, metrics] of this.metrics.requests) {
      totalDuration += metrics.avgDuration * metrics.count;
      totalRequests += metrics.count;
    }

    return totalRequests > 0 ? totalDuration / totalRequests : 0;
  }

  /**
   * Reset metrics (useful for testing or periodic cleanup)
   */
  resetMetrics() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      performance: new Map(),
      business: new Map()
    };
    this.startTime = Date.now();
    logger.info('Metrics reset');
  }
}

// Singleton instance
const monitoring = new MonitoringService();

module.exports = monitoring;
