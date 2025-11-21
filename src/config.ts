import dotenv from "dotenv";
dotenv.config();

export const config = {
    botToken: process.env.BOT_TOKEN,
    databaseUrl: process.env.DATABASE_URL,
};

export function validateConfig() {
    if (!config.botToken) {
        throw new Error("BOT_TOKEN is not defined in .env");
    }
    if (!config.databaseUrl) {
        throw new Error("DATABASE_URL is not defined in .env");
    }
}
