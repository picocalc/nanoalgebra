import { describe, it, expect } from "bun:test";

import { EvaluatorError } from "#lib/evaluator";
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
    it("handles operator precedence order", () => {
      expect(evaluate("1 + 2 * 3")).toBe("7");
      expect(evaluate("2 * 3 + 1")).toBe("7");
      expect(evaluate("10 - 2 * 4")).toBe("2");
      expect(evaluate("10 * 2 - 4")).toBe("16");
    });

    it("handles precedence order of implicit multiplication", () => {
      expect(evaluate("2 + 2(1 + 1)")).toBe("6");
      expect(evaluate("8 - 2(1 + 2)")).toBe("2");
      expect(evaluate("2 * 2(1 + 2)")).toBe("12");
      expect(evaluate("6 / 2(1 + 2)")).toBe("1");
    });
  });

  it("handles unary operators with multiplication", () => {
    expect(evaluate("-2 * 3")).toBe("-6");
    expect(evaluate("2 * -3")).toBe("-6");
    expect(evaluate("-2 * -3")).toBe("6");
  });

  it("handles parentheses", () => {
    expect(evaluate("(1 + 2) * 3")).toBe("9");
    expect(evaluate("2 * (3 + 4)")).toBe("14");
  });

  it("handles nested parentheses", () => {
    expect(evaluate("((1 + 1) * 2) + 1")).toBe("5");
  });

  it("handles unary operators with parentheses", () => {
    expect(evaluate("-(1 + 1)")).toBe("-2");
  });

  it("handles implicit multiplication", () => {
    expect(evaluate("2(2)")).toBe("4");
    expect(evaluate("2(3+4)")).toBe("14");
    expect(evaluate("(1+2)(3+4)")).toBe("21");
  });

  it("handles a decimal", () => {
    expect(evaluate("0.1")).toBe("0.1");
    expect(evaluate("0.01")).toBe("0.01");
  });

  it("handles a decimal with implicit whole part", () => {
    expect(evaluate(".1")).toBe("0.1");
    expect(evaluate(".01")).toBe("0.01");
  });

  it("handles a decimal with implicit decimal part", () => {
    expect(evaluate("1.")).toBe("1");
    expect(evaluate("0.")).toBe("0");
    expect(evaluate("10.")).toBe("10");
  });

  it("handles addition of 2 decimals", () => {
    expect(evaluate("0.1 + 0.1")).toBe("0.2");
    expect(evaluate("0.1 + 0.2")).toBe("0.3");
    expect(evaluate("0.1 + 0.01")).toBe("0.11");
  });

  it("handles addition of a whole number with a decimal", () => {
    expect(evaluate("1 + 0.2")).toBe("1.2");
    expect(evaluate("0.3 + 2")).toBe("2.3");
  });

  it("handles multiplication of 2 decimals", () => {
    expect(evaluate("0.5 * 0.5")).toBe("0.25");
    expect(evaluate("0.1 * 0.2")).toBe("0.02");
  });

  it("handles multiplication of a whole number with a decimal", () => {
    expect(evaluate("2 * 0.5")).toBe("1");
    expect(evaluate("0.3 * 7")).toBe("2.1");
  });

  it("handles scientific notation", () => {
    expect(evaluate("1e2")).toBe("100");
    expect(evaluate("1e-2")).toBe("0.01");
    expect(evaluate("1.2e3")).toBe("1200");
    expect(evaluate("1.2e-3")).toBe("0.0012");
  });

  it("handles double negatives", () => {
    expect(evaluate("-(1/-1)")).toBe("1");
    expect(evaluate("0 - (1/-1)")).toBe("1");
    expect(evaluate("-1 - (2/-1)")).toBe("1");
  });

  it("handles fractions", () => {
    expect(evaluate("1/2")).toBe("1/2");
    expect(evaluate("1/3")).toBe("1/3");
    expect(evaluate("1/2 + 1/3")).toBe("5/6");
  });

  it("throws for division by 0", () => {
    expect(() => evaluate("1/0")).toThrow(EvaluatorError);
    expect(() => evaluate("0/0")).toThrow(EvaluatorError);
    expect(() => evaluate("0 * 1/0")).toThrow(EvaluatorError);
    expect(() => evaluate("1/0 * 0")).toThrow(EvaluatorError);
  });

  it("does not throw when not dividing by 0", () => {
    expect(evaluate("0/1")).toBe("0");
    expect(evaluate("0/2")).toBe("0");
  });
});
