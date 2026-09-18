import { TRPCError } from "@trpc/server";
import { loadReplayBars } from "@/server/screener/cache";
import { evaluateReplay } from "@/server/screener/replay";
import { replayInputSchema } from "@/lib/screener-replay";
import { protectedProcedure, router } from "../trpc";

export const screenerRouter = router({
  replay: protectedProcedure
    .input(replayInputSchema)
    .query(async ({ input }) => {
      let bars;
      try {
        bars = await loadReplayBars(
          input.timeframe === "1d" || input.rsi?.timeframe === "1d",
        );
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "The verified historical sample is unavailable. Restore the local Databento cache and restart the server.",
        });
      }
      return evaluateReplay(bars, input);
    }),
});
