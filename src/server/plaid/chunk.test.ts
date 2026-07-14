import { describe, expect, test } from "bun:test";
import { chunkArray } from "./chunk";

describe("chunkArray", () => {
  test("splits items into fixed-size chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("returns an empty list for empty input", () => {
    expect(chunkArray([], 100)).toEqual([]);
  });
});
