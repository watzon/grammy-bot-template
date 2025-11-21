import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";
import { config } from "../config";
import * as schema from "./schema";

if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
}

const client = new SQL(config.databaseUrl);
export const db = drizzle({ client, schema });
