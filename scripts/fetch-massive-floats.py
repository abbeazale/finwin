"""Save a Massive free-float snapshot and rebuild the replay float cache.

Each run reads the full free-float list from Massive's experimental
GET /stocks/vX/float and saves it to .local/float-snapshots/massive-<date>.json.
It then rebuilds .local/databento-probe/float.json for the replay symbols from
every saved snapshot.

Massive returns only the latest value for each ticker, with no history. The
saved snapshots are the history, so run this once a day. A value applies from
the start of its effective date in New York: the replay assumes it was known
then. Each record's source text keeps the first fetch date so that this
assumption stays visible. ETFs have no float rows.

Free float leaves out insiders, holders of 5% or more and locked-up shares.
It is not shares outstanding.

Usage: python3 scripts/fetch-massive-floats.py
Reads MASSIVE_API_KEY from the environment or from .env. Uses only the Python
standard library. The free plan allows 5 requests per minute.
"""

import json
import os
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

REPLAY_SYMBOLS = ["AAPL", "MSFT", "NVDA", "SPY", "IWM"]
FIRST_PAGE = "https://api.massive.com/stocks/vX/float?limit=5000&sort=ticker.asc"
SNAPSHOT_DIR = Path(".local/float-snapshots")
OUT_PATH = Path(".local/databento-probe/float.json")
NEW_YORK = ZoneInfo("America/New_York")
PAGE_DELAY_SECONDS = 13


def api_key() -> str:
    key = os.environ.get("MASSIVE_API_KEY", "").strip()
    if not key and Path(".env").exists():
        for line in Path(".env").read_text().splitlines():
            if line.startswith("MASSIVE_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
    if not key:
        raise SystemExit("MASSIVE_API_KEY is not set.")
    return key


def fetch_all(key: str) -> list[dict]:
    rows: list[dict] = []
    url: str | None = FIRST_PAGE
    while url:
        request = urllib.request.Request(
            url, headers={"Authorization": f"Bearer {key}", "Accept": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.load(response)
        if body.get("status") not in ("OK", "DELAYED"):
            raise SystemExit(f"Massive returned status {body.get('status')!r}.")
        rows.extend(body.get("results", []))
        url = body.get("next_url")
        if url:
            time.sleep(PAGE_DELAY_SECONDS)
    return rows


def save_snapshot(rows: list[dict], fetched_at: datetime) -> Path:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SNAPSHOT_DIR / f"massive-{fetched_at.astimezone(NEW_YORK).date().isoformat()}.json"
    path.write_text(
        json.dumps({"fetchedAt": fetched_at.isoformat(), "rows": rows}, separators=(",", ":"))
    )
    return path


def start_of_day_utc(day: str) -> str:
    local = datetime.fromisoformat(day).replace(tzinfo=NEW_YORK)
    return local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rebuild_replay_cache() -> list[dict]:
    # First observation of each (symbol, effective date, value) across snapshots.
    first_seen: dict[tuple[str, str, int], str] = {}
    for path in sorted(SNAPSHOT_DIR.glob("massive-*.json")):
        snapshot = json.loads(path.read_text())
        fetched = snapshot["fetchedAt"][:10]
        for row in snapshot["rows"]:
            symbol = row.get("ticker")
            shares = row.get("free_float")
            day = row.get("effective_date")
            if symbol not in REPLAY_SYMBOLS or not isinstance(shares, int) or shares <= 0 or not day:
                continue
            first_seen.setdefault((symbol, day, shares), fetched)
    records = []
    for (symbol, day, shares), fetched in sorted(first_seen.items()):
        available = start_of_day_utc(day)
        records.append(
            {
                "symbol": symbol,
                "shares": shares,
                "effectiveAt": available,
                "publishedAt": available,
                "source": f"Massive free float, effective {day}, first fetched {fetched}; assumed known from its effective date",
            }
        )
    OUT_PATH.write_text(json.dumps({"snapshots": records}, indent=2) + "\n")
    return records


def main() -> None:
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = fetch_all(api_key())
    path = save_snapshot(rows, fetched_at)
    records = rebuild_replay_cache()
    print(f"Saved {len(rows)} float rows to {path}.")
    print(f"Wrote {len(records)} replay records to {OUT_PATH}:")
    for record in records:
        print(f"  {record['symbol']} {record['shares']:,} from {record['effectiveAt'][:10]}")
    missing = sorted(set(REPLAY_SYMBOLS) - {record["symbol"] for record in records})
    if missing:
        print(f"No float rows for: {', '.join(missing)} (ETFs have none).")


if __name__ == "__main__":
    main()
