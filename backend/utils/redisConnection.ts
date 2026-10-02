import { raw as envRaw } from "./config";

export interface RedisConnectionOpts {
  host: string;
  port: number;
  password?: string;
  username?: string;
}

/** Turns a redis:// URL into the {host, port, password, username} shape BullMQ/ioredis accept. */
export const parseRedisUrl = (url: string): RedisConnectionOpts => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username && parsed.username !== "default" ? parsed.username : undefined,
  };
};

/** Shared BullMQ connection options (REDIS_PUBLIC_URL). */
export const bullmqConnection = (): RedisConnectionOpts =>
  parseRedisUrl(envRaw("REDIS_PUBLIC_URL") || "redis://localhost:6379");
