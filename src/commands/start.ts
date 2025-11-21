import type { MyContext } from "../types";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export async function startCommand(ctx: MyContext) {
    if (!ctx.from) return;

    const { id, username, first_name } = ctx.from;
    const telegramId = id.toString();

    try {
        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.telegramId, telegramId),
        });

        if (!existingUser) {
            await db.insert(users).values({
                telegramId,
                username: username || null,
                firstName: first_name,
            });
            await ctx.reply(`Welcome, ${first_name}! You have been registered.`);
        } else {
            await ctx.reply(`Welcome back, ${first_name}!`);
        }
    } catch (error) {
        console.error("Error in start command:", error);
        await ctx.reply("An error occurred while processing your request.");
    }
}
