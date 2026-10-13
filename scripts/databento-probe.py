#!/usr/bin/env python3
"""Bounded historical-data evaluation. Uses only Python's standard library.

Run with DATABENTO_API_KEY in the environment. Estimates only by default.
--download permits downloads below --max-cost-usd in aggregate, with cached
files reused on subsequent runs. --offline validates cached data without a key.
This is an evaluation tool, not FinWin's production indicator implementation.
"""

import argparse
import base64
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo


API = "https://hist.databento.com/v0/"
NY = ZoneInfo("America/New_York")
SYMBOLS = "AAPL,MSFT,NVDA,SPY,IWM"
JOBS = {
    "mini-minute": dict(dataset="EQUS.MINI", schema="ohlcv-1m", symbols=SYMBOLS,
                        start="2026-08-03", end="2026-09-16"),
    "summary-daily": dict(dataset="EQUS.SUMMARY", schema="ohlcv-1d", symbols=SYMBOLS,
                          start="2025-08-01", end="2026-09-16"),
}


@dataclass(frozen=True)
class Candle:
    symbol: str
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, default=str) + "\n")


def request(method, params, key, *, download=False):
    encoded = urllib.parse.urlencode(params)
    authorization = "Basic " + base64.b64encode((key + ":").encode()).decode()
    url = API + method + ("" if download else "?" + encoded)
    req = urllib.request.Request(url, data=encoded.encode() if download else None,
                                 headers={"Authorization": authorization})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            # This fixed sample should be small. Stop accepting an unexpected payload.
            body = response.read(64 * 1024 * 1024 + 1)
            if len(body) > 64 * 1024 * 1024:
                raise ValueError("Response exceeds 64 MiB sample limit")
            return body
    except urllib.error.HTTPError as error:
        # Do not log provider bodies or request objects: they can include credentials.
        raise RuntimeError(f"{method}: HTTP {error.code}") from None
    except urllib.error.URLError:
        raise RuntimeError(f"{method}: network request failed") from None


def parse_candles(path, job):
    candles = []
    seen = set()
    start = datetime.fromisoformat(job["start"]).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(job["end"]).replace(tzinfo=timezone.utc)
    for number, line in enumerate(path.read_text().splitlines(), 1):
        try:
            row = json.loads(line)
            stamp = datetime.fromisoformat(row["hd"]["ts_event"].replace("Z", "+00:00"))
            values = [Decimal(row[field]) for field in ("open", "high", "low", "close")]
            volume = Decimal(row["volume"])
            candle = Candle(row["symbol"], stamp, *values, int(volume))
            identity = (candle.symbol, stamp)
            valid = (
                candle.symbol in job["symbols"].split(",")
                and stamp.tzinfo is not None and start <= stamp < end
                and all(value.is_finite() and value > 0 for value in values)
                and volume.is_finite() and volume >= 0 and volume == int(volume)
                and candle.low <= min(candle.open, candle.close)
                and candle.high >= max(candle.open, candle.close)
                and candle.low <= candle.high and identity not in seen
                and stamp.second == 0 and stamp.microsecond == 0
            )
            if not valid:
                raise ValueError("Invalid candle")
            seen.add(identity)
            candles.append(candle)
        except (KeyError, TypeError, ValueError, ArithmeticError):
            raise ValueError(f"{path.name}: invalid candle at line {number}") from None
    if not candles or set(c.symbol for c in candles) != set(job["symbols"].split(",")):
        raise ValueError(f"{path.name}: missing requested symbols or empty response")
    return sorted(candles, key=lambda candle: (candle.symbol, candle.timestamp))


def regular(candle):
    # Fixed sample only: production needs an exchange holiday/early-close calendar.
    local = candle.timestamp.astimezone(NY)
    return local.weekday() < 5 and 570 <= local.hour * 60 + local.minute < 960


def sma(candles, period):
    if len(candles) < period:
        return None
    return sum((c.close for c in candles[-period:]), Decimal(0)) / period


def rsi(candles, period=14):
    """Candidate Wilder RSI, initialized with the first period of changes."""
    if len(candles) <= period:
        return None
    changes = [b.close - a.close for a, b in zip(candles, candles[1:])]
    gains = [max(change, Decimal(0)) for change in changes]
    losses = [max(-change, Decimal(0)) for change in changes]
    gain, loss = sum(gains[:period]) / period, sum(losses[:period]) / period
    for next_gain, next_loss in zip(gains[period:], losses[period:]):
        gain = (gain * (period - 1) + next_gain) / period
        loss = (loss * (period - 1) + next_loss) / period
    if loss == 0:
        return Decimal(100) if gain else Decimal(50)
    return 100 - 100 / (1 + gain / loss)


def aggregate_five_minutes(candles):
    groups = defaultdict(list)
    for candle in candles:
        stamp = candle.timestamp.replace(minute=candle.timestamp.minute // 5 * 5)
        groups[stamp].append(candle)
    complete = []
    for stamp, group in sorted(groups.items()):
        expected = [stamp + timedelta(minutes=i) for i in range(5)]
        # Sparse buckets remain excluded; this probe does not invent no-trade bars.
        if [c.timestamp for c in group] == expected:
            complete.append(Candle(group[0].symbol, stamp, group[0].open,
                                   max(c.high for c in group), min(c.low for c in group),
                                   group[-1].close, sum(c.volume for c in group)))
    return complete, len(groups) - len(complete)


def analyze(minute, daily):
    result = {}
    for symbol in SYMBOLS.split(","):
        intraday = [c for c in minute if c.symbol == symbol and regular(c)]
        sessions = defaultdict(list)
        for candle in intraday:
            sessions[candle.timestamp.astimezone(NY).date()].append(candle)
        full_days = sorted(day for day, bars in sessions.items() if len(bars) == 390)
        five, sparse_buckets = aggregate_five_minutes(intraday)
        daily_bars = [c for c in daily if c.symbol == symbol]
        # Validate a fixed replay moment: 10:30 New York on the final sample session.
        replay_day = max(sessions)
        prior_days = sorted(day for day in sessions if day < replay_day)[-20:]
        def volume_until_1030(day):
            bars = [c for c in sessions[day]
                    if c.timestamp.astimezone(NY).hour * 60
                    + c.timestamp.astimezone(NY).minute < 630]
            return sum(c.volume for c in bars) if len(bars) == 60 else None
        baseline = [volume_until_1030(day) for day in prior_days]
        current_volume = volume_until_1030(replay_day)
        rvol = None
        if len(baseline) == 20 and all(v is not None for v in baseline) and current_volume is not None:
            average = sum(baseline) / Decimal(20)
            if average > 0:
                rvol = Decimal(current_volume) / average
        result[symbol] = {
            "regular_minute_bars": len(intraday), "sessions": len(sessions),
            "complete_390_minute_sessions": len(full_days),
            "session_bar_counts": {str(day): len(bars) for day, bars in sorted(sessions.items())},
            "complete_five_minute_bars": len(five), "excluded_sparse_five_minute_buckets": sparse_buckets,
            "daily_bars": len(daily_bars), "first_daily_timestamp": daily_bars[0].timestamp,
            "last_daily_timestamp": daily_bars[-1].timestamp,
            "last_regular_minute_timestamp": intraday[-1].timestamp,
            "sma_200": {"1m": sma(intraday, 200), "5m": sma(five, 200), "daily": sma(daily_bars, 200)},
            "candidate_wilder_rsi_14": {"1m": rsi(intraday), "5m": rsi(five), "daily": rsi(daily_bars)},
            "rvol_replay_date": str(replay_day), "rvol_replay_time_ny": "10:30",
            "rvol_prior_sessions": len(prior_days), "rvol_valid_prior_sessions": sum(v is not None for v in baseline),
            "same_time_relative_volume_20": rvol,
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--max-cost-usd", type=Decimal, default=Decimal("0"))
    parser.add_argument("--output", type=Path, default=Path(".local/databento-probe"))
    args = parser.parse_args()
    if not args.max_cost_usd.is_finite() or not 0 <= args.max_cost_usd <= 1:
        parser.error("Probe download budget must be between $0 and $1")
    if args.offline and args.download:
        parser.error("Choose offline analysis or download")
    key = os.environ.get("DATABENTO_API_KEY")
    if not args.offline and not key:
        parser.error("Set DATABENTO_API_KEY in the environment")
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "manifest.json"
    manifest = read_json(manifest_path) if manifest_path.exists() else {"downloads": {}}
    estimates = {}
    for name, job in JOBS.items():
        if not args.offline:
            cost = Decimal(request("metadata.get_cost", job, key).decode())
            if not cost.is_finite() or cost < 0:
                raise ValueError("Invalid provider cost estimate")
            estimates[name] = cost
    if estimates:
        write_json(args.output / "estimates.json", {"requested_at": datetime.now(timezone.utc),
                   "requests": JOBS, "estimated_usd": estimates})
        print(json.dumps({"estimated_usd": estimates}, default=str), flush=True)
    pending = [name for name, job in JOBS.items()
               if not (args.output / (name + ".jsonl")).exists()]
    if args.download:
        total = sum((estimates[name] for name in pending), Decimal(0))
        if total > args.max_cost_usd:
            raise ValueError(f"Estimated total ${total} exceeds ${args.max_cost_usd} budget")
        for name in pending:
            job = JOBS[name]
            payload = request("timeseries.get_range", dict(job, stype_in="raw_symbol",
                              encoding="json", pretty_px="true", pretty_ts="true",
                              map_symbols="true", compression="none"), key, download=True)
            path = args.output / (name + ".jsonl")
            temporary = path.with_suffix(".partial")
            temporary.write_bytes(payload)
            candles = parse_candles(temporary, job)
            temporary.rename(path)
            manifest["downloads"][name] = {"request": job, "estimated_usd": estimates[name],
                "downloaded_at": datetime.now(timezone.utc), "bytes": len(payload),
                "records": len(candles), "sha256": hashlib.sha256(payload).hexdigest()}
            write_json(manifest_path, manifest)
            print(json.dumps({"downloaded": name, "records": len(candles), "bytes": len(payload)}), flush=True)
    if args.download or args.offline:
        data = {}
        for name, job in JOBS.items():
            path = args.output / (name + ".jsonl")
            entry = manifest["downloads"].get(name)
            if not entry or entry["request"] != job or hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
                raise ValueError(f"{name}: cache manifest mismatch")
            data[name] = parse_candles(path, job)
        analysis = analyze(data["mini-minute"], data["summary-daily"])
        write_json(args.output / "analysis.json", analysis)
        print(json.dumps({"analysis_file": str(args.output / "analysis.json"),
                          "symbols": len(analysis),
                          "minute_records": len(data["mini-minute"]),
                          "daily_records": len(data["summary-daily"])}))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, ArithmeticError, OSError) as error:
        print(f"Probe failed: {error}", file=sys.stderr)
        sys.exit(1)
