import { describe, it, expect } from "bun:test";

import { Evaluator, EvaluatorError } from "#lib/evaluator";
import { evaluate } from "#src";

describe("Evaluator", () => {
  it("can convert numbers to decimals", () => {
    expect(Evaluator.asDecimal(evaluate("0 * (1/2)")).print()).toBe("0");
    expect(Evaluator.asDecimal(evaluate("1")).print()).toBe("1");
    expect(Evaluator.asDecimal(evaluate("0.5")).print()).toBe("0.5");
    expect(Evaluator.asDecimal(evaluate("1/2")).print()).toBe("0.5");
    expect(Evaluator.asDecimal(evaluate("-1/2")).print()).toBe("-0.5");

    expect(Evaluator.asDecimal(evaluate("1/3"), { sigFigs: 7 }).print()).toBe(
      "0.3333333",
    );
    expect(Evaluator.asDecimal(evaluate("2/3"), { sigFigs: 7 }).print()).toBe(
      "0.6666667",
    );
    expect(
      Evaluator.asDecimal(evaluate("2/3"), {
        sigFigs: 7,
        roundingMode: "truncate",
      }).print(),
    ).toBe("0.6666666");
    expect(Evaluator.asDecimal(evaluate("200/3"), { sigFigs: 7 }).print()).toBe(
      "66.66667",
    );
  });

  it("can convert decimals to fractions", () => {
    expect(
      Evaluator.toFraction(Evaluator.asDecimal(evaluate("0.1"))).print(),
    ).toBe("1/10");
  });

  it.failing("can convert constants to fractions", () => {
    expect(
      Evaluator.toFraction(
        Evaluator.asDecimal(evaluate("pi"), { sigFigs: 3 }),
      ).print(),
    ).toBe("3.14");
  });
});

describe("evaluate", () => {
  it("handles a number", () => {
    expect(evaluate("1").print()).toBe("1");
  });

  it("handles simple addition", () => {
    expect(evaluate("1 + 1").print()).toBe("2");
  });

  it("handles a simple positive number", () => {
    expect(evaluate("+1").print()).toBe("1");
    expect(evaluate("+0").print()).toBe("0");
  });

  it("handles simple negation", () => {
    expect(evaluate("-1").print()).toBe("-1");
    expect(evaluate("-0").print()).toBe("0");
  });

  it("handles double unary operator", () => {
    expect(evaluate("--1").print()).toBe("1");
    expect(evaluate("-+1").print()).toBe("-1");
    expect(evaluate("+-1").print()).toBe("-1");
    expect(evaluate("++1").print()).toBe("1");
  });

  it("handles simple subtraction", () => {
    expect(evaluate("1 - 1").print()).toBe("0");
  });

  it("handles addition and subtraction", () => {
    expect(evaluate("2 + 2 - 1").print()).toBe("3");
    expect(evaluate("2 - 1 + 2").print()).toBe("3");
    expect(evaluate("5 - 1 - 2").print()).toBe("2");
  });

  it("handles simple multiplication", () => {
    expect(evaluate("3 * 4").print()).toBe("12");
  });

  describe("operation precedence order", () => {
    it("handles operator precedence order", () => {
      expect(evaluate("1 + 2 * 3").print()).toBe("7");
      expect(evaluate("2 * 3 + 1").print()).toBe("7");
      expect(evaluate("10 - 2 * 4").print()).toBe("2");
      expect(evaluate("10 * 2 - 4").print()).toBe("16");
    });

    it("handles precedence order of implicit multiplication", () => {
      expect(evaluate("2 + 2(1 + 1)").print()).toBe("6");
      expect(evaluate("8 - 2(1 + 2)").print()).toBe("2");
      expect(evaluate("2 * 2(1 + 2)").print()).toBe("12");
      expect(evaluate("6 / 2(1 + 2)").print()).toBe("1");
      expect(evaluate("1 + 5 % 3").print()).toBe("3");
    });

    it("handles order of exponentiation", () => {
      expect(evaluate("2^2^3").print()).toBe("256");
      expect(evaluate("2^3^2").print()).toBe("512");
      expect(evaluate("-2^2").print()).toBe("-4");
      expect(evaluate("-2^2^3").print()).toBe("-256");
      expect(evaluate("(2^3)^2").print()).toBe("64");
      expect(evaluate("2^(3^2)").print()).toBe("512");
    });

    it("handles order of implicit multiplication with exponentiation", () => {
      expect(evaluate("2 ^ 3(1+2)").print()).toBe("512");
      expect(evaluate("2 ^ 2(2)").print()).toBe("16");
      expect(evaluate("2(1+2)^3").print()).toBe("54");
      expect(evaluate("2(2)^2").print()).toBe("8");
    });
  });

  it("handles unary operators with multiplication", () => {
    expect(evaluate("-2 * 3").print()).toBe("-6");
    expect(evaluate("2 * -3").print()).toBe("-6");
    expect(evaluate("-2 * -3").print()).toBe("6");
  });

  it("handles parentheses", () => {
    expect(evaluate("(1 + 2) * 3").print()).toBe("9");
    expect(evaluate("2 * (3 + 4)").print()).toBe("14");
  });

  it("handles nested parentheses", () => {
    expect(evaluate("((1 + 1) * 2) + 1").print()).toBe("5");
  });

  it("handles unary operators with parentheses", () => {
    expect(evaluate("-(1 + 1)").print()).toBe("-2");
  });

  it("handles implicit multiplication", () => {
    expect(evaluate("2(2)").print()).toBe("4");
    expect(evaluate("(2)2").print()).toBe("4");
    expect(evaluate("(2)(2)").print()).toBe("4");
    expect(evaluate("2(3+4)").print()).toBe("14");
    expect(evaluate("(1+2)(3+4)").print()).toBe("21");
  });

  describe("decimals", () => {
    it("handles a decimal", () => {
      expect(evaluate("0.1").print()).toBe("0.1");
      expect(evaluate("0.01").print()).toBe("0.01");
    });

    it("handles a negative decimal", () => {
      expect(evaluate("-0.1").print()).toBe("-0.1");
      expect(evaluate("-0.01").print()).toBe("-0.01");
    });

    it("handles a decimal with implicit whole part", () => {
      expect(evaluate(".1").print()).toBe("0.1");
      expect(evaluate(".01").print()).toBe("0.01");
    });

    it("handles a decimal with implicit decimal part", () => {
      expect(evaluate("1.").print()).toBe("1");
      expect(evaluate("0.").print()).toBe("0");
      expect(evaluate("10.").print()).toBe("10");
    });

    it("handles addition of 2 decimals", () => {
      expect(evaluate("0.1 + 0.1").print()).toBe("0.2");
      expect(evaluate("0.1 + 0.2").print()).toBe("0.3");
      expect(evaluate("0.1 + 0.01").print()).toBe("0.11");
    });

    it("handles addition of a whole number with a decimal", () => {
      expect(evaluate("1 + 0.2").print()).toBe("1.2");
      expect(evaluate("0.3 + 2").print()).toBe("2.3");
    });

    it("handles multiplication of 2 decimals", () => {
      expect(evaluate("0.5 * 0.5").print()).toBe("0.25");
      expect(evaluate("0.1 * 0.2").print()).toBe("0.02");
    });

    it("handles multiplication of a whole number with a decimal", () => {
      expect(evaluate("2 * 0.5").print()).toBe("1");
      expect(evaluate("0.3 * 7").print()).toBe("2.1");
    });
  });

  it("handles scientific notation", () => {
    expect(evaluate("1e0").print()).toBe("1");
    expect(evaluate("1e2").print()).toBe("100");
    expect(evaluate("1e-2").print()).toBe("0.01");
    expect(evaluate("1.2e3").print()).toBe("1200");
    expect(evaluate("1.2e-3").print()).toBe("0.0012");
    expect(evaluate("-1.2e3").print()).toBe("-1200");
    expect(evaluate("-1.2e-3").print()).toBe("-0.0012");
  });

  describe("division", () => {
    it("handles simple division", () => {
      expect(evaluate("12 / 4").print()).toBe("3");
      expect(evaluate("12 / 3").print()).toBe("4");
    });

    it("handles fractions", () => {
      expect(evaluate("1/1").print()).toBe("1");
      expect(evaluate("1/2").print()).toBe("1/2");
      expect(evaluate("1/2").toString()).toBe("(1/2)");
      expect(evaluate("1/3").print()).toBe("1/3");
      expect(evaluate("1/2 + 1/3").print()).toBe("5/6");
      expect(evaluate("1/2 - 1/3").print()).toBe("1/6");
      expect(evaluate("1/2 + 0.5").print()).toBe("1");
      expect(evaluate("1/2 + 2e5").print()).toBe("400001/2");
      expect(evaluate("(1/3)(1/2)").print()).toBe("1/6");
    });

    it("handles division by 0", () => {
      expect(() => evaluate("1/0")).toThrow(EvaluatorError);
      expect(() => evaluate("0/0")).toThrow(EvaluatorError);
      expect(() => evaluate("0 * 1/0")).toThrow(EvaluatorError);
      expect(() => evaluate("1/0 * 0")).toThrow(EvaluatorError);
      expect(() => evaluate("(1/0)^-1")).toThrow(EvaluatorError);
      expect(() => evaluate("0^-1")).toThrow(EvaluatorError);
      expect(() => evaluate("0^(-2/3)")).toThrow(EvaluatorError);
      expect(() => evaluate("1 % 0")).toThrow(EvaluatorError);
    });

    it("handles division of 0", () => {
      expect(evaluate("0/1").print()).toBe("0");
      expect(evaluate("0/2").print()).toBe("0");
      expect(evaluate("0/-2").print()).toBe("0");
    });

    it("handles double negatives", () => {
      expect(evaluate("-(1/-1)").print()).toBe("1");
      expect(evaluate("0 - (1/-1)").print()).toBe("1");
      expect(evaluate("-1 - (2/-1)").print()).toBe("1");
    });
  });

  describe("modulo", () => {
    it("handles simple modulo", () => {
      expect(evaluate("5 % 3").print()).toBe("2");
      expect(evaluate("10 % 3").print()).toBe("1");
      expect(evaluate("-25 % 7").print()).toBe("3");
      expect(evaluate("-25 % -7").print()).toBe("-4");
      expect(evaluate("25 % -7").print()).toBe("-3");
    });

    it("handles modulo with decimals", () => {
      expect(evaluate("2.5 % 2").print()).toBe("0.5");
      expect(evaluate("9.5 % 2.5").print()).toBe("2");
      expect(evaluate("9 % 2.5").print()).toBe("1.5");
    });

    it("handles modulo with fractions", () => {
      expect(evaluate("(5/6) % (2/7)").print()).toBe("11/42");
    });
  });

  describe("exponentiation", () => {
    it("handles simple exponentiation", () => {
      expect(evaluate("2^5").print()).toBe("32");
      expect(evaluate("3^3").print()).toBe("27");
    });

    it("handles negative exponentiation", () => {
      expect(evaluate("2^-1").print()).toBe("1/2");
      expect(evaluate("2^-2").print()).toBe("1/4");
      expect(evaluate("-1^-1^-1").print()).toBe("-1");
    });

    it("handles exponentiation of fractions", () => {
      expect(evaluate("(2/3)^3").print()).toBe("8/27");
    });

    it("handles exponentiation of decimals", () => {
      expect(evaluate("1.5^2").print()).toBe("2.25");
    });

    it("handles exponentiation with parantheses", () => {
      expect(evaluate("(1)^1").print()).toBe("1");
      expect(evaluate("1^(1)").print()).toBe("1");
      expect(evaluate("(1)^(1)").print()).toBe("1");
      expect(evaluate("(-1)^1").print()).toBe("-1");
      expect(evaluate("1^(-1)").print()).toBe("1");
      expect(evaluate("(-1)^(-1)").print()).toBe("-1");
      expect(evaluate("(-1)^(-1)^(-1)").print()).toBe("-1");
      expect(evaluate("(-1)^-1^(-1)").print()).toBe("-1");
      expect(evaluate("(-1)^(-1)^-1").print()).toBe("-1");
    });

    it("handles exponentiation of 0", () => {
      expect(evaluate("0^0").print()).toBe("1");
      expect(evaluate("0^1").print()).toBe("0");
      expect(evaluate("0^0.5").print()).toBe("0");
      expect(evaluate("0^(1/3)").print()).toBe("0");
      expect(evaluate("0^(2/3)").print()).toBe("0");
      expect(evaluate("0 ^ 1e100").print()).toBe("0");
    });

    it("handles exponentiation of 1", () => {
      expect(evaluate("1^0").print()).toBe("1");
      expect(evaluate("1^1").print()).toBe("1");
      expect(evaluate("1^0.5").print()).toBe("1");
      expect(evaluate("1^(1/3)").print()).toBe("1");
      expect(evaluate("1^(2/3)").print()).toBe("1");
      expect(evaluate("1^(-2/3)").print()).toBe("1");
      expect(evaluate("1 ^ 1e100").print()).toBe("1");
    });

    it("handles exponentiation to 0th power", () => {
      expect(evaluate("0.5^0").print()).toBe("1");
      expect(evaluate("(1/3)^0").print()).toBe("1");
      expect(evaluate("(2/3)^0").print()).toBe("1");
      expect(evaluate("1e100^0").print()).toBe("1");
    });

    it("handles exponentiation to 1st power", () => {
      expect(evaluate("0.5^1").print()).toBe("0.5");
      expect(evaluate("2^1").print()).toBe("2");
    });

    it("handles exponentiation of -1 to an integer exponent", () => {
      expect(evaluate("(-1)^0").print()).toBe("1");
      expect(evaluate("(-1)^1").print()).toBe("-1");
      expect(evaluate("(-1)^2").print()).toBe("1");
      expect(evaluate("(-1)^3").print()).toBe("-1");
    });

    it.failing("handles exponentiation to a fractional power", () => {
      expect(() => evaluate("4^(1/2)").print()).not.toThrow(EvaluatorError);
    });

    it.failing(
      "handles exponentiation of negatives to a fractional power",
      () => {
        expect(() => evaluate("(-8)^(1/2)").print()).not.toThrow(
          EvaluatorError,
        );
        expect(() => evaluate("(-8)^(2/3)").print()).not.toThrow(
          EvaluatorError,
        );
        expect(() => evaluate("(-8)^(1/3)").print()).not.toThrow(
          EvaluatorError,
        );
      },
    );
  });

  describe("constants", () => {
    it("handles a constant", () => {
      expect(evaluate("pi").print()).toBe("pi");
      expect(evaluate("e").print()).toBe("e");

      expect(evaluate("1pi").print()).toBe("pi");
      expect(evaluate("1e").print()).toBe("e");

      expect(evaluate("3pi").print()).toBe("3pi");
      expect(evaluate("3e").print()).toBe("3e");

      expect(evaluate("+pi").print()).toBe("pi");
      expect(evaluate("+e").print()).toBe("e");

      expect(evaluate("-pi").print()).toBe("-pi");
      expect(evaluate("-e").print()).toBe("-e");

      expect(evaluate("0pi").print()).toBe("0");
      expect(evaluate("0e").print()).toBe("0");
    });

    it("handles addition and subtraction of constants", () => {
      expect(evaluate("pi + pi").print()).toBe("2pi");
      expect(evaluate("e + e").print()).toBe("2e");
      expect(evaluate("2pi + 3pi").print()).toBe("5pi");
      expect(evaluate("2e + 3e").print()).toBe("5e");
      expect(evaluate("pi + 0").print()).toBe("pi");
      expect(evaluate("0 + pi").print()).toBe("pi");
      expect(evaluate("e + 0").print()).toBe("e");
      expect(evaluate("0 + e").print()).toBe("e");

      expect(evaluate("2pi - pi").print()).toBe("pi");
      expect(evaluate("5e - 3e").print()).toBe("2e");
      expect(evaluate("pi - pi").print()).toBe("0");
      expect(evaluate("e - e").print()).toBe("0");
      expect(evaluate("pi - 0").print()).toBe("pi");
      expect(evaluate("0 - pi").print()).toBe("-pi");
      expect(evaluate("e - 0").print()).toBe("e");
      expect(evaluate("0 - e").print()).toBe("-e");

      expect(evaluate("pi - pi + e").print()).toBe("e");
      expect(evaluate("e - e + pi").print()).toBe("pi");

      expect(evaluate("pi + e").print()).toBe("pi + e");
      expect(evaluate("e + pi").print()).toBe("e + pi");
      expect(evaluate("pi - e").print()).toBe("pi - e");
      expect(evaluate("e - pi").print()).toBe("e - pi");
      expect(evaluate("pi + 2").print()).toBe("pi + 2");
      expect(evaluate("e + 2").print()).toBe("e + 2");
      expect(evaluate("pi - 2").print()).toBe("pi - 2");
      expect(evaluate("e - 2").print()).toBe("e - 2");
      expect(evaluate("2 + e").print()).toBe("2 + e");
      expect(evaluate("2 + pi").print()).toBe("2 + pi");
      expect(evaluate("2 - e").print()).toBe("2 - e");
      expect(evaluate("2 - pi").print()).toBe("2 - pi");

      expect(evaluate("0pi + e").print()).toBe("e");
      expect(evaluate("0e + pi").print()).toBe("pi");
      expect(evaluate("0pi - e").print()).toBe("-e");
      expect(evaluate("0e - pi").print()).toBe("-pi");

      expect(evaluate("0/pi + e").print()).toBe("e");
      expect(evaluate("0/e + pi").print()).toBe("pi");
      expect(evaluate("0/pi - e").print()).toBe("-e");
      expect(evaluate("0/e - pi").print()).toBe("-pi");
    });

    it("handles combination of exponentiation and addition and subtraction of constants", () => {
      expect(evaluate("0 + pi^2").print()).toBe("pi^2");
      expect(evaluate("pi^2 + 0").print()).toBe("pi^2");
      expect(evaluate("0 - pi^2").print()).toBe("-pi^2");
      expect(evaluate("pi^2 - 0").print()).toBe("pi^2");
      expect(evaluate("pi^2 + pi^2").print()).toBe("2pi^2");
    });

    it("handles multiplication of constants", () => {
      expect(evaluate("2 * pi").print()).toBe("2pi");
      expect(evaluate("2 * e").print()).toBe("2e");
      expect(evaluate("pi * 2").print()).toBe("2pi");
      expect(evaluate("e * 2").print()).toBe("2e");
      expect(evaluate("0 * pi").print()).toBe("0");
      expect(evaluate("0 * e").print()).toBe("0");
      expect(evaluate("pi * 0").print()).toBe("0");
      expect(evaluate("e * 0").print()).toBe("0");

      expect(evaluate("pi * e").print()).toBe("pi * e");
      expect(evaluate("e * pi").print()).toBe("e * pi");
      expect(evaluate("2pi * e").print()).toBe("2pi * e");
      expect(evaluate("2e * pi").print()).toBe("2e * pi");

      expect(evaluate("pi * pi").print()).toBe("pi^2");
      expect(evaluate("2 * pi * pi").print()).toBe("2pi^2");
      expect(evaluate("2pi * 3").print()).toBe("6pi");
      expect(evaluate("2 * 3pi").print()).toBe("6pi");
    });

    it("handles combination of division and multiplication of constants", () => {
      expect(evaluate("1/2 * pi").print()).toBe("pi/2");
      expect(evaluate("2/3 * pi").print()).toBe("2pi/3");
      expect(evaluate("pi/2 * pi").print()).toBe("pi^2/2");
    });

    it("handles combination of exponentiation and multiplication of constants", () => {
      expect(evaluate("pi * pi^-1").print()).toBe("1");
      expect(evaluate("pi^-1 * pi").print()).toBe("1");
      expect(evaluate("pi * pi^-2").print()).toBe("pi^-1");
      expect(evaluate("pi^-2 * pi").print()).toBe("pi^-1");
      expect(evaluate("pi^2 * pi^-2").print()).toBe("1");
      expect(evaluate("pi^-2 * pi^2").print()).toBe("1");
      expect(evaluate("pi^3 * pi^-2").print()).toBe("pi");
      expect(evaluate("pi^-2 * pi^3").print()).toBe("pi");
      expect(evaluate("pi^1.5 * pi^1.5").print()).toBe("pi^3");
      expect(evaluate("pi^(-1/3) * pi^(2/3)").print()).toBe("pi^(1/3)");
    });

    it("handles division of constants", () => {
      expect(evaluate("pi / 1").print()).toBe("pi");
      expect(evaluate("e / 1").print()).toBe("e");
      expect(evaluate("2pi / 1").print()).toBe("2pi");
      expect(evaluate("2e / 1").print()).toBe("2e");
      expect(evaluate("2pi / 2").print()).toBe("pi");
      expect(evaluate("2e / 2").print()).toBe("e");
      expect(evaluate("6pi / 2").print()).toBe("3pi");
      expect(evaluate("6e / 2").print()).toBe("3e");
      expect(evaluate("pi / 2").print()).toBe("pi/2");
      expect(evaluate("e / 2").print()).toBe("e/2");
      expect(evaluate("6pi / 9").print()).toBe("2pi/3");
      expect(evaluate("6e / 9").print()).toBe("2e/3");
      expect(evaluate("pi / 2pi").print()).toBe("1/2");
      expect(evaluate("2pi / pi").print()).toBe("2");

      expect(evaluate("pi/pi").print()).toBe("1");
      expect(evaluate("e/e").print()).toBe("1");
      expect(evaluate("2pi/2pi").print()).toBe("1");
      expect(evaluate("2e/2e").print()).toBe("1");
      expect(evaluate("2pi/pi").print()).toBe("2");
      expect(evaluate("2e/e").print()).toBe("2");
      expect(evaluate("pi/2pi").print()).toBe("1/2");
      expect(evaluate("e/2e").print()).toBe("1/2");

      expect(evaluate("pi / e").print()).toBe("pi / e");
      expect(evaluate("e / pi").print()).toBe("e / pi");
      expect(evaluate("2pi / e").print()).toBe("2pi / e");
      expect(evaluate("2e / pi").print()).toBe("2e / pi");

      expect(evaluate("pi/(1/pi)").print()).toBe("pi^2");
    });

    it("handles combination of exponentiation and division of constants", () => {
      expect(evaluate("pi^2 / 2").print()).toBe("pi^2/2");
      expect(evaluate("2pi^2 / 2").print()).toBe("pi^2");
      expect(evaluate("pi^2 / pi").print()).toBe("pi");
      expect(evaluate("pi^3 / pi").print()).toBe("pi^2");
      expect(evaluate("pi / pi^2").print()).toBe("pi^-1");
      expect(evaluate("2pi^2 / pi").print()).toBe("2pi");
      expect(evaluate("pi(pi / pi^2)").print()).toBe("1");
      expect(evaluate("pi(2pi / pi^2)").print()).toBe("2");
      expect(evaluate("2pi / pi^2").print()).toBe("2pi^-1");
      expect(evaluate("(1/pi)^-1").print()).toBe("pi");
      expect(evaluate("(2/pi)^-1").print()).toBe("pi/2");
      expect(evaluate("1 / pi^-1").print()).toBe("pi");
      expect(evaluate("2 / pi^-1").print()).toBe("2pi");
      expect(evaluate("1 / pi^-2").print()).toBe("pi^2");
      expect(evaluate("2 / pi^-2").print()).toBe("2pi^2");
      expect(evaluate("pi / pi^-2").print()).toBe("pi^3");
      expect(evaluate("2pi / pi^-2").print()).toBe("2pi^3");
      expect(evaluate("pi / pi^-1").print()).toBe("pi^2");
      expect(evaluate("2pi / pi^-1").print()).toBe("2pi^2");
      expect(evaluate("pi^-2 / pi^-3").print()).toBe("pi");
      expect(evaluate("pi^-2 / pi").print()).toBe("pi^-3");
    });

    it("handles exponentiation of constants", () => {
      expect(evaluate("pi ^ 0").print()).toBe("1");
      expect(evaluate("e ^ 0").print()).toBe("1");
      expect(evaluate("pi ^ 1").print()).toBe("pi");
      expect(evaluate("e ^ 1").print()).toBe("e");

      expect(evaluate("pi^-1").print()).toBe("pi^-1");
      expect(evaluate("e^-1").print()).toBe("e^-1");
      expect(evaluate("pi^-2").print()).toBe("pi^-2");
      expect(evaluate("e^-2").print()).toBe("e^-2");

      expect(evaluate("pi ^ e").print()).toBe("pi^e");
      expect(evaluate("e ^ pi").print()).toBe("e^pi");
      expect(evaluate("2 ^ e").print()).toBe("2^e");
      expect(evaluate("2 ^ pi").print()).toBe("2^pi");

      expect(evaluate("pi^(1/2)").print()).toBe("pi^(1/2)");
      expect(evaluate("pi^(1/2)").toString()).toBe("(pi ^ (1/2))");
      expect(evaluate("pi^(2/3)").print()).toBe("pi^(2/3)");
      expect(evaluate("pi^1.5").print()).toBe("pi^1.5");

      expect(evaluate("(2pi)^3").print()).toBe("8pi^3");
      expect(evaluate("(pi^2)^3").print()).toBe("pi^6");

      expect(evaluate("(pi^4)^(1/2)").print()).toBe("pi^2");
      expect(evaluate("(pi / 2)^3").print()).toBe("pi^3/8");
    });
  });
});
