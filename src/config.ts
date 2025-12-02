import dotenv from "dotenv";
dotenv.config();

export interface RateLimitConfig {
  enabled: boolean;
  redis: {
    url: string;
    connectionTimeout: number;
    maxRetries: number;
    idleTimeout: number;
  };
  limits: {
    perChat: {
      messages: number;
      window: number; // milliseconds
    };
    global: {
      messages: number;
      window: number; // milliseconds
    };
    broadcast: {
      messages: number;
      window: number; // milliseconds
    };
  };
  behavior: {
    onLimit: "queue" | "reject" | "delay";
    onRedisError: "allow" | "reject";
    queueTimeout: number; // milliseconds
  };
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === "true",
    redis: {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || "10000"),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || "5"),
      idleTimeout: parseInt(process.env.REDIS_IDLE_TIMEOUT || "30000"),
    },
    limits: {
      perChat: {
        messages: parseInt(process.env.RATE_LIMIT_PER_CHAT_MESSAGES || "20"),
        window: parseInt(process.env.RATE_LIMIT_PER_CHAT_WINDOW || "60000"), // 1 minute
      },
      global: {
        messages: parseInt(process.env.RATE_LIMIT_GLOBAL_MESSAGES || "30"),
        window: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW || "1000"), // 1 second
      },
      broadcast: {
        messages: parseInt(process.env.RATE_LIMIT_BROADCAST_MESSAGES || "15"),
        window: parseInt(process.env.RATE_LIMIT_BROADCAST_WINDOW || "60000"), // 1 minute
      },
    },
    behavior: {
      onLimit: (process.env.RATE_LIMIT_ON_LIMIT || "reject") as "queue" | "reject" | "delay",
      onRedisError: (process.env.RATE_LIMIT_ON_REDIS_ERROR || "allow") as "allow" | "reject",
      queueTimeout: parseInt(process.env.RATE_LIMIT_QUEUE_TIMEOUT || "5000"), // 5 seconds
    },
  } as RateLimitConfig,
};

export function validateConfig() {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN is not defined in .env");
  }
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is not defined in .env");
  }

  // Validate rate limit config if enabled
  if (config.rateLimit.enabled) {
    if (!config.rateLimit.redis.url) {
      console.warn(
        "⚠️ RATE_LIMIT_ENABLED is true but REDIS_URL is not configured, rate limiting will be disabled",
      );
      config.rateLimit.enabled = false;
    }

    // Validate limit values
    if (
      config.rateLimit.limits.perChat.messages <= 0 ||
      config.rateLimit.limits.perChat.window <= 0
    ) {
      throw new Error(
        "RATE_LIMIT_PER_CHAT_MESSAGES and RATE_LIMIT_PER_CHAT_WINDOW must be positive numbers",
      );
    }

    if (
      config.rateLimit.limits.global.messages <= 0 ||
      config.rateLimit.limits.global.window <= 0
    ) {
      throw new Error(
        "RATE_LIMIT_GLOBAL_MESSAGES and RATE_LIMIT_GLOBAL_WINDOW must be positive numbers",
      );
    }
  }
}
