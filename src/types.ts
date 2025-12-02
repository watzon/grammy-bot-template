import type { Context } from "grammy";
import type { RateLimitResult } from "./services/rateLimitService";

export interface RateLimitInfo {
  perChat: RateLimitResult;
  global: RateLimitResult;
}

export type MyContext = Context & {
  rateLimit?: RateLimitInfo;
};
