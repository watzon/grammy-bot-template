import type { NextFunction } from "grammy";
import type { MyContext } from "../types";

export async function logger(ctx: MyContext, next: NextFunction) {
    const start = Date.now();
    console.log(`Processing update from ${ctx.from?.username || ctx.from?.id || 'unknown'}`);
    await next();
    const ms = Date.now() - start;
    console.log(`Response time: ${ms}ms`);
}
