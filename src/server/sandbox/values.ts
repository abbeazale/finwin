export type SandboxTradeValue = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executedAt: Date;
  createdAt: Date;
};

type SandboxPosition = {
  symbol: string;
  quantity: number;
  averageCost: number;
  openCostBasis: number;
  realizedGain: number;
};

export type SandboxReplay = {
  cashBalance: number;
  realizedGain: number;
  positions: Map<string, SandboxPosition>;
};

export class SandboxTimelineError extends Error {
  constructor(
    message: string,
    readonly tradeId: string,
  ) {
    super(message);
    this.name = "SandboxTimelineError";
  }
}

const EPSILON = 0.00000001;

export function replaySandboxTrades(
  startingCash: number,
  trades: SandboxTradeValue[],
): SandboxReplay {
  let cashBalance = startingCash;
  let realizedGain = 0;
  const positions = new Map<string, SandboxPosition>();
  const orderedTrades = [...trades].sort(compareTrades);

  for (const trade of orderedTrades) {
    const current = positions.get(trade.symbol) ?? {
      symbol: trade.symbol,
      quantity: 0,
      averageCost: 0,
      openCostBasis: 0,
      realizedGain: 0,
    };
    const tradeValue = trade.quantity * trade.price;

    if (trade.side === "buy") {
      cashBalance -= tradeValue;
      if (cashBalance < -EPSILON) {
        throw new SandboxTimelineError(
          `${trade.symbol} buy exceeds the cash available at that point in the timeline.`,
          trade.id,
        );
      }

      current.quantity += trade.quantity;
      current.openCostBasis += tradeValue;
      current.averageCost = current.openCostBasis / current.quantity;
    } else {
      if (current.quantity - trade.quantity < -EPSILON) {
        throw new SandboxTimelineError(
          `${trade.symbol} sell exceeds the shares held at that point in the timeline.`,
          trade.id,
        );
      }

      const soldCostBasis = current.averageCost * trade.quantity;
      const gain = tradeValue - soldCostBasis;
      cashBalance += tradeValue;
      current.quantity -= trade.quantity;
      current.openCostBasis -= soldCostBasis;
      current.realizedGain += gain;
      realizedGain += gain;

      if (Math.abs(current.quantity) < EPSILON) {
        current.quantity = 0;
        current.averageCost = 0;
        current.openCostBasis = 0;
      }
    }

    positions.set(trade.symbol, current);
  }

  return { cashBalance: normalizeZero(cashBalance), realizedGain, positions };
}

function compareTrades(left: SandboxTradeValue, right: SandboxTradeValue) {
  return left.executedAt.getTime() - right.executedAt.getTime()
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id);
}

function normalizeZero(value: number) {
  return Math.abs(value) < EPSILON ? 0 : value;
}
