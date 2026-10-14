import { TRPCError } from "@trpc/server";
import { getServerEnvironment } from "@/server/env";
import { loadReplayFloats, loadReplayNews } from "@/server/screener/research";
import {
  loadCoverage,
  loadReplayBars,
  MarketDataUnavailable,
} from "@/server/screener/market-data";
import { buildChart } from "@/server/screener/chart";
import { evaluateReplay } from "@/server/screener/replay";
import { replayInputSchema } from "@/lib/screener-replay";
import { chartInputSchema } from "@/lib/screener-chart";
import { protectedProcedure, router } from "../trpc";

// Load bars for a session the market-data server holds. Errors become
// messages the page can show instead of a generic failure.
async function barsFor(session: string, includeDaily: boolean) {
  try {
    const coverage = await loadCoverage();
    const minutes = coverage.minutes;
    if (!minutes)
      throw new MarketDataUnavailable(
        "The market-data server has no stored minutes yet.",
      );
    if (session < minutes.from || session > minutes.through)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Choose a session from ${minutes.from} through ${minutes.through}.`,
      });
    return await loadReplayBars(session, includeDaily);
  } catch (error) {
    if (error instanceof MarketDataUnavailable)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error.message,
      });
    throw error;
  }
}

export const screenerRouter = router({
  capabilities: protectedProcedure.query(async () => {
    const coverage = await loadCoverage().catch(() => null);
    return {
      news: Boolean(getServerEnvironment().finnhubApiKey),
      float: (await loadReplayFloats()).length > 0,
      sessions: coverage?.minutes ?? null,
    };
  }),
  replay: protectedProcedure
    .input(replayInputSchema)
    .query(async ({ input }) => {
      const bars = await barsFor(
        input.session,
        input.ema?.timeframe === "1d" ||
          input.rsi?.timeframe === "1d" ||
          Boolean(input.dailyChange),
      );
      const [floats, news] = await Promise.all([
        input.float ? loadReplayFloats() : Promise.resolve([]),
        loadReplayNews(
          input,
          input.news ? getServerEnvironment().finnhubApiKey : undefined,
        ),
      ]);
      return evaluateReplay(bars, input, { floats, news });
    }),
  // Charts load daily bars as well, for daily candles and daily lines. News
  // and float data never affect them.
  chart: protectedProcedure.input(chartInputSchema).query(async ({ input }) =>
    buildChart(await barsFor(input.session, true), input),
  ),
});
