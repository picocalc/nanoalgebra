import { describe, it, expect } from "bun:test";

import { evaluate } from "#src";

describe("evaluate", () => {
  it("handles a number", () => {
    expect(evaluate("1")).toBe("1");
  });

  it("handles a simple addition", () => {
    expect(evaluate("1 + 1")).toBe("2");
  });

  it("handles a simple positive number", () => {
    expect(evaluate("+1")).toBe("1");
    expect(evaluate("+0")).toBe("0");
  });

  it("handles a simple negation", () => {
    expect(evaluate("-1")).toBe("-1");
    expect(evaluate("-0")).toBe("0");
  });

  it("handles double unary operator", () => {
    expect(evaluate("--1")).toBe("1");
    expect(evaluate("-+1")).toBe("-1");
    expect(evaluate("+-1")).toBe("-1");
    expect(evaluate("++1")).toBe("1");
  });

  it("handles a simple subtraction", () => {
    expect(evaluate("1 - 1")).toBe("0");
  });

  it("handles addition and subtraction", () => {
    expect(evaluate("2 + 2 - 1")).toBe("3");
    expect(evaluate("2 - 1 + 2")).toBe("3");
    expect(evaluate("5 - 1 - 2")).toBe("2");
  });

  it("handles a simple multiplication", () => {
    expect(evaluate("3 * 4")).toBe("12");
  });

  describe("operation precedence order", () => {
    it("respects operator precedence order", () => {
      expect(evaluate("1 + 2 * 3")).toBe("7");
      expect(evaluate("2 * 3 + 1")).toBe("7");
      expect(evaluate("10 - 2 * 4")).toBe("2");
      expect(evaluate("10 * 2 - 4")).toBe("16");
    });
  });
});
