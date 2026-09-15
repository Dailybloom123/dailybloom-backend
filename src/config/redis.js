const redis = require('redis');

let redisClient = null;
let redisAvailable = false;

function getRedisClient() {
  if (!redisClient && process.env.REDIS_URL) {
    try {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              redisAvailable = false;
              return new Error('Too many retries');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        redisAvailable = false;
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis Client Connected');
        redisAvailable = true;
      });

      redisClient.on('reconnecting', () => {
        console.log('⚠️ Redis Client Reconnecting...');
      });

      // Connect to Redis
      redisClient.connect().catch(err => {
        console.error('Failed to connect to Redis:', err);
        redisAvailable = false;
      });
    } catch (error) {
      console.error('Failed to create Redis client:', error);
      redisAvailable = false;
    }
  }

  return redisClient;
}

async function get(key) {
  if (!process.env.REDIS_URL) {
    return null; // Redis not configured
  }

  try {
    const client = getRedisClient();
    if (!client || !redisAvailable) {
      return null;
    }
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

async function set(key, value, ttl = 3600) {
  if (!process.env.REDIS_URL) {
    return false; // Redis not configured
  }

  try {
    const client = getRedisClient();
    if (!client || !redisAvailable) {
      return false;
    }
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
}

async function del(key) {
  if (!process.env.REDIS_URL) {
    return false; // Redis not configured
  }

  try {
    const client = getRedisClient();
    if (!client || !redisAvailable) {
      return false;
    }
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
}

async function delPattern(pattern) {
  if (!process.env.REDIS_URL) {
    return false; // Redis not configured
  }

  try {
    const client = getRedisClient();
    if (!client || !redisAvailable) {
      return false;
    }
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
  if (!process.env.REDIS_URL) {
    return false; // Redis not configured
  }

  try {
    const client = getRedisClient();
    if (!client || !redisAvailable) {
      return false;
    }
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
