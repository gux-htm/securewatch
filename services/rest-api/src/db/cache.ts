import NodeCache from 'node-cache';

// TTL in seconds — mirrors what Redis would have been
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const Cache = {
  get: (key: string): string | undefined => {
    return cache.get<string>(key);
  },

  set: (key: string, value: string, ttlSeconds?: number): boolean => {
    return cache.set(key, value, ttlSeconds ?? 300);
  },

  del: (key: string): number => {
    return cache.del(key);
  },

  incr: (key: string): number => {
    const current = cache.get<number>(key) ?? 0;
    const next = current + 1;
    cache.set(key, next);
    return next;
  },

  expire: (key: string, ttlSeconds: number): boolean => {
    return cache.ttl(key, ttlSeconds);
  },

  exists: (key: string): boolean => {
    return cache.has(key);
  },
};

export default Cache;
