-- Prices are integer billionths of a USD. Volume is integer millionths of a
-- share, because Massive reports fractional share volume. Dates are New York
-- trading dates as YYYY-MM-DD text.

create table if not exists minute_bars (
  symbol text not null,
  start_ms bigint not null,
  open bigint not null,
  high bigint not null,
  low bigint not null,
  close bigint not null,
  volume bigint not null,
  primary key (symbol, start_ms)
);

create table if not exists daily_bars (
  symbol text not null,
  session text not null check (session ~ '^\d{4}-\d{2}-\d{2}$'),
  open bigint not null,
  high bigint not null,
  low bigint not null,
  close bigint not null,
  volume bigint not null,
  primary key (symbol, session)
);

-- Change log of Massive free float. A row is added only when a
-- (ticker, effective date, float) combination is first seen.
create table if not exists float_history (
  ticker text not null,
  effective_date text not null check (effective_date ~ '^\d{4}-\d{2}-\d{2}$'),
  free_float bigint not null check (free_float > 0),
  free_float_percent double precision,
  first_seen text not null check (first_seen ~ '^\d{4}-\d{2}-\d{2}$'),
  primary key (ticker, effective_date, free_float)
);

create table if not exists ingest_runs (
  id bigserial primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  detail text
);
