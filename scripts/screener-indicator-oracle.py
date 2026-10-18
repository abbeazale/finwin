"""Independent Decimal benchmark over raw Massive responses. No app imports,
no database and no network: it reads the archive the market-data ingest keeps.

Sessions come from SPY's daily bars, not from the app calendar. Early closes
are listed here separately. Usage: python3 scripts/screener-indicator-oracle.py
[archive dir]. Prints JSON cases for scripts/check-screener-replay.ts.
"""
import gzip
import json
import sys
from datetime import datetime, timedelta
from decimal import Decimal, getcontext
from pathlib import Path
from zoneinfo import ZoneInfo

getcontext().prec = 50
NY = ZoneInfo('America/New_York')
root = Path(sys.argv[1] if len(sys.argv) > 1 else '.local/market-data/raw')
SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'SPY', 'IWM']
EARLY_CLOSES = {'2024-07-03', '2024-11-29', '2024-12-24', '2025-07-03', '2025-11-28',
                '2025-12-24', '2026-11-27', '2026-12-24'}
INTRADAY_LOOKBACK = 60
DAILY_LOOKBACK = 300


def load(kind):
    # Later fetches replace earlier ones for the same bar.
    files = []
    for path in (root / kind).glob('*.json.gz'):
        with gzip.open(path, 'rt') as handle:
            files.append(json.load(handle, parse_float=Decimal))
    bars = {}
    for record in sorted(files, key=lambda item: item['fetchedAt']):
        symbol = record['url'].split('/ticker/')[1].split('/')[0]
        for row in record['body'].get('results', []):
            bars.setdefault(symbol, {})[row['t']] = (Decimal(row['c']), Decimal(row['v']))
    return bars


minute = load('minute')
daily_raw = load('day')
daily = {symbol: {datetime.fromtimestamp(t / 1000, NY).date().isoformat(): value
                  for t, value in rows.items()} for symbol, rows in daily_raw.items()}
sessions = sorted(daily['SPY'])


def session_bounds(day):
    start = datetime.fromisoformat(f'{day}T09:30').replace(tzinfo=NY)
    return start, 210 if day in EARLY_CLOSES else 390


def millis(moment):
    return int(moment.timestamp() * 1000)


def window(day):
    index = sessions.index(day)
    return sessions[max(0, index - INTRADAY_LOOKBACK):index + 1]


def series(symbol, day, clock, interval):
    if interval == '1d':
        index = sessions.index(day)
        return [daily[symbol].get(date, (None,))[0]
                for date in sessions[max(0, index - DAILY_LOOKBACK):index]]
    boundary = datetime.fromisoformat(f'{day}T{clock}').replace(tzinfo=NY)
    width = int(interval[0])
    values = []
    bars = minute[symbol]
    for session in window(day):
        start, length = session_bounds(session)
        for offset in range(0, length, width):
            size = min(width, length - offset)
            stamps = [start + timedelta(minutes=offset + i) for i in range(size)]
            if stamps[-1] + timedelta(minutes=1) > boundary:
                return values
            keys = [millis(stamp) for stamp in stamps]
            values.append(bars[keys[-1]][0] if all(key in bars for key in keys) else None)
    return values


def last_run(values):
    gaps = [i for i, v in enumerate(values) if v is None]
    return values[gaps[-1] + 1:] if gaps else values


def ema(values, n):
    if values and values[-1] is None:
        return None
    run = last_run(values)
    if len(run) < n:
        return None
    if n == 1:
        return float(run[-1])
    value = sum(run[:n]) / Decimal(n)
    alpha = Decimal(2) / Decimal(n + 1)
    for close in run[n:]:
        value = value + alpha * (close - value)
    return float(value)


def rsi(values, n):
    if values and values[-1] is None:
        return None
    run = last_run(values)
    changes = [b - a for a, b in zip(run, run[1:])]
    if len(changes) < n:
        return None
    gains = [max(v, 0) for v in changes]
    losses = [max(-v, 0) for v in changes]
    up = sum(gains[:n]) / Decimal(n)
    down = sum(losses[:n]) / Decimal(n)
    for gain, loss in zip(gains[n:], losses[n:]):
        up = up + (gain - up) / n
        down = down + (loss - down) / n
    if up + down == 0:
        return 50.0
    return float(100 * up / (up + down))


def volume(symbol, day, clock):
    days = window(day)
    if len(days) < 21:
        return None
    start, _ = session_bounds(day)
    elapsed = int((datetime.fromisoformat(f'{day}T{clock}').replace(tzinfo=NY) - start).total_seconds() // 60)
    totals = []
    for session in days[-21:]:
        open_, _ = session_bounds(session)
        keys = [millis(open_ + timedelta(minutes=i)) for i in range(elapsed)]
        if any(key not in minute[symbol] for key in keys):
            return None
        totals.append(sum(minute[symbol][key][1] for key in keys))
    baseline = sum(totals[:-1]) / 20
    return float(totals[-1] / baseline) if baseline else None


def previous_close_change(symbol, day, clock):
    index = sessions.index(day)
    previous = daily[symbol].get(sessions[index - 1])
    boundary = datetime.fromisoformat(f'{day}T{clock}').replace(tzinfo=NY)
    price = minute[symbol].get(millis(boundary - timedelta(minutes=1)))
    if not previous or not price:
        return None
    return float((price[0] - previous[0]) / previous[0] * 100)


# Recent session; winter time; first day of daylight time; an early close;
# the day after a holiday; the session used in earlier screenshots.
MOMENTS = [('2026-10-09', '10:30'), ('2026-01-15', '14:00'), ('2026-03-09', '11:00'),
           ('2025-11-28', '12:30'), ('2025-12-26', '10:00'), ('2026-09-15', '10:30')]
cases = []
emas = []
for day, clock in MOMENTS:
    if day not in sessions:
        continue
    for symbol in SYMBOLS:
        daily_closes = series(symbol, day, clock, '1d')
        for interval in ['1m', '5m', '1d']:
            closes = daily_closes if interval == '1d' else series(symbol, day, clock, interval)
            cases.append(dict(symbol=symbol, session=day, time=clock, timeframe=interval,
                              rsi=rsi(closes, 14), volume=volume(symbol, day, clock),
                              dailyEma200=ema(daily_closes, 200),
                              dailyChange=previous_close_change(symbol, day, clock)))
            for period in [1, 9, 20, 200]:
                emas.append(dict(symbol=symbol, session=day, time=clock, timeframe=interval,
                                 period=period, value=ema(closes, period)))
print(json.dumps(dict(sessions=[sessions[0], sessions[-1]], cases=cases, emas=emas)))
