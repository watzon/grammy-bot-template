# Rate Limiting Guide

This Grammy bot template includes built-in rate limiting to help you stay within Telegram's API limits and avoid temporary blocks.

## Overview

Telegram enforces strict rate limits on bots:
- **20 messages per minute** in the same chat
- **30 messages per second** across all chats
- **Stricter limits** for media messages and broadcasts

The rate limiting middleware automatically enforces these limits using Redis as a backend, allowing your bot to scale across multiple instances while maintaining accurate rate limits.

## Quick Start

1. **Install Redis** (if not already installed):
   ```bash
   # macOS
   brew install redis

   # Ubuntu/Debian
   sudo apt-get install redis-server

   # Docker
   docker run -d -p 6379:6379 redis
   ```

2. **Configure your `.env` file**:
   ```bash
   # Enable rate limiting
   RATE_LIMIT_ENABLED=true

   # Redis connection
   REDIS_URL=redis://localhost:6379
   ```

3. **Start your bot**:
   ```bash
   bun run dev
   ```

Your bot is now protected by rate limiting!

## Configuration

### Basic Configuration

```bash
# Enable/disable rate limiting
RATE_LIMIT_ENABLED=true

# Redis connection (required when enabled)
REDIS_URL=redis://localhost:6379
REDIS_CONNECTION_TIMEOUT=10000
REDIS_MAX_RETRIES=5
REDIS_IDLE_TIMEOUT=30000
```

### Limit Overrides

You can customize the rate limits (though Telegram's defaults are recommended):

```bash
# Per-chat limits (default: 20 messages/minute)
RATE_LIMIT_PER_CHAT_MESSAGES=20
RATE_LIMIT_PER_CHAT_WINDOW=60000

# Global limits (default: 30 messages/second)
RATE_LIMIT_GLOBAL_MESSAGES=30
RATE_LIMIT_GLOBAL_WINDOW=1000

# Broadcast limits (stricter: 15 messages/minute)
RATE_LIMIT_BROADCAST_MESSAGES=15
RATE_LIMIT_BROADCAST_WINDOW=60000
```

### Behavior Configuration

```bash
# What to do when limits are exceeded
RATE_LIMIT_ON_LIMIT=reject        # Options: reject, delay, queue

# What to do when Redis is unavailable
RATE_LIMIT_ON_REDIS_ERROR=allow    # Options: allow, reject

# Maximum time to wait when queueing/delaying
RATE_LIMIT_QUEUE_TIMEOUT=5000      # milliseconds
```

## Features

### 1. Automatic Rate Limiting

The middleware automatically tracks and enforces rate limits for:
- Incoming message processing
- Outgoing API calls
- Per-chat and global limits

### 2. Graceful Fallback

If Redis becomes unavailable:
- **Default behavior**: Continue operating without rate limiting
- **Configurable**: Can reject all requests if you prefer
- **Automatic recovery**: Reconnects when Redis is back

### 3. Multi-Instance Support

Multiple bot instances share the same Redis instance, ensuring:
- Global limits are respected across all instances
- Per-chat limits remain consistent
- No double-counting of messages

### 4. Statistics

Monitor your rate limiting with the `/rateLimit` command:
```
/rateLimit
```

Shows remaining tokens for both chat and global limits.

## Advanced Usage

### Custom Rate Limiting

```typescript
import { RateLimitService } from "./src/services/rateLimitService";

const rateLimiter = new RateLimitService(true);

// Check custom limits
const result = await rateLimiter.checkTokenBucket("custom:key", {
  capacity: 100,
  refillRate: 10, // 10 tokens per second
});

if (!result.allowed) {
  console.log(`Rate limited. Retry after: ${result.retryAfter}ms`);
}
```

### Admin Bypass

Create middleware that bypasses rate limiting for admin users:

```typescript
import { createAdminRateLimit } from "./src/middleware/rateLimit";

const ADMIN_IDS = [12345, 67890];
bot.use(createAdminRateLimit(ADMIN_IDS));
```

### Custom Rate Limiting Logic

```typescript
import { rateLimit } from "./src/middleware/rateLimit";
import type { MyContext } from "./src/types";

// Custom rate limiting middleware
bot.use(async (ctx: MyContext, next) => {
  // Skip rate limiting for premium users
  if (ctx.from?.id && await isPremiumUser(ctx.from.id)) {
    return next();
  }

  // Apply standard rate limiting
  return rateLimit(ctx, next);
});
```

## Algorithm: Token Bucket

The rate limiting uses the **token bucket algorithm**, which provides:
- **Smooth traffic control**: Gradual refill of tokens
- **Burst capacity**: Can handle short bursts within limits
- **Fair distribution**: Equitable sharing across users

### How It Works

1. **Bucket**: Each limit type has a bucket with tokens
2. **Refill**: Tokens are added at a constant rate
3. **Consume**: Each message consumes one token
4. **Check**: If no tokens, request is limited

## Troubleshooting

### Redis Connection Issues

**Symptom**: Rate limiting disabled with warning
```text
⚠️ Redis not available, rate limiting disabled
```

**Solution**: Check Redis connection:
```bash
# Test Redis connection
redis-cli ping

# Check Redis is running
brew services list | grep redis  # macOS
sudo systemctl status redis     # Linux
```

### Rate Limiting Too Strict

**Symptom**: Bot responds slowly or not at all

**Solution**:
1. Check your limits with `/rateLimit` command
2. Adjust limits in configuration
3. Consider using `delay` instead of `reject`:
   ```bash
   RATE_LIMIT_ON_LIMIT=delay
   ```

### Performance Issues

**Symptom**: High latency on message processing

**Solution**:
1. Ensure Redis is on the same network
2. Check Redis memory usage
3. Monitor rate limit check performance
4. Consider Redis clustering for high traffic

## Monitoring

### Health Checks

```typescript
import { RedisService } from "./src/services/redisService";

// Check Redis health
const isHealthy = await RedisService.healthCheck();
if (!isHealthy) {
  console.warn("Redis is unhealthy!");
}
```

### Statistics

```typescript
import { getRateLimitStats } from "./src/middleware/rateLimit";

const stats = await getRateLimitStats(chatId);
console.log("Rate limit stats:", stats);
```

### Metrics to Monitor

- **Redis memory usage**: Should stay under 10MB for 10k active chats
- **Rate limit check latency**: Should be <1ms per check
- **Rate limit hit rate**: How often limits are exceeded
- **Redis connection stability**: Uptime and reconnection events

## Best Practices

### 1. Production Deployment

- Use Redis Cluster for high availability
- Set up Redis monitoring and alerts
- Configure Redis persistence to prevent data loss
- Use connection pooling for better performance

### 2. Configuration

- Start with Telegram's default limits
- Adjust based on your bot's usage patterns
- Set `RATE_LIMIT_ON_REDIS_ERROR=allow` for better availability
- Use `reject` mode to prevent spam

### 3. Error Handling

- Always handle rate limit rejections gracefully
- Provide user feedback when limits are hit
- Log rate limit events for debugging
- Set up alerts for frequent limit violations

### 4. Performance

- Keep Redis on the same network as your bot
- Use Redis pipelining for better performance
- Monitor Redis memory usage
- Clean up unused keys periodically

## Migration Guide

### From No Rate Limiting

1. Set up Redis
2. Add rate limiting configuration to `.env`
3. Enable rate limiting: `RATE_LIMIT_ENABLED=true`
4. Test in development first
5. Deploy to production gradually

### From Custom Rate Limiting

1. Backup your current implementation
2. Configure new rate limiting to match your current limits
3. Test thoroughly
4. Switch to the new implementation
5. Remove old code

## Examples

### Basic Setup
```typescript
import { createBot } from "./src/bot";

const bot = createBot();
bot.start();
```

### With Custom Limits
```typescript
// .env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_CHAT_MESSAGES=10
RATE_LIMIT_GLOBAL_MESSAGES=20
```

### Admin Bypass
```typescript
import { createAdminRateLimit } from "./src/middleware/rateLimit";

const ADMINS = [12345, 67890];
bot.use(createAdminRateLimit(ADMINS));
```

## Support

If you encounter issues:
1. Check the [troubleshooting section](#troubleshooting)
2. Review your Redis configuration
3. Verify your environment variables
4. Check the logs for error messages
5. Create an issue with details about your setup

---

*Rate limiting helps ensure your bot stays reliable and respectful of Telegram's limits. Configure it properly for a smooth user experience!*