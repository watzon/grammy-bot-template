import { RedisClient } from "bun";

export interface RedisConfig {
  url: string;
  connectionTimeout: number;
  maxRetries: number;
  idleTimeout: number;
  enableOfflineQueue: boolean;
  enableAutoPipelining: boolean;
}

export class RedisService {
  private static instance: RedisClient | null = null;
  private static config: RedisConfig;
  private static isConnected: boolean = false;

  static initialize(config: Partial<RedisConfig> = {}): void {
    const defaultConfig: RedisConfig = {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      connectionTimeout: 10000,
      maxRetries: 5,
      idleTimeout: 30000,
      enableOfflineQueue: true,
      enableAutoPipelining: true,
      ...config,
    };

    RedisService.config = defaultConfig;
  }

  static getInstance(): RedisClient {
    if (!RedisService.instance) {
      if (!RedisService.config) {
        RedisService.initialize();
      }

      try {
        RedisService.instance = new RedisClient(RedisService.config.url, {
          connectionTimeout: RedisService.config.connectionTimeout,
          idleTimeout: RedisService.config.idleTimeout,
          autoReconnect: true,
          maxRetries: RedisService.config.maxRetries,
          enableOfflineQueue: RedisService.config.enableOfflineQueue,
          enableAutoPipelining: RedisService.config.enableAutoPipelining,
          tls: RedisService.config.url.startsWith("rediss://"),
        });

        RedisService.isConnected = true;
        console.log("✅ Redis connected successfully");
      } catch (error) {
        RedisService.isConnected = false;
        console.error("❌ Failed to connect to Redis:", error);
        throw error;
      }
    }

    return RedisService.instance;
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const client = RedisService.getInstance();
      await client.ping();
      RedisService.isConnected = true;
      return true;
    } catch (error) {
      RedisService.isConnected = false;
      console.warn("⚠️ Redis health check failed:", error);
      return false;
    }
  }

  static isRedisConnected(): boolean {
    return RedisService.isConnected;
  }

  static async disconnect(): Promise<void> {
    if (RedisService.instance) {
      try {
        await RedisService.instance.quit();
        RedisService.instance = null;
        RedisService.isConnected = false;
        console.log("✅ Redis disconnected successfully");
      } catch (error) {
        console.error("❌ Error disconnecting from Redis:", error);
      }
    }
  }

  static getConfig(): RedisConfig {
    return RedisService.config;
  }
}

// Export a singleton instance for backward compatibility
export const redis = RedisService.getInstance();
