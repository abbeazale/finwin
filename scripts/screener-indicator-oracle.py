"""Independent Decimal benchmark over raw downloads. No app imports or network."""
import json
from datetime import datetime, timedelta
from decimal import Decimal, getcontext
from pathlib import Path
from zoneinfo import ZoneInfo

getcontext().prec = 40
NY = ZoneInfo('America/New_York')
root = Path('.local/databento-probe')
minute = {}
daily = {}
for filename, target in [('mini-minute.jsonl', minute), ('summary-daily.jsonl', daily)]:
    for line in (root / filename).read_text().splitlines():
        row = json.loads(line)
        stamp = datetime.fromisoformat(row['hd']['ts_event'].replace('Z', '+00:00'))
        key = stamp.astimezone(NY) if target is minute else stamp.date().isoformat()
        target.setdefault(row['symbol'], {})[key] = (Decimal(row['close']), int(row['volume']))
sessions = []
date = datetime(2026, 8, 3, tzinfo=NY)
while date.date().isoformat() <= '2026-09-15':
    if date.weekday() < 5 and date.date().isoformat() != '2026-09-07':
        sessions.append(date.date().isoformat())
    date += timedelta(days=1)

def series(symbol, day, clock, interval):
    if interval == '1d':
        return [daily[symbol][date][0] for date in sorted(daily[symbol]) if date < day]
    boundary = datetime.fromisoformat(f'{day}T{clock}').replace(tzinfo=NY)
    width = int(interval[0])
    values = []
    for session in sessions:
        if session > day:
            break
        start = datetime.fromisoformat(f'{session}T09:30').replace(tzinfo=NY)
        for offset in range(0, 390, width):
            bucket = [start + timedelta(minutes=offset + i) for i in range(width)]
            if bucket[-1] + timedelta(minutes=1) > boundary:
                break
            values.append(minute[symbol][bucket[-1]][0] if all(t in minute[symbol] for t in bucket) else None)
    return values

def rsi(values, n):
    # Select the last contiguous run first, independently of the TS state loop.
    gaps = [i for i, v in enumerate(values) if v is None]
    run = values[gaps[-1] + 1:] if gaps else values
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
    return float(Decimal(50) if up + down == 0 else 100 - 100 / (1 + up / down) if down else 100)

def volume(symbol, day, clock):
    index = sessions.index(day)
    if index < 20:
        return None
    elapsed = int(clock[:2]) * 60 + int(clock[3:]) - 570
    totals = []
    for session in sessions[index - 20:index + 1]:
        start = datetime.fromisoformat(f'{session}T09:30').replace(tzinfo=NY)
        keys = [start + timedelta(minutes=i) for i in range(elapsed)]
        if any(t not in minute[symbol] for t in keys):
            return None
        totals.append(sum(minute[symbol][t][1] for t in keys))
    baseline = Decimal(sum(totals[:-1])) / 20
    return float(Decimal(totals[-1]) / baseline) if baseline else None

out = []
for day, clock in [('2026-09-15', '10:30'), ('2026-09-15', '14:00'), ('2026-08-18', '13:45')]:
    for symbol in ['AAPL', 'MSFT', 'NVDA', 'SPY', 'IWM']:
        for interval in ['1m', '5m', '1d']:
            closes = series(symbol, day, clock, interval)
            out.append(dict(symbol=symbol, session=day, time=clock, timeframe=interval,
                            rsi=rsi(closes, 14), volume=volume(symbol, day, clock),
                            dailySma200=float(sum(series(symbol, day, clock, '1d')[-200:]) / 200)))
print(json.dumps(out))
