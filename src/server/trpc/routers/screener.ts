import { TRPCError } from "@trpc/server";
import { getServerEnvironment } from "@/server/env";
import { loadReplayFloats, loadReplayNews } from "@/server/screener/research";
import { loadReplayBars } from "@/server/screener/cache";
import { buildChart } from "@/server/screener/chart";
import { evaluateReplay } from "@/server/screener/replay";
import { replayInputSchema } from "@/lib/screener-replay";
import { chartInputSchema } from "@/lib/screener-chart";
import { protectedProcedure, router } from "../trpc";

export const screenerRouter = router({
  capabilities: protectedProcedure.query(async () => ({
    news: Boolean(getServerEnvironment().finnhubApiKey),
    float: (await loadReplayFloats()).length > 0,
  })),
  replay: protectedProcedure
    .input(replayInputSchema)
    .query(async ({ input }) => {
      let bars;
      try {
        bars = await loadReplayBars(
          input.ema?.timeframe === "1d" ||
            input.rsi?.timeframe === "1d" ||
            Boolean(input.dailyChange),
        );
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "The verified historical sample is unavailable. Restore the local Databento cache and restart the server.",
        });
      }
      const [floats, news] = await Promise.all([
        input.float ? loadReplayFloats() : Promise.resolve([]),
        loadReplayNews(
          input,
          input.news ? getServerEnvironment().finnhubApiKey : undefined,
        ),
      ]);
      return evaluateReplay(bars, input, { floats, news });
    }),
  // Charts read only the verified minute sample. Daily candles and daily
  // overlays are regular-session aggregates, so a missing SUMMARY file, news
  // or float data never affects them.
  chart: protectedProcedure.input(chartInputSchema).query(async ({ input }) => {
    let bars;
    try {
      bars = await loadReplayBars(false);
    } catch {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "The verified historical sample is unavailable. Restore the local Databento cache and restart the server.",
      });
    }
    return buildChart(bars, input);
  }),
});
