import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Beaker,
  CircleAlert,
  FlaskConical,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
import { useSession } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/currency";
import { trpc, type RouterOutputs } from "@/lib/trpc";

type Holding = RouterOutputs["sandbox"]["getPortfolio"]["holdings"][number];
type Trade = RouterOutputs["sandbox"]["listTrades"][number];

export default function SandboxPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: session, isPending: sessionLoading } = useSession();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) void router.push("/login");
  }, [router, session, sessionLoading]);

  const portfoliosQuery = trpc.sandbox.listPortfolios.useQuery(undefined, { enabled: Boolean(session) });
  const portfolios = portfoliosQuery.data ?? [];
  const effectivePortfolioId = portfolios.some((portfolio) => portfolio.id === selectedPortfolioId)
    ? selectedPortfolioId
    : (portfolios[0]?.id ?? "");
  const portfolioQuery = trpc.sandbox.getPortfolio.useQuery(
    { id: effectivePortfolioId },
    { enabled: Boolean(session && effectivePortfolioId) },
  );
  const tradesQuery = trpc.sandbox.listTrades.useQuery(
    { portfolioId: effectivePortfolioId },
    { enabled: Boolean(session && effectivePortfolioId) },
  );
  const deletePortfolio = trpc.sandbox.deletePortfolio.useMutation({
    onSuccess: async () => {
      setSelectedPortfolioId("");
      await utils.sandbox.invalidate();
    },
    onError: (error) => setPageError(error.message),
  });
  const renamePortfolio = trpc.sandbox.renamePortfolio.useMutation({
    onSuccess: async () => utils.sandbox.invalidate(),
    onError: (error) => setPageError(error.message),
  });
  const deleteTrade = trpc.sandbox.deleteTrade.useMutation({
    onSuccess: async () => utils.sandbox.invalidate(),
    onError: (error) => setPageError(error.message),
  });

  if (sessionLoading || (portfoliosQuery.isLoading && !portfoliosQuery.data)) {
    return <PageStatus label="Preparing the paper desk..." />;
  }
  if (!session) return <PageStatus label="Redirecting..." />;

  const portfolio = portfolioQuery.data;
  const trades = tradesQuery.data ?? [];
  const error = portfoliosQuery.error?.message
    ?? portfolioQuery.error?.message
    ?? tradesQuery.error?.message
    ?? pageError;

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -right-40 -top-48 size-[38rem] rounded-full bg-[rgba(122,154,126,0.07)] blur-3xl" />
        <div className="absolute -bottom-64 -left-48 size-[42rem] rounded-full bg-[rgba(201,164,107,0.07)] blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
        <header className="mb-8 flex flex-col gap-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/dashboard" className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-brass-hi">
              <ArrowLeft className="size-3" /> Back to desk
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(201,164,107,0.28)] bg-[rgba(201,164,107,0.06)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-brass-hi">
              <FlaskConical className="size-3" /> Paper trading · not real money
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="label-eyebrow-brass">§ Sandbox</span>
              <h1 className="display mt-3 text-[clamp(2.2rem,5vw,4rem)] leading-none text-bone">
                Test the thesis.<br /><span className="italic text-sage-hi">Keep the lesson.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[13px] leading-[1.7] text-bone-mute">
                Replay hypothetical buys and sells against live prices. Backdate any trade and the entire ledger recomputes from first principles.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {portfolios.length > 0 ? (
                <label className="grid min-w-60 gap-1">
                  <span className="label-eyebrow text-bone-faint">Portfolio</span>
                  <select className="filter-select min-h-10" value={effectivePortfolioId} onChange={(event) => setSelectedPortfolioId(event.target.value)}>
                    {portfolios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus data-icon="inline-start" /> Portfolio
              </Button>
              {portfolio ? (
                <Button type="button" onClick={() => setTradeOpen(true)}>
                  <Beaker data-icon="inline-start" /> New trade
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {error ? <ErrorNotice message={error} /> : null}

        {!portfolio && !portfolioQuery.isLoading ? (
          <EmptyPortfolio onCreate={() => setCreateOpen(true)} />
        ) : portfolio ? (
          <main className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Market value" value={formatUsd(portfolio.marketValue)} detail={`${portfolio.holdings.length} open position${portfolio.holdings.length === 1 ? "" : "s"}`} />
              <SummaryTile label="Cash" value={formatUsd(portfolio.cashBalance)} detail={`Started with ${formatUsd(portfolio.startingCash)}`} />
              <SummaryTile label="Total value" value={formatUsd(portfolio.totalValue)} detail={`Realized ${formatSignedUsd(portfolio.realizedGain)}`} />
              <SummaryTile label="Total return" value={formatSignedUsd(portfolio.totalReturn)} detail={portfolio.totalReturnPercent === null ? "—" : `${signed(Number(portfolio.totalReturnPercent))}%`} tone={Number(portfolio.totalReturn) < 0 ? "oxide" : "sage"} />
            </section>

            {portfolio.missingQuoteCount > 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-[rgba(201,164,107,0.28)] bg-[rgba(201,164,107,0.05)] px-4 py-3 text-[12px] text-brass-hi">
                <CircleAlert className="size-4 shrink-0" />
                {portfolio.missingQuoteCount} position{portfolio.missingQuoteCount === 1 ? " has" : "s have"} no current quote. Cost basis remains visible; missing prices are excluded from market value.
              </div>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <HoldingsPanel holdings={portfolio.holdings} loading={portfolioQuery.isLoading} />
              <PortfolioPanel
                key={portfolio.id}
                portfolio={portfolio}
                busy={renamePortfolio.isPending || deletePortfolio.isPending}
                onRename={(name) => renamePortfolio.mutate({ id: portfolio.id, name })}
                onDelete={() => {
                  if (window.confirm(`Delete “${portfolio.name}” and every trade in it?`)) deletePortfolio.mutate({ id: portfolio.id });
                }}
              />
            </section>
            <TradesPanel trades={trades} loading={tradesQuery.isLoading} deletingId={deleteTrade.variables?.id} onDelete={(id) => deleteTrade.mutate({ id })} />
          </main>
        ) : <PanelStatus label="Replaying portfolio..." />}
      </div>

      <CreatePortfolioModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => { setSelectedPortfolioId(id); setCreateOpen(false); void utils.sandbox.invalidate(); }}
      />
      {portfolio ? (
        <TradeModal
          open={tradeOpen}
          onClose={() => setTradeOpen(false)}
          portfolioId={portfolio.id}
          onPlaced={() => { setTradeOpen(false); void utils.sandbox.invalidate(); }}
        />
      ) : null}
    </div>
  );
}

function Modal({ open, onClose, labelledBy, size = "md", children }: { open: boolean; onClose: () => void; labelledBy: string; size?: "md" | "lg"; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center sm:p-6"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className={`relative z-10 flex max-h-[calc(100dvh-4rem)] w-full ${size === "lg" ? "max-w-lg" : "max-w-md"} flex-col overflow-hidden rounded-lg border border-[var(--stroke-2)] bg-[var(--ink-1)] cove animate-fade-slide`}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ id, icon, eyebrow, title, subtitle, onClose }: { id: string; icon: ReactNode; eyebrow: string; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--stroke)] px-6 py-5">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">{icon}</span>
        <div>
          <span className="label-eyebrow-brass">{eyebrow}</span>
          <h2 id={id} className="display mt-1 text-2xl leading-tight text-bone">{title}</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-bone-mute">{subtitle}</p>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close dialog" className="-mr-1.5 -mt-1.5 shrink-0 rounded-md p-1.5 text-bone-mute transition-colors hover:bg-[var(--ink-3)] hover:text-bone">
        <X className="size-4" />
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-bone-mute">{children}</span>;
}

function CreatePortfolioModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [startingCash, setStartingCash] = useState("100000.00");
  const [error, setError] = useState<string | null>(null);
  const mutation = trpc.sandbox.createPortfolio.useMutation({
    onSuccess: ({ id }) => { setName(""); setStartingCash("100000.00"); setError(null); onCreated(id); },
    onError: (requestError) => setError(requestError.message),
  });
  function handleClose() { setError(null); onClose(); }
  function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    mutation.mutate({ name, startingCash: Number(startingCash) });
  }
  return (
    <Modal open={open} onClose={handleClose} labelledBy="create-portfolio-title" size="md">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <ModalHeader id="create-portfolio-title" icon={<FlaskConical className="size-5" />} eyebrow="New experiment" title="Create a paper portfolio" subtitle="Give this thesis its own clean cash ledger." onClose={handleClose} />
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-6">
          <label className="grid gap-2">
            <FieldLabel>Portfolio name</FieldLabel>
            <input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="form-input" placeholder="Long-term compounders" />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Starting cash</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-bone-faint">$</span>
              <input required min="0" max="999999999999.99" step="0.01" type="number" value={startingCash} onChange={(event) => setStartingCash(event.target.value)} className="form-input form-input--lead-symbol font-mono" />
            </div>
            <span className="text-[11px] text-bone-faint">Fictional cash the ledger starts from.</span>
          </label>
          {error ? <ErrorNotice message={error} /> : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--stroke)] px-6 py-4">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create portfolio"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TradeModal({ open, onClose, portfolioId, onPlaced }: { open: boolean; onClose: () => void; portfolioId: string; onPlaced: () => void }) {
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [executedAt, setExecutedAt] = useState(() => localDateTimeValue(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchQuery = trpc.sandbox.searchSymbols.useQuery({ query }, { enabled: query.trim().length >= 2 && !symbol });
  const quoteQuery = trpc.sandbox.getQuote.useQuery({ symbol }, { enabled: Boolean(symbol), retry: false });
  const effectivePrice = price || quoteQuery.data?.price || "";
  const mutation = trpc.sandbox.placeTrade.useMutation({
    onSuccess: () => { reset(); onPlaced(); },
    onError: (requestError) => setError(requestError.message),
  });
  const total = (Number(quantity) || 0) * (Number(effectivePrice) || 0);
  function reset() { setQuery(""); setSymbol(""); setSide("buy"); setQuantity("1"); setPrice(""); setExecutedAt(localDateTimeValue(new Date())); setNote(""); setError(null); }
  function handleClose() { reset(); onClose(); }
  function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    mutation.mutate({ portfolioId, symbol, side, quantity: Number(quantity), price: Number(effectivePrice), executedAt: new Date(executedAt), note: note || undefined });
  }
  return (
    <Modal open={open} onClose={handleClose} labelledBy="trade-title" size="lg">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <ModalHeader id="trade-title" icon={<Beaker className="size-5" />} eyebrow={side === "buy" ? "Paper buy" : "Paper sell"} title="Record a hypothetical trade" subtitle="Live quote first. Every field stays editable for what-if replay." onClose={handleClose} />
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-6">
          {!symbol ? (
            <div className="grid gap-2">
              <FieldLabel>Find a US stock</FieldLabel>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-bone-faint" />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="form-input form-input--lead-icon" placeholder="Apple or AAPL" />
              </div>
              {searchQuery.isFetching ? <span className="text-[11px] text-bone-faint">Searching Finnhub…</span> : null}
              {searchQuery.data?.length ? (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-[var(--stroke)] bg-[var(--ink-0)]">
                  {searchQuery.data.map((result) => (
                    <button type="button" key={result.symbol} onClick={() => { setSymbol(result.symbol); setQuery(result.description); }} className="flex w-full items-center justify-between gap-4 border-b border-[var(--stroke)] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[var(--ink-2-solid)]">
                      <span className="text-[12px] text-bone">{result.description}</span>
                      <span className="font-mono text-[11px] text-brass-hi">{result.symbol}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-3.5">
                <div>
                  <span className="font-mono text-lg text-bone">{symbol}</span>
                  <p className="mt-1 text-[11px] text-bone-faint">{quoteQuery.isLoading ? "Loading live quote…" : `Live ${formatUsd(quoteQuery.data?.price ?? null)} · ${signed(Number(quoteQuery.data?.changePercent ?? 0))}% today`}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setSymbol(""); setPrice(""); }}>Change</Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-md border border-[var(--stroke)] bg-[var(--ink-0)] p-1.5">
                <button type="button" onClick={() => setSide("buy")} className={`rounded px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${side === "buy" ? "bg-[rgba(122,154,126,0.16)] text-sage-hi shadow-[inset_0_0_0_1px_rgba(122,154,126,0.3)]" : "text-bone-faint hover:text-bone-mute"}`}>Buy</button>
                <button type="button" onClick={() => setSide("sell")} className={`rounded px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${side === "sell" ? "bg-[rgba(194,106,72,0.16)] text-oxide-hi shadow-[inset_0_0_0_1px_rgba(194,106,72,0.32)]" : "text-bone-faint hover:text-bone-mute"}`}>Sell</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <FieldLabel>Shares</FieldLabel>
                  <input required min="0.00000001" step="0.00000001" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="form-input font-mono" />
                </label>
                <label className="grid gap-2">
                  <FieldLabel>Price per share</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-bone-faint">$</span>
                    <input required min="0" step="0.0001" type="number" value={effectivePrice} onChange={(event) => setPrice(event.target.value)} className="form-input form-input--lead-symbol font-mono" />
                  </div>
                </label>
              </div>
              <label className="grid gap-2">
                <FieldLabel>Execution date and time</FieldLabel>
                <input required type="datetime-local" value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} className="form-input font-mono" />
              </label>
              <label className="grid gap-2">
                <FieldLabel>Note <span className="normal-case tracking-normal text-bone-faint">(optional)</span></FieldLabel>
                <textarea maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="form-input resize-none" placeholder="What thesis are you testing?" />
              </label>
              <div className="rounded-md border border-[var(--stroke)] bg-[var(--ink-0)] p-4 text-[12px]">
                <p className="text-[10px] uppercase tracking-[0.1em] text-bone-faint">Trade value</p>
                <p className="mt-1.5 font-mono text-bone">{formatUsd(total)}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-bone-faint">
                  Cash and share limits are validated by replaying the full timeline at this execution time.
                </p>
              </div>
            </>
          )}
          {(error || quoteQuery.error) ? <ErrorNotice message={error ?? quoteQuery.error?.message ?? "Quote unavailable."} /> : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--stroke)] px-6 py-4">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          {symbol ? <Button type="submit" disabled={mutation.isPending || quoteQuery.isLoading}>{mutation.isPending ? "Replaying timeline…" : `Confirm ${side}`}</Button> : null}
        </div>
      </form>
    </Modal>
  );
}

function HoldingsPanel({ holdings, loading }: { holdings: Holding[]; loading: boolean }) {
  return <section className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove"><PanelHeading icon={<TrendingUp className="size-4" />} label="Open positions" count={holdings.length} />{loading ? <PanelStatus label="Valuing positions..." /> : holdings.length === 0 ? <PanelStatus label="No open positions yet. Place a buy to begin." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[12px]"><thead className="border-b border-[var(--stroke)] text-bone-faint"><tr><th className="px-5 py-3 font-normal">Symbol</th><th className="px-3 py-3 font-normal">Shares</th><th className="px-3 py-3 font-normal">Avg cost</th><th className="px-3 py-3 font-normal">Live</th><th className="px-3 py-3 font-normal">Value</th><th className="px-3 py-3 font-normal">Unrealized</th></tr></thead><tbody className="divide-y divide-[var(--stroke)]">{holdings.map((holding) => <tr key={holding.symbol}><td className="px-5 py-4 font-mono text-brass-hi">{holding.symbol}</td><td className="px-3 py-4 font-mono text-bone-mute">{trimDecimal(holding.quantity)}</td><td className="px-3 py-4">{formatUsd(holding.averageCost)}</td><td className="px-3 py-4"><div>{formatUsd(holding.livePrice)}</div><div className={Number(holding.dayChangePercent ?? 0) < 0 ? "mt-1 text-oxide-hi" : "mt-1 text-sage-hi"}>{holding.dayChangePercent === null ? "No quote" : `${signed(Number(holding.dayChangePercent))}% today`}</div></td><td className="px-3 py-4">{formatUsd(holding.marketValue)}</td><td className={Number(holding.unrealizedGain ?? 0) < 0 ? "px-3 py-4 text-oxide-hi" : "px-3 py-4 text-sage-hi"}>{formatSignedUsd(holding.unrealizedGain)}</td></tr>)}</tbody></table></div>}</section>;
}

function TradesPanel({ trades, loading, deletingId, onDelete }: { trades: Trade[]; loading: boolean; deletingId?: string; onDelete: (id: string) => void }) {
  return <section className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove"><PanelHeading icon={<Beaker className="size-4" />} label="Trade history" count={trades.length} />{loading ? <PanelStatus label="Replaying activity..." /> : trades.length === 0 ? <PanelStatus label="No trades recorded in this portfolio." /> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-[12px]"><thead className="border-b border-[var(--stroke)] text-bone-faint"><tr><th className="px-5 py-3 font-normal">Executed</th><th className="px-3 py-3 font-normal">Trade</th><th className="px-3 py-3 font-normal">Shares</th><th className="px-3 py-3 font-normal">Price</th><th className="px-3 py-3 font-normal">Total</th><th className="px-3 py-3 font-normal">Note</th><th className="px-5 py-3 font-normal"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-[var(--stroke)]">{[...trades].reverse().map((trade) => <tr key={trade.id}><td className="px-5 py-4 text-bone-mute">{formatDateTime(trade.executedAt)}</td><td className="px-3 py-4"><span className={trade.side === "buy" ? "text-sage-hi" : "text-oxide-hi"}>{trade.side.toUpperCase()}</span> <span className="ml-2 font-mono text-brass-hi">{trade.symbol}</span></td><td className="px-3 py-4 font-mono text-bone-mute">{trimDecimal(trade.quantity)}</td><td className="px-3 py-4">{formatUsd(trade.price)}</td><td className="px-3 py-4">{formatUsd(trade.total)}</td><td className="max-w-56 truncate px-3 py-4 text-bone-faint">{trade.note ?? "—"}</td><td className="px-5 py-4 text-right"><Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete ${trade.side} of ${trade.symbol}`} disabled={deletingId === trade.id} onClick={() => { if (window.confirm("Delete this trade? The remaining timeline must still be valid.")) onDelete(trade.id); }}><Trash2 /></Button></td></tr>)}</tbody></table></div>}</section>;
}

function PortfolioPanel({ portfolio, busy, onRename, onDelete }: { portfolio: RouterOutputs["sandbox"]["getPortfolio"]; busy: boolean; onRename: (name: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false); const [name, setName] = useState(portfolio.name);
  return <section className="rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove"><PanelHeading icon={<FlaskConical className="size-4" />} label="Experiment ledger" /><div className="flex flex-col gap-5 p-5">{editing ? <form onSubmit={(event) => { event.preventDefault(); onRename(name); setEditing(false); }} className="flex gap-2"><input required maxLength={80} className="form-input" value={name} onChange={(event) => setName(event.target.value)} /><Button type="submit" size="sm" disabled={busy}>Save</Button></form> : <div><p className="display text-2xl text-bone">{portfolio.name}</p><button type="button" className="mt-2 text-[11px] uppercase tracking-[0.12em] text-brass-hi" onClick={() => setEditing(true)}>Rename</button></div>}<div className="grid grid-cols-2 gap-3"><Metric label="Starting cash" value={formatUsd(portfolio.startingCash)} /><Metric label="Open cost basis" value={formatUsd(portfolio.openCostBasis)} /><Metric label="Realized gain" value={formatSignedUsd(portfolio.realizedGain)} /><Metric label="Unrealized gain" value={formatSignedUsd(portfolio.unrealizedGain)} /></div><Button type="button" variant="destructive" size="sm" disabled={busy} onClick={onDelete}><Trash2 data-icon="inline-start" /> Delete portfolio</Button></div></section>;
}

function PanelHeading({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) { return <div className="flex items-center gap-2.5 border-b border-[var(--stroke)] px-5 py-4 text-brass-hi">{icon}<span className="label-eyebrow-brass">{label}</span>{count !== undefined ? <span className="label-eyebrow ml-auto text-bone-faint">{count} rows</span> : null}</div>; }
function SummaryTile({ label, value, detail, tone = "bone" }: { label: string; value: string; detail: string; tone?: "bone" | "sage" | "oxide" }) { const toneClass = tone === "sage" ? "text-sage-hi" : tone === "oxide" ? "text-oxide-hi" : "text-bone"; return <div className="rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] p-5 cove"><span className="label-eyebrow text-bone-faint">{label}</span><p className={`display mt-3 text-[clamp(1.55rem,3vw,2.15rem)] ${toneClass}`}>{value}</p><p className="mt-2 text-[11px] text-bone-faint">{detail}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border border-[var(--stroke)] bg-[var(--ink-0)] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-bone-faint">{label}</p><p className="mt-2 font-mono text-[12px] text-bone">{value}</p></div>; }
function PanelStatus({ label }: { label: string }) { return <div className="px-5 py-12 text-center text-[12px] text-bone-faint">{label}</div>; }
function ErrorNotice({ message }: { message: string }) { return <div className="flex items-center gap-3 rounded-md border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 py-3 text-[12px] text-oxide-hi"><CircleAlert className="size-4 shrink-0" />{message}</div>; }
function EmptyPortfolio({ onCreate }: { onCreate: () => void }) { return <section className="flex min-h-96 flex-col items-center justify-center rounded-md border border-dashed border-[var(--stroke-2)] bg-[var(--ink-1)] px-6 text-center cove"><div className="flex size-12 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi"><FlaskConical className="size-5" /></div><h2 className="display mt-5 text-2xl text-bone">Start with a clean ledger</h2><p className="mt-2 max-w-sm text-[12px] leading-relaxed text-bone-mute">Create a named portfolio, choose the fictional cash balance, and test your first trade.</p><Button type="button" className="mt-6" onClick={onCreate}><Plus data-icon="inline-start" /> Create portfolio</Button></section>; }
function formatUsd(value: string | number | null | undefined) { return value === null || value === undefined ? "—" : formatCurrency(Number(value), "USD"); }
function formatSignedUsd(value: string | number | null | undefined) { if (value === null || value === undefined) return "—"; const number = Number(value); return `${number > 0 ? "+" : ""}${formatUsd(number)}`; }
function signed(value: number) { return `${value > 0 ? "+" : ""}${value.toFixed(2)}`; }
function trimDecimal(value: string) { return value.replace(/\.?0+$/, ""); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function localDateTimeValue(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
