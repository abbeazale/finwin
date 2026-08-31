import { TOP_US_TICKER_SYMBOLS } from "../src/lib/market-symbols";

const BANNED_COPY = [
  "NET WORTH",
  "RUNWAY",
  "BURN RATE",
  "Free to use",
  "local-first",
  "MIT",
  "forecast",
  "scenario",
] as const;

const REQUIRED_PRICED_SYMBOLS = 10;
const REQUEST_COUNT = 3;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countPricedSymbols(html: string) {
  return TOP_US_TICKER_SYMBOLS.filter((symbol) => {
    const symbolThenPrice = new RegExp(
      `>${escapeRegExp(symbol)}<[^]{0,300}>\\$(?:<!-- -->)?[0-9][0-9,.]*<`,
    );
    return symbolThenPrice.test(html);
  }).length;
}

async function checkLandingPage(target: string) {
  const baseUrl = new URL(target);

  for (let requestNumber = 1; requestNumber <= REQUEST_COUNT; requestNumber += 1) {
    const requestUrl = new URL(baseUrl);
    requestUrl.searchParams.set("finwin_landing_check", `${Date.now()}-${requestNumber}`);

    const response = await fetch(requestUrl, {
      headers: { "cache-control": "no-cache" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Request ${requestNumber} returned HTTP ${response.status}.`);
    }

    const html = await response.text();
    const bannedMatches = BANNED_COPY.filter((text) =>
      html.toLowerCase().includes(text.toLowerCase()),
    );
    if (bannedMatches.length > 0) {
      throw new Error(`Request ${requestNumber} contained banned copy: ${bannedMatches.join(", ")}.`);
    }

    const pricedSymbolCount = countPricedSymbols(html);
    if (pricedSymbolCount < REQUIRED_PRICED_SYMBOLS) {
      throw new Error(
        `Request ${requestNumber} rendered ${pricedSymbolCount} priced ticker symbols; expected at least ${REQUIRED_PRICED_SYMBOLS}.`,
      );
    }

    console.log(`Request ${requestNumber}: ${pricedSymbolCount} priced symbols, copy clean.`);
  }
}

const target = process.argv[2] ?? "http://127.0.0.1:3000";

checkLandingPage(target).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
