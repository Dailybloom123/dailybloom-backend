const redis = require('redis');

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Too many retries');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });

    redisClient.on('reconnecting', () => {
      console.log('⚠️ Redis Client Reconnecting...');
    });
  }

  return redisClient;
}

async function get(key) {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

async function set(key, value, ttl = 3600) {
  try {
    const client = getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
}

async function del(key) {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
}

async function delPattern(pattern) {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (error) {
    console.error('Redis DEL pattern error:', error);
    return false;
  }
}

async function flushAll() {
  try {
    const client = getRedisClient();
    await client.flushAll();
    return true;
  } catch (error) {
    console.error('Redis FLUSH error:', error);
    return false;
  }
}

module.exports = {
  getRedisClient,
  get,
  set,
  del,
  delPattern,
  flushAll
};
