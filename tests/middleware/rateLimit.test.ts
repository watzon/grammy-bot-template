import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { rateLimit } from "../../src/middleware/rateLimit";
import type { MyContext } from "../../src/types";
import { RedisService } from "../../src/services/redisService";

// Mock Redis client
const mockRedisClient = {
  eval: mock(() => Promise.resolve([1, 19])),
  hmget: mock(() => Promise.resolve(["15", "1640995200"])),
  del: mock(() => Promise.resolve(1)),
};

// Create a mock context
function createMockContext(overrides = {}) {
  return {
    chat: { id: 12345 },
    from: { id: 67890 },
    callbackQuery: null,
    me: { id: 999 },
    reply: mock(() => Promise.resolve()),
    answerCallbackQuery: mock(() => Promise.resolve()),
    ...overrides,
  } as unknown as MyContext;
}

describe("Rate Limit Middleware", () => {
  let nextFn: mock.Mock<() => Promise<void>>;
  let ctx: MyContext;

  beforeEach(() => {
    nextFn = mock(() => Promise.resolve());
    ctx = createMockContext();
    mockRedisClient.eval.mockClear();

    // Mock RedisService
    spyOn(RedisService, "getInstance").mockReturnValue(mockRedisClient);
    spyOn(RedisService, "initialize").mockImplementation(() => {});
    spyOn(RedisService, "healthCheck").mockResolvedValue(true);
  });

  describe("Basic Functionality", () => {
    it("should allow request within limits", async () => {
      mockRedisClient.eval.mockReturnValue([1, 19]); // Allowed

      await rateLimit(ctx, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(ctx.rateLimit).toBeDefined();
      expect(ctx.rateLimit?.perChat.allowed).toBe(true);
      expect(ctx.rateLimit?.global.allowed).toBe(true);
    });

    it("should skip rate limiting if no chat ID", async () => {
      ctx = createMockContext({ chat: null });

      await rateLimit(ctx, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRedisClient.eval).not.toHaveBeenCalled();
    });

    it("should pass through when rate limiting is disabled", async () => {
      // Temporarily disable rate limiting by mocking config
      const { config } = await import("../../src/config");
      Object.defineProperty(config, "rateLimit", {
        value: { enabled: false },
        writable: true,
      });

      await rateLimit(ctx, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRedisClient.eval).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.eval.mockRejectedValue(new Error("Redis connection failed"));

      await rateLimit(ctx, nextFn);

      // Should still call next() when onRedisError is 'allow'
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe("Rate Limiting Behavior", () => {
    it("should reject request when limit exceeded", async () => {
      let callCount = 0;
      mockRedisClient.eval.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? [0, 0, 3000] : [1, 29]);
      });

      await rateLimit(ctx, nextFn);

      expect(nextFn).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("Rate limit exceeded"));
    });

    it("should attach rate limit info to context", async () => {
      let callCount = 0;
      mockRedisClient.eval.mockImplementation(() => {
        callCount++;
        return Promise.resolve([1, callCount === 1 ? 15 : 25]);
      });

      await rateLimit(ctx, nextFn);

      expect(ctx.rateLimit).toBeDefined();
      expect(ctx.rateLimit?.perChat.allowed).toBe(true);
      expect(ctx.rateLimit?.global.allowed).toBe(true);
      expect(ctx.rateLimit?.perChat.remaining).toBe(15);
      expect(ctx.rateLimit?.global.remaining).toBe(25);
    });
  });
});
