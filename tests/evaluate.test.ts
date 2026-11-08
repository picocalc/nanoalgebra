import { describe, it, expect } from "bun:test";

import { evaluate } from "#src";

describe("evaluate", () => {
  it("adds 2 numbers", () => {
    expect(evaluate("1 + 2")).toBe("3");
  });

  it("subtracts 2 numbers", () => {
    expect(evaluate("3 - 2")).toBe("1");
  });
});
