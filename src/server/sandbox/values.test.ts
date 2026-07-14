import { describe, expect, test } from "bun:test";
import {
  parseTradeSide,
  replaySandboxTrades,
  SandboxTimelineError,
  type SandboxTradeValue,
} from "./values";

function trade(
  partial: Omit<SandboxTradeValue, "createdAt"> & { createdAt?: Date },
): SandboxTradeValue {
  return {
    createdAt: partial.createdAt ?? partial.executedAt,
    ...partial,
  };
}

describe("parseTradeSide", () => {
  test("accepts buy and sell", () => {
    expect(parseTradeSide("buy")).toBe("buy");
    expect(parseTradeSide("sell")).toBe("sell");
  });

  test("rejects unknown sides", () => {
    expect(() => parseTradeSide("hold")).toThrow(/Invalid sandbox trade side/);
  });
});

describe("replaySandboxTrades", () => {
  test("tracks cash, average cost, and realized gain", () => {
    const replay = replaySandboxTrades(10_000, [
      trade({
        id: "1",
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
        price: 100,
        executedAt: new Date("2026-01-01T10:00:00Z"),
      }),
      trade({
        id: "2",
        symbol: "AAPL",
        side: "sell",
        quantity: 4,
        price: 125,
        executedAt: new Date("2026-01-02T10:00:00Z"),
      }),
    ]);

    expect(replay.cashBalance).toBe(9500);
    expect(replay.realizedGain).toBe(100);
    expect(replay.positions.get("AAPL")).toMatchObject({
      quantity: 6,
      averageCost: 100,
      openCostBasis: 600,
      realizedGain: 100,
    });
  });

  test("rejects buys that exceed available cash at that point", () => {
    expect(() => replaySandboxTrades(500, [
      trade({
        id: "1",
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
        price: 100,
        executedAt: new Date("2026-01-01T10:00:00Z"),
      }),
    ])).toThrow(SandboxTimelineError);
  });

  test("rejects sells that exceed shares held at that point", () => {
    expect(() => replaySandboxTrades(10_000, [
      trade({
        id: "1",
        symbol: "AAPL",
        side: "buy",
        quantity: 2,
        price: 100,
        executedAt: new Date("2026-01-01T10:00:00Z"),
      }),
      trade({
        id: "2",
        symbol: "AAPL",
        side: "sell",
        quantity: 3,
        price: 110,
        executedAt: new Date("2026-01-02T10:00:00Z"),
      }),
    ])).toThrow(/sell exceeds the shares held/);
  });

  test("orders by executedAt then createdAt then id for backdated inserts", () => {
    const replay = replaySandboxTrades(1_000, [
      trade({
        id: "later-created",
        symbol: "AAPL",
        side: "sell",
        quantity: 1,
        price: 120,
        executedAt: new Date("2026-01-02T10:00:00Z"),
        createdAt: new Date("2026-01-03T10:00:00Z"),
      }),
      trade({
        id: "earlier-buy",
        symbol: "AAPL",
        side: "buy",
        quantity: 1,
        price: 100,
        executedAt: new Date("2026-01-01T10:00:00Z"),
        createdAt: new Date("2026-01-04T10:00:00Z"),
      }),
    ]);

    expect(replay.cashBalance).toBe(1_020);
    expect(replay.realizedGain).toBe(20);
  });

  test("rejects deleting a buy that would strand a later sell", () => {
    const remaining = [
      trade({
        id: "sell",
        symbol: "AAPL",
        side: "sell",
        quantity: 1,
        price: 120,
        executedAt: new Date("2026-01-02T10:00:00Z"),
      }),
    ];

    expect(() => replaySandboxTrades(1_000, remaining)).toThrow(/sell exceeds the shares held/);
  });
});
