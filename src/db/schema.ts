import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    telegramId: text("telegram_id").notNull().unique(),
    username: text("username"),
    firstName: text("first_name"),
    createdAt: timestamp("created_at").defaultNow(),
});
