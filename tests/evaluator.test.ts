import { describe, it, expect } from "bun:test";

import { Evaluator, EvaluatorError } from "#lib/evaluator";
import { evaluate } from "#src";

describe("evaluate", () => {
  it("handles a number", () => {
    expect(evaluate("1").toString()).toBe("1");
  });

  it("handles simple addition", () => {
    expect(evaluate("1 + 1").toString()).toBe("2");
  });

  it("handles a simple positive number", () => {
    expect(evaluate("+1").toString()).toBe("1");
    expect(evaluate("+0").toString()).toBe("0");
  });

  it("handles simple negation", () => {
    expect(evaluate("-1").toString()).toBe("-1");
    expect(evaluate("-0").toString()).toBe("0");
  });

  it("handles double unary operator", () => {
    expect(evaluate("--1").toString()).toBe("1");
    expect(evaluate("-+1").toString()).toBe("-1");
    expect(evaluate("+-1").toString()).toBe("-1");
    expect(evaluate("++1").toString()).toBe("1");
  });

  it("handles simple subtraction", () => {
    expect(evaluate("1 - 1").toString()).toBe("0");
  });

  it("handles addition and subtraction", () => {
    expect(evaluate("2 + 2 - 1").toString()).toBe("3");
    expect(evaluate("2 - 1 + 2").toString()).toBe("3");
    expect(evaluate("5 - 1 - 2").toString()).toBe("2");
  });

  it("handles simple multiplication", () => {
    expect(evaluate("3 * 4").toString()).toBe("12");
  });

  describe("operation precedence order", () => {
    it("handles operator precedence order", () => {
      expect(evaluate("1 + 2 * 3").toString()).toBe("7");
      expect(evaluate("2 * 3 + 1").toString()).toBe("7");
      expect(evaluate("10 - 2 * 4").toString()).toBe("2");
      expect(evaluate("10 * 2 - 4").toString()).toBe("16");
    });

    it("handles precedence order of implicit multiplication", () => {
      expect(evaluate("2 + 2(1 + 1)").toString()).toBe("6");
      expect(evaluate("8 - 2(1 + 2)").toString()).toBe("2");
      expect(evaluate("2 * 2(1 + 2)").toString()).toBe("12");
      expect(evaluate("6 / 2(1 + 2)").toString()).toBe("1");
    });

    it("handles order of exponentiation", () => {
      expect(evaluate("2^2^3").toString()).toBe("256");
      expect(evaluate("2^3^2").toString()).toBe("512");
      expect(evaluate("-2^2").toString()).toBe("-4");
      expect(evaluate("-2^2^3").toString()).toBe("-256");
      expect(evaluate("(2^3)^2").toString()).toBe("64");
      expect(evaluate("2^(3^2)").toString()).toBe("512");
    });

    it("handles order of implicit multiplication with exponentiation", () => {
      expect(evaluate("2 ^ 3(1+2)").toString()).toBe("512");
      expect(evaluate("2 ^ 2(2)").toString()).toBe("16");
      expect(evaluate("2(1+2)^3").toString()).toBe("54");
      expect(evaluate("2(2)^2").toString()).toBe("8");
    });
  });

  it("handles unary operators with multiplication", () => {
    expect(evaluate("-2 * 3").toString()).toBe("-6");
    expect(evaluate("2 * -3").toString()).toBe("-6");
    expect(evaluate("-2 * -3").toString()).toBe("6");
  });

  it("handles parentheses", () => {
    expect(evaluate("(1 + 2) * 3").toString()).toBe("9");
    expect(evaluate("2 * (3 + 4)").toString()).toBe("14");
  });

  it("handles nested parentheses", () => {
    expect(evaluate("((1 + 1) * 2) + 1").toString()).toBe("5");
  });

  it("handles unary operators with parentheses", () => {
    expect(evaluate("-(1 + 1)").toString()).toBe("-2");
  });

  it("handles implicit multiplication", () => {
    expect(evaluate("2(2)").toString()).toBe("4");
    expect(evaluate("(2)2").toString()).toBe("4");
    expect(evaluate("(2)(2)").toString()).toBe("4");
    expect(evaluate("2(3+4)").toString()).toBe("14");
    expect(evaluate("(1+2)(3+4)").toString()).toBe("21");
  });

  describe("decimals", () => {
    it("handles a decimal", () => {
      expect(evaluate("0.1").toString()).toBe("0.1");
      expect(evaluate("0.01").toString()).toBe("0.01");
    });

    it("handles a negative decimal", () => {
      expect(evaluate("-0.1").toString()).toBe("-0.1");
      expect(evaluate("-0.01").toString()).toBe("-0.01");
    });

    it("handles a decimal with implicit whole part", () => {
      expect(evaluate(".1").toString()).toBe("0.1");
      expect(evaluate(".01").toString()).toBe("0.01");
    });

    it("handles a decimal with implicit decimal part", () => {
      expect(evaluate("1.").toString()).toBe("1");
      expect(evaluate("0.").toString()).toBe("0");
      expect(evaluate("10.").toString()).toBe("10");
    });

    it("handles addition of 2 decimals", () => {
      expect(evaluate("0.1 + 0.1").toString()).toBe("0.2");
      expect(evaluate("0.1 + 0.2").toString()).toBe("0.3");
      expect(evaluate("0.1 + 0.01").toString()).toBe("0.11");
    });

    it("handles addition of a whole number with a decimal", () => {
      expect(evaluate("1 + 0.2").toString()).toBe("1.2");
      expect(evaluate("0.3 + 2").toString()).toBe("2.3");
    });

    it("handles multiplication of 2 decimals", () => {
      expect(evaluate("0.5 * 0.5").toString()).toBe("0.25");
      expect(evaluate("0.1 * 0.2").toString()).toBe("0.02");
    });

    it("handles multiplication of a whole number with a decimal", () => {
      expect(evaluate("2 * 0.5").toString()).toBe("1");
      expect(evaluate("0.3 * 7").toString()).toBe("2.1");
    });
  });

  it("handles scientific notation", () => {
    expect(evaluate("1e0").toString()).toBe("1");
    expect(evaluate("1e2").toString()).toBe("100");
    expect(evaluate("1e-2").toString()).toBe("0.01");
    expect(evaluate("1.2e3").toString()).toBe("1200");
    expect(evaluate("1.2e-3").toString()).toBe("0.0012");
    expect(evaluate("-1.2e3").toString()).toBe("-1200");
    expect(evaluate("-1.2e-3").toString()).toBe("-0.0012");
  });

  describe("division", () => {
    it("handles simple division", () => {
      expect(evaluate("12 / 4").toString()).toBe("3");
      expect(evaluate("12 / 3").toString()).toBe("4");
    });

    it("handles fractions", () => {
      expect(evaluate("1/2").toString()).toBe("1/2");
      expect(evaluate("1/3").toString()).toBe("1/3");
      expect(evaluate("1/2 + 1/3").toString()).toBe("5/6");
      expect(evaluate("1/2 - 1/3").toString()).toBe("1/6");
      expect(evaluate("1/2 + 0.5").toString()).toBe("1");
      expect(evaluate("1/2 + 2e5").toString()).toBe("400001/2");
      expect(evaluate("(1/3)(1/2)").toString()).toBe("1/6");
    });

    it("handles division by 0", () => {
      expect(() => evaluate("1/0")).toThrow(EvaluatorError);
      expect(() => evaluate("0/0")).toThrow(EvaluatorError);
      expect(() => evaluate("0 * 1/0")).toThrow(EvaluatorError);
      expect(() => evaluate("1/0 * 0")).toThrow(EvaluatorError);
      expect(() => evaluate("(1/0)^-1")).toThrow(EvaluatorError);
      expect(() => evaluate("0^-1")).toThrow(EvaluatorError);
      expect(() => evaluate("0^(-2/3)")).toThrow(EvaluatorError);
    });

    it("handles division of 0", () => {
      expect(evaluate("0/1").toString()).toBe("0");
      expect(evaluate("0/2").toString()).toBe("0");
      expect(evaluate("0/-2").toString()).toBe("0");
    });

    it("handles double negatives", () => {
      expect(evaluate("-(1/-1)").toString()).toBe("1");
      expect(evaluate("0 - (1/-1)").toString()).toBe("1");
      expect(evaluate("-1 - (2/-1)").toString()).toBe("1");
    });
  });

  describe("exponentiation", () => {
    it("handles simple exponentiation", () => {
      expect(evaluate("2^5").toString()).toBe("32");
      expect(evaluate("3^3").toString()).toBe("27");
    });

    it("handles negative exponentiation", () => {
      expect(evaluate("2^-1").toString()).toBe("1/2");
      expect(evaluate("2^-2").toString()).toBe("1/4");
      expect(evaluate("-1^-1^-1").toString()).toBe("-1");
    });

    it("handles exponentiation of fractions", () => {
      expect(evaluate("(2/3)^3").toString()).toBe("8/27");
    });

    it("handles exponentiation with parantheses", () => {
      expect(evaluate("(1)^1").toString()).toBe("1");
      expect(evaluate("1^(1)").toString()).toBe("1");
      expect(evaluate("(1)^(1)").toString()).toBe("1");
      expect(evaluate("(-1)^1").toString()).toBe("-1");
      expect(evaluate("1^(-1)").toString()).toBe("1");
      expect(evaluate("(-1)^(-1)").toString()).toBe("-1");
      expect(evaluate("(-1)^(-1)^(-1)").toString()).toBe("-1");
      expect(evaluate("(-1)^-1^(-1)").toString()).toBe("-1");
      expect(evaluate("(-1)^(-1)^-1").toString()).toBe("-1");
    });

    it("handles exponentiation of 0", () => {
      expect(evaluate("0^0").toString()).toBe("1");
      expect(evaluate("0^1").toString()).toBe("0");
      expect(evaluate("0^0.5").toString()).toBe("0");
      expect(evaluate("0^(1/3)").toString()).toBe("0");
      expect(evaluate("0^(2/3)").toString()).toBe("0");
      expect(evaluate("0 ^ 1e100").toString()).toBe("0");
    });

    it("handles exponentiation of 1", () => {
      expect(evaluate("1^0").toString()).toBe("1");
      expect(evaluate("1^1").toString()).toBe("1");
      expect(evaluate("1^0.5").toString()).toBe("1");
      expect(evaluate("1^(1/3)").toString()).toBe("1");
      expect(evaluate("1^(2/3)").toString()).toBe("1");
      expect(evaluate("1^(-2/3)").toString()).toBe("1");
      expect(evaluate("1 ^ 1e100").toString()).toBe("1");
    });

    it("handles exponentiation to 0th power", () => {
      expect(evaluate("0.5^0").toString()).toBe("1");
      expect(evaluate("(1/3)^0").toString()).toBe("1");
      expect(evaluate("(2/3)^0").toString()).toBe("1");
      expect(evaluate("1e100^0").toString()).toBe("1");
    });

    it("handles exponentiation to 1st power", () => {
      expect(evaluate("0.5^1").toString()).toBe("0.5");
      expect(evaluate("2^1").toString()).toBe("2");
    });

    it("handles exponentiation of -1 to an integer exponent", () => {
      expect(evaluate("(-1)^0").toString()).toBe("1");
      expect(evaluate("(-1)^1").toString()).toBe("-1");
      expect(evaluate("(-1)^2").toString()).toBe("1");
      expect(evaluate("(-1)^3").toString()).toBe("-1");
    });
  });

  it("can convert numbers to decimals", () => {
    expect(Evaluator.asDecimal(evaluate("0 * (1/2)")).toString()).toBe("0");
    expect(Evaluator.asDecimal(evaluate("1")).toString()).toBe("1");
    expect(Evaluator.asDecimal(evaluate("0.5")).toString()).toBe("0.5");
    expect(Evaluator.asDecimal(evaluate("1/2")).toString()).toBe("0.5");
    expect(Evaluator.asDecimal(evaluate("-1/2")).toString()).toBe("-0.5");

    expect(
      Evaluator.asDecimal(evaluate("1/3"), { sigFigs: 7 }).toString(),
    ).toBe("0.3333333");
    expect(
      Evaluator.asDecimal(evaluate("2/3"), { sigFigs: 7 }).toString(),
    ).toBe("0.6666667");
    expect(
      Evaluator.asDecimal(evaluate("2/3"), {
        sigFigs: 7,
        roundingMode: "truncate",
      }).toString(),
    ).toBe("0.6666666");
    expect(
      Evaluator.asDecimal(evaluate("200/3"), { sigFigs: 7 }).toString(),
    ).toBe("66.66667");
  });

  it("can convert decimals to fractions", () => {
    expect(Evaluator.toFraction(evaluate("0.1")).toString()).toBe("1/10");
  });
});
