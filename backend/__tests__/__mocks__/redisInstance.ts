// Mock Redis instance for unit tests
const mockRedisStore: Record<string, unknown> = {};

export const redis = {
  get: jest.fn((key: string) => Promise.resolve(mockRedisStore[key] ? JSON.stringify(mockRedisStore[key]) : null)),
  set: jest.fn((key: string, value: string) => {
    mockRedisStore[key] = JSON.parse(value);
    return Promise.resolve('OK');
  }),
  del: jest.fn((key: string) => {
    delete mockRedisStore[key];
    return Promise.resolve(1);
  }),
  keys: jest.fn(() => Promise.resolve(Object.keys(mockRedisStore))),
  expire: jest.fn(() => Promise.resolve(1)),
};

export const getRedisItem = jest.fn((key: string) => {
  return Promise.resolve(mockRedisStore[key] || null);
});

export const setRedisItem = jest.fn((key: string, value: unknown) => {
  mockRedisStore[key] = value;
  return Promise.resolve();
});

export const setRedisItemWithTTL = jest.fn((key: string, value: unknown, _ttl: number) => {
  mockRedisStore[key] = value;
  return Promise.resolve();
});

export const deleteRedisItem = jest.fn((key: string) => {
  delete mockRedisStore[key];
  return Promise.resolve();
});

export const setRedisTTL = jest.fn(() => Promise.resolve());

export const acquireLock = jest.fn(() => Promise.resolve(true));
export const releaseLock = jest.fn(() => Promise.resolve());

export const connectRedis = jest.fn(() => Promise.resolve());

// Helper for tests to clear mock store
export const __clearMockStore = () => {
  Object.keys(mockRedisStore).forEach(k => delete mockRedisStore[k]);
};

export const __setMockData = (key: string, value: unknown) => {
  mockRedisStore[key] = value;
};
