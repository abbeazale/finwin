"""Build the replay float cache from SEC EDGAR point-in-time filings.

Reads EntityCommonStockSharesOutstanding (10-Q/10-K cover figures) for the
replay common stocks and writes .local/databento-probe/float.json in the shape
loadReplayFloats() expects.

These are OUTSTANDING shares, not free float: quarterly filings do not
disclose float. Outstanding is an upper bound on float, so the replay float
filter stays conservative and every snapshot source says so. ETFs (SPY/IWM)
have no 10-Q/10-K cover figure and stay uncovered by design; the replay
excludes them with an explanation when the float filter is on.

Only snapshots filed on or before CUTOFF are kept, so no replay session can
see future knowledge. Uses only the Python standard library.
"""

import json
import sys
import urllib.request

CUTOFF = "2026-09-15"
ISSUERS = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
    "NVDA": "0001045810",
}
OUT_PATH = ".local/databento-probe/float.json"
USER_AGENT = "FinWin local replay prototype research (3 requests, contact: local)"


def fetch_companyfacts(cik: str) -> dict:
    request = urllib.request.Request(
        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> None:
    snapshots = []
    for symbol, cik in ISSUERS.items():
        facts = fetch_companyfacts(cik)
        points = facts["facts"]["dei"]["EntityCommonStockSharesOutstanding"][
            "units"
        ]["shares"]
        eligible = [
            point
            for point in points
            if point.get("form") in ("10-Q", "10-K")
            and point.get("filed", "") <= CUTOFF
            and isinstance(point.get("val"), int)
            and point["val"] > 0
        ]
        if not eligible:
            print(f"{symbol}: no eligible filings, skipping", file=sys.stderr)
            continue
        for point in sorted(eligible, key=lambda p: (p["end"], p["filed"])):
            source = (
                f"SEC EDGAR {symbol} {point['form']} {point['accn']} "
                f"filed {point['filed']}: cover outstanding shares "
                "(upper-bound proxy; quarterly filings do not disclose free float)"
            )
            assert 1 <= len(source) <= 200, f"source too long: {source}"
            snapshots.append(
                {
                    "symbol": symbol,
                    "shares": point["val"],
                    "effectiveAt": f"{point['end']}T00:00:00Z",
                    "publishedAt": f"{point['filed']}T00:00:00Z",
                    "source": source,
                }
            )
        latest = max(eligible, key=lambda p: (p["end"], p["filed"]))
        print(
            f"{symbol}: {len(eligible)} snapshots, latest {latest['val']:,} "
            f"as of {latest['end']} filed {latest['filed']}"
        )
    assert snapshots, "no snapshots collected"
    assert len(snapshots) <= 10_000, "exceeds replay float file limit"
    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump({"snapshots": snapshots}, handle, indent=2)
        handle.write("\n")
    print(f"wrote {len(snapshots)} snapshots to {OUT_PATH}")


if __name__ == "__main__":
    main()
