import type { NextFunction } from "grammy";
import type { MyContext } from "../types";
import { config } from "../config";
import { RedisService } from "../services/redisService";
import { RateLimitService } from "../services/rateLimitService";

let rateLimiter: RateLimitService | null = null;

// Initialize rate limiter if enabled
function initializeRateLimiter() {
  if (!rateLimiter && config.rateLimit.enabled) {
    try {
      // Initialize Redis service
      RedisService.initialize(config.rateLimit.redis);

      // Check Redis connection
      const healthy = RedisService.healthCheck();
      if (!healthy) {
        console.warn("⚠️ Redis health check failed, rate limiting disabled");
        config.rateLimit.enabled = false;
        return;
      }

      rateLimiter = new RateLimitService(true);
      console.log("✅ Rate limiting initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize rate limiting:", error);
      if (config.rateLimit.behavior.onRedisError === "reject") {
        throw new Error("Redis is required for rate limiting but not available");
      }
      config.rateLimit.enabled = false;
    }
  }
}

/**
 * Rate limiting middleware that checks both per-chat and global limits
 */
export async function rateLimit(ctx: MyContext, next: NextFunction) {
  // Skip rate limiting if disabled
  if (!config.rateLimit.enabled) {
    await next();
    return;
  }

  // Initialize rate limiter if not already done
  initializeRateLimiter();

  if (!rateLimiter) {
    await next();
    return;
  }

  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  // Skip if we don't have a chat ID
  if (!chatId) {
    await next();
    return;
  }

  try {
    // Check per-chat rate limit
    const perChatResult = await rateLimiter.checkPerChatLimit(chatId);

    // Check global rate limit
    const botId = ctx.me?.id;
    const globalResult = await rateLimiter.checkGlobalLimit(botId?.toString());

    // Store results in context for potential use in handlers
    // Use type assertion to ensure the property exists
    (ctx as any).rateLimit = {
      perChat: perChatResult,
      global: globalResult,
    };

    // Check if either limit was exceeded
    if (!perChatResult.allowed || !globalResult.allowed) {
      const whichLimit = !perChatResult.allowed ? "chat" : "global";
      const retryAfter = perChatResult.retryAfter || globalResult.retryAfter;

      console.warn(`⚠️ Rate limit exceeded for ${whichLimit}: chat=${chatId}, user=${userId}`);

      // Handle based on configuration
      if (config.rateLimit.behavior.onLimit === "reject") {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({
            text: "⏱️ Please wait a moment before trying again",
            show_alert: true,
          });
        } else {
          const message = retryAfter
            ? `⏱️ Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 1000)} seconds.`
            : "⏱️ Rate limit exceeded. Please wait a moment before trying again.";
          await ctx.reply(message);
        }
        return; // Don't call next()
      } else if (config.rateLimit.behavior.onLimit === "delay") {
        // Add delay before processing
        const delay = Math.min(retryAfter || 1000, config.rateLimit.behavior.queueTimeout);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      // 'queue' would require a more complex implementation with message queuing
    }

    await next();
  } catch (error) {
    console.error("❌ Rate limiting middleware error:", error);

    // Fail open if rate limiting fails
    if (config.rateLimit.behavior.onRedisError === "allow") {
      await next();
    } else {
      console.error("🚫 Rate limiting failed and configured to reject");
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: "🚫 Service temporarily unavailable",
          show_alert: true,
        });
      } else {
        await ctx.reply("🚫 Service temporarily unavailable. Please try again later.");
      }
    }
  }
}

/**
 * Rate limiting transformer for outgoing API calls
 * This helps ensure we don't exceed Telegram's limits when sending messages
 */
export function createRateLimitTransformer() {
  return async (update: any, next: any) => {
    if (!config.rateLimit.enabled || !rateLimiter) {
      return next();
    }

    // Check if this is an outgoing message
    if (
      update.method &&
      ["sendMessage", "editMessageText", "editMessageCaption"].includes(update.method)
    ) {
      const chatId = update.chat_id;

      if (chatId) {
        // Check per-chat limit for outgoing messages
        const result = await rateLimiter.checkPerChatLimit(chatId);

        if (!result.allowed) {
          console.warn(`⚠️ Outgoing message rate limited for chat ${chatId}`);

          // For transformers, we can delay the request
          const delay = Math.min(result.retryAfter || 1000, config.rateLimit.behavior.queueTimeout);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return next();
  };
}

/**
 * Admin bypass middleware - allows specific users to bypass rate limits
 */
export function createAdminRateLimit(adminIds: number[]) {
  return async (ctx: MyContext, next: NextFunction) => {
    // Skip rate limiting for admins
    if (ctx.from?.id && adminIds.includes(ctx.from.id)) {
      await next();
      return;
    }

    // Apply regular rate limiting
    return rateLimit(ctx, next);
  };
}

/**
 * Get rate limit statistics for monitoring
 */
export async function getRateLimitStats(chatId?: number): Promise<any> {
  if (!rateLimiter) {
    return { enabled: false };
  }

  try {
    const stats: any = { enabled: true };

    if (chatId) {
      stats.chat = await rateLimiter.getStats(`rate:chat:${chatId}`);
    }

    stats.global = await rateLimiter.getStats("rate:global:default");

    return stats;
  } catch (error) {
    console.error("❌ Failed to get rate limit stats:", error);
    return { enabled: false, error: error.message };
  }
}
