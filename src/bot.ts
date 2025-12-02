import { Bot } from "grammy";
import { config } from "./config";
import type { MyContext } from "./types";
import { logger } from "./middleware/logger";
import { startCommand } from "./commands/start";
import { apiThrottler } from "@grammyjs/transformer-throttler";

export function createBot() {
    if (!config.botToken) {
        throw new Error("Bot token not found");
    }

    const bot = new Bot<MyContext>(config.botToken);

    // Middleware
    bot.use(logger);

    // API Throttler to prevent hitting Telegram's rate limits
    // Default configuration follows Telegram's API limits
    bot.api.config.use(apiThrottler());

    // Commands
    bot.command("start", startCommand);

    bot.on("message", (ctx) => ctx.reply("I received your message!"));

    return bot;
}
