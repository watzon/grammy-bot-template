import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { RateLimitService } from "../../src/services/rateLimitService";
import { RedisService } from "../../src/services/redisService";

// Mock Redis client
const mockRedisClient = {
  eval: mock(() => Promise.resolve([1, 19])),
  hmget: mock(() => Promise.resolve(["19", "1640995200"])),
  del: mock(() => Promise.resolve(1)),
};

describe("RateLimitService", () => {
  let rateLimiter: RateLimitService;

  beforeEach(() => {
    // Mock RedisService
    spyOn(RedisService, "getInstance").mockReturnValue(mockRedisClient);
    spyOn(RedisService, "initialize").mockImplementation(() => {});

    rateLimiter = new RateLimitService(true);
    mockRedisClient.eval.mockClear();
  });

  describe("Token Bucket Algorithm", () => {
    it("should allow request when tokens are available", async () => {
      mockRedisClient.eval.mockReturnValue([1, 19]);

      const result = await rateLimiter.checkTokenBucket("test-key", {
        capacity: 20,
        refillRate: 20 / 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it("should deny request when no tokens are available", async () => {
      mockRedisClient.eval.mockReturnValue([0, 0, 3000]);

      const result = await rateLimiter.checkTokenBucket("test-key", {
        capacity: 20,
        refillRate: 20 / 60,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(3000);
    });
  });

  describe("Per-Chat Rate Limiting", () => {
    it("should check per-chat limits", async () => {
      mockRedisClient.eval.mockReturnValue([1, 19]);

      const result = await rateLimiter.checkPerChatLimit(12345);

      expect(result.allowed).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "rate:chat:12345",
        20,
        1,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe("Global Rate Limiting", () => {
    it("should check global limits", async () => {
      mockRedisClient.eval.mockReturnValue([1, 29]);

      const result = await rateLimiter.checkGlobalLimit();

      expect(result.allowed).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "rate:global:default",
        30,
        1,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe("Broadcast Rate Limiting", () => {
    it("should check broadcast limits", async () => {
      mockRedisClient.eval.mockReturnValue([1, 14]);

      const result = await rateLimiter.checkBroadcastLimit();

      expect(result.allowed).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "rate:broadcast:default",
        15,
        1,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe("Error Handling", () => {
    it("should fail open when Redis is unavailable", async () => {
      const rateLimiterNoRedis = new RateLimitService(false);

      const result = await rateLimiterNoRedis.checkPerChatLimit(12345);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.eval.mockRejectedValue(new Error("Redis connection failed"));

      const result = await rateLimiter.checkPerChatLimit(12345);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);
    });
  });

  describe("Statistics", () => {
    it("should get current statistics", async () => {
      mockRedisClient.hmget.mockReturnValue(["15", "1640995200"]);

      const stats = await rateLimiter.getStats("rate:chat:12345");

      expect(stats.tokens).toBe(15);
      expect(stats.lastRefill).toBe(1640995200);
    });

    it("should handle stats errors gracefully", async () => {
      mockRedisClient.hmget.mockRejectedValue(new Error("Redis error"));

      const stats = await rateLimiter.getStats("rate:chat:12345");

      expect(stats.tokens).toBe(0);
      expect(stats.lastRefill).toBe(0);
    });
  });

  describe("Enable/Disable", () => {
    it("should be enabled by default", () => {
      expect(rateLimiter.isEnabled()).toBe(true);
    });

    it("should allow disabling", () => {
      rateLimiter.setEnabled(false);
      expect(rateLimiter.isEnabled()).toBe(false);
    });

    it("should allow re-enabling", () => {
      rateLimiter.setEnabled(false);
      rateLimiter.setEnabled(true);
      expect(rateLimiter.isEnabled()).toBe(true);
    });
  });
});
