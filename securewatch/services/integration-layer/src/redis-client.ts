import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;

export function createRedisClient(host: string, port: number): Redis {
  const client = new Redis({ host, port, lazyConnect: true });
  redisInstance = client;
  return client;
}

export function getRedis(): Redis {
  if (!redisInstance) {
    throw new Error('Redis client not initialised');
  }
  return redisInstance;
}
