import { createBot } from "./bot";
import { validateConfig } from "./config";

async function main() {
    try {
        validateConfig();

        const bot = createBot();

        console.log("Starting bot...");

        // Enable graceful stop
        process.once("SIGINT", () => bot.stop());
        process.once("SIGTERM", () => bot.stop());

        await bot.start({
            onStart: (botInfo) => {
                console.log(`Bot @${botInfo.username} started!`);
            },
        });
    } catch (error) {
        console.error("Failed to start bot:", error);
        process.exit(1);
    }
}

if (import.meta.main) {
    main();
}
