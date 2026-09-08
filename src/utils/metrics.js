const { logger } = require('./logger');

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        byRoute: {},
        byMethod: {}
      },
      orders: {
        created: 0,
        accepted: 0,
        delivered: 0,
        cancelled: 0
      },
      partners: {
        active: 0,
        blocked: 0,
        assigned: 0
      },
      performance: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        responseTimes: []
      }
    };
  }

  recordRequest(method, path, statusCode, duration) {
    this.metrics.requests.total++;
    
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }

    const routeKey = `${method} ${path}`;
    this.metrics.requests.byRoute[routeKey] = (this.metrics.requests.byRoute[routeKey] || 0) + 1;
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;

    this.recordPerformance(duration);
  }

  recordPerformance(duration) {
    this.metrics.performance.responseTimes.push(duration);
    
    // Keep only last 1000 measurements
    if (this.metrics.performance.responseTimes.length > 1000) {
      this.metrics.performance.responseTimes.shift();
    }

    const times = this.metrics.performance.responseTimes;
    times.sort((a, b) => a - b);
    
    this.metrics.performance.avgResponseTime = 
      times.reduce((sum, t) => sum + t, 0) / times.length;
    this.metrics.performance.p95ResponseTime = times[Math.floor(times.length * 0.95)];
    this.metrics.performance.p99ResponseTime = times[Math.floor(times.length * 0.99)];
  }

  recordOrderEvent(event) {
    if (this.metrics.orders[event] !== undefined) {
      this.metrics.orders[event]++;
    }
  }

  recordPartnerEvent(event) {
    if (this.metrics.partners[event] !== undefined) {
      this.metrics.partners[event]++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  reset() {
    this.metrics.performance.responseTimes = [];
    logger.info('Metrics reset');
  }
}

const metrics = new MetricsCollector();

module.exports = { metrics };