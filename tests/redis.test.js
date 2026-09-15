const {
  get,
  set,
  del,
  delPattern,
  flushAll
} = require('../src/config/redis');

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    flushAll: jest.fn()
  }))
}));

describe('Redis Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed JSON for valid data', async () => {
      const mockData = { name: 'test', value: 123 };
      const redis = require('redis').createClient();
      redis.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await get('test-key');
      expect(result).toEqual(mockData);
    });

    it('should return null for non-existent key', async () => {
      const redis = require('redis').createClient();
      redis.get.mockResolvedValue(null);

      const result = await get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const redis = require('redis').createClient();
      redis.get.mockRejectedValue(new Error('Redis error'));

      const result = await get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const redis = require('redis').createClient();
      redis.setEx.mockResolvedValue('OK');

      const result = await set('test-key', { data: 'test' });
      expect(result).toBe(true);
    });

    it('should set value with custom TTL', async () => {
      const redis = require('redis').createClient();
      redis.setEx.mockResolvedValue('OK');

      const result = await set('test-key', { data: 'test' }, 600);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const redis = require('redis').createClient();
      redis.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await set('test-key', { data: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('del', () => {
    it('should delete key successfully', async () => {
      const redis = require('redis').createClient();
      redis.del.mockResolvedValue(1);

      const result = await del('test-key');
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const redis = require('redis').createClient();
      redis.del.mockRejectedValue(new Error('Redis error'));

      const result = await del('test-key');
      expect(result).toBe(false);
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      const redis = require('redis').createClient();
      redis.keys.mockResolvedValue(['key1', 'key2']);
      redis.del.mockResolvedValue(2);

      const result = await delPattern('products:*');
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const redis = require('redis').createClient();
      redis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await delPattern('products:*');
      expect(result).toBe(false);
    });
  });

  describe('flushAll', () => {
    it('should flush all keys', async () => {
      const redis = require('redis').createClient();
      redis.flushAll.mockResolvedValue('OK');

      const result = await flushAll();
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const redis = require('redis').createClient();
      redis.flushAll.mockRejectedValue(new Error('Redis error'));

      const result = await flushAll();
      expect(result).toBe(false);
    });
  });
});
