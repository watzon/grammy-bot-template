import type { NextFunction } from "grammy";
import type { MyContext } from "../types";

export async function logger(ctx: MyContext, next: NextFunction) {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`Response time: ${ms}ms`);
}
