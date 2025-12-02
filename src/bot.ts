import { Bot } from "grammy";
import { config } from "./config";
import type { MyContext } from "./types";
import { logger } from "./middleware/logger";
import { rateLimit, createRateLimitTransformer } from "./middleware/rateLimit";
import { startCommand } from "./commands/start";

export function createBot() {
  if (!config.botToken) {
    throw new Error("Bot token not found");
  }

  const bot = new Bot<MyContext>(config.botToken);

  // Middleware (order matters!)
  // Rate limiting should be one of the first middleware
  if (config.rateLimit.enabled) {
    console.log("🚦 Rate limiting enabled");
    bot.use(rateLimit);

    // Add transformer for outgoing API calls
    bot.use(createRateLimitTransformer());
  } else {
    console.log("⚡ Rate limiting disabled");
  }

  // Logger middleware
  bot.use(logger);

  // Commands
  bot.command("start", startCommand);

  bot.on("message", (ctx) => ctx.reply("I received your message!"));

  // Rate limit stats command (only if rate limiting is enabled)
  if (config.rateLimit.enabled) {
    bot.command("rateLimit", async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const { getRateLimitStats } = await import("./middleware/rateLimit");
      const stats = await getRateLimitStats(chatId);

      if (stats.enabled) {
        const chatTokens = stats.chat?.tokens || 0;
        const globalTokens = stats.global?.tokens || 0;

        await ctx.reply(
          `📊 *Rate Limit Statistics*\n\n` +
            `🏠 *Chat Limit:*\n` +
            `• Remaining tokens: ${chatTokens}/20\n` +
            `• Window: 1 minute\n\n` +
            `🌐 *Global Limit:*\n` +
            `• Remaining tokens: ${globalTokens}/30\n` +
            `• Window: 1 second`,
          { parse_mode: "Markdown" },
        );
      } else {
        await ctx.reply("❌ Rate limiting is currently disabled");
      }
    });
  }

  return bot;
}
