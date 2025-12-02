import { RedisService } from "./redisService";
import type { RedisClient } from "bun";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number; // tokens per second
}

// Lua script for atomic token bucket operations
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local tokens = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local currentTokens = tonumber(bucket[1]) or capacity
local lastRefill = tonumber(bucket[2]) or now

-- Refill tokens based on time elapsed
local elapsed = now - lastRefill
local tokensToAdd = elapsed * refillRate
currentTokens = math.min(capacity, currentTokens + tokensToAdd)

if currentTokens >= tokens then
  currentTokens = currentTokens - tokens
  redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', now)
  redis.call('EXPIRE', key, math.ceil(capacity / refillRate))
  return {1, capacity - currentTokens}
else
  redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', now)
  redis.call('EXPIRE', key, math.ceil(capacity / refillRate))
  local retryAfter = math.ceil((tokens - currentTokens) / refillRate)
  return {0, 0, retryAfter}
end
`;

export class RateLimitService {
  private redis: RedisClient | null = null;
  private enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    if (enabled) {
      try {
        this.redis = RedisService.getInstance();
      } catch (error) {
        console.warn("⚠️ Redis not available, rate limiting disabled:", error);
        this.enabled = false;
      }
    }
  }

  /**
   * Check rate limit using token bucket algorithm
   */
  async checkTokenBucket(
    key: string,
    config: TokenBucketConfig,
    tokens: number = 1,
  ): Promise<RateLimitResult> {
    // Fallback if Redis is not available
    if (!this.enabled || !this.redis) {
      return {
        allowed: true,
        remaining: config.capacity,
        reset: Date.now() + 60000,
      };
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const result = (await this.redis.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        key,
        config.capacity,
        tokens,
        config.refillRate,
        now,
      )) as number[];

      const allowed = result[0] === 1;
      const remaining = result[1];
      const retryAfter = result[2];

      return {
        allowed,
        remaining,
        reset: Date.now() + (config.capacity / config.refillRate) * 1000,
        retryAfter: retryAfter ? retryAfter * 1000 : undefined,
      };
    } catch (error) {
      console.error("❌ Rate limit check failed:", error);
      // Fail open - allow the request if Redis fails
      return {
        allowed: true,
        remaining: config.capacity,
        reset: Date.now() + 60000,
      };
    }
  }

  /**
   * Check per-chat rate limit (20 messages per minute)
   */
  async checkPerChatLimit(chatId: number, tokens: number = 1): Promise<RateLimitResult> {
    const key = `rate:chat:${chatId}`;
    const config: TokenBucketConfig = {
      capacity: 20, // 20 messages
      refillRate: 20 / 60, // 20 messages per minute
    };

    return this.checkTokenBucket(key, config, tokens);
  }

  /**
   * Check global rate limit (30 messages per second)
   */
  async checkGlobalLimit(botId?: string, tokens: number = 1): Promise<RateLimitResult> {
    const botKey = botId || "default";
    const key = `rate:global:${botKey}`;
    const config: TokenBucketConfig = {
      capacity: 30, // 30 messages
      refillRate: 30, // 30 messages per second
    };

    return this.checkTokenBucket(key, config, tokens);
  }

  /**
   * Check broadcast rate limit (stricter limits for broadcasts)
   */
  async checkBroadcastLimit(botId?: string, tokens: number = 1): Promise<RateLimitResult> {
    const botKey = botId || "default";
    const key = `rate:broadcast:${botKey}`;
    const config: TokenBucketConfig = {
      capacity: 15, // 15 messages per minute for broadcasts
      refillRate: 15 / 60, // 15 messages per minute
    };

    return this.checkTokenBucket(key, config, tokens);
  }

  /**
   * Get current statistics for a rate limit key
   */
  async getStats(key: string): Promise<{
    tokens: number;
    lastRefill: number;
    capacity?: number;
  }> {
    if (!this.enabled || !this.redis) {
      return { tokens: 0, lastRefill: 0 };
    }

    try {
      const result = await this.redis.hmget(key, "tokens", "lastRefill");
      return {
        tokens: parseInt(result[0] || "0"),
        lastRefill: parseInt(result[1] || "0"),
      };
    } catch (error) {
      console.error("❌ Failed to get rate limit stats:", error);
      return { tokens: 0, lastRefill: 0 };
    }
  }

  /**
   * Reset a rate limit key
   */
  async reset(key: string): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("❌ Failed to reset rate limit:", error);
    }
  }

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable rate limiting
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Export default instance
export const rateLimiter = new RateLimitService();
