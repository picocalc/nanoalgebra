import { describe, it, expect } from "bun:test";

import { Evaluator } from "#lib/evaluator";
import { simplify } from "#src";

function expectUndefined(expression: string) {
  const simplified = simplify(expression);
  expect(simplified.toString()).toBe("UNDEFINED");
  const printed = simplified.print();
  const doubleSimplified = simplify(printed);
  expect(doubleSimplified.toString()).toBe("UNDEFINED");
  expect(doubleSimplified.print()).toBe(printed);
  return expect(printed);
}

describe("Evaluator", () => {
  it("can convert numbers to decimals", () => {
    expect(Evaluator.asDecimal(simplify("0 * (1/2)")).print()).toBe("0");
    expect(Evaluator.asDecimal(simplify("1")).print()).toBe("1");
    expect(Evaluator.asDecimal(simplify("0.5")).print()).toBe("0.5");
    expect(Evaluator.asDecimal(simplify("1/2")).print()).toBe("0.5");
    expect(Evaluator.asDecimal(simplify("-1/2")).print()).toBe("-0.5");

    expect(Evaluator.asDecimal(simplify("1/3"), { sigFigs: 7 }).print()).toBe(
      "0.3333333",
    );
    expect(Evaluator.asDecimal(simplify("2/3"), { sigFigs: 7 }).print()).toBe(
      "0.6666667",
    );
    expect(
      Evaluator.asDecimal(simplify("2/3"), {
        sigFigs: 7,
        roundingMode: "truncate",
      }).print(),
    ).toBe("0.6666666");
    expect(Evaluator.asDecimal(simplify("200/3"), { sigFigs: 7 }).print()).toBe(
      "66.66667",
    );
  });

  it("can convert decimals to fractions", () => {
    expect(
      Evaluator.toFraction(Evaluator.asDecimal(simplify("0.1"))).print(),
    ).toBe("1/10");
  });

  it.failing("can convert constants to fractions", () => {
    expect(Evaluator.asDecimal(simplify("pi"), { sigFigs: 3 }).print()).toBe(
      "3.14",
    );
  });
});

describe("evaluate", () => {
  it("handles a number", () => {
    expect(simplify("1").print()).toBe("1");
  });

  it("handles simple addition", () => {
    expect(simplify("1 + 1").print()).toBe("2");
  });

  it("handles a simple positive number", () => {
    expect(simplify("+1").print()).toBe("1");
    expect(simplify("+0").print()).toBe("0");
  });

  it("handles simple negation", () => {
    expect(simplify("-1").print()).toBe("-1");
    expect(simplify("-0").print()).toBe("0");
  });

  it("handles double unary operator", () => {
    expect(simplify("--1").print()).toBe("1");
    expect(simplify("-+1").print()).toBe("-1");
    expect(simplify("+-1").print()).toBe("-1");
    expect(simplify("++1").print()).toBe("1");
  });

  it("handles simple subtraction", () => {
    expect(simplify("1 - 1").print()).toBe("0");
  });

  it("handles addition and subtraction", () => {
    expect(simplify("2 + 2 - 1").print()).toBe("3");
    expect(simplify("2 - 1 + 2").print()).toBe("3");
    expect(simplify("5 - 1 - 2").print()).toBe("2");
  });

  it("handles simple multiplication", () => {
    expect(simplify("3 * 4").print()).toBe("12");
  });

  describe("operation precedence order", () => {
    it("handles operator precedence order", () => {
      expect(simplify("1 + 2 * 3").print()).toBe("7");
      expect(simplify("2 * 3 + 1").print()).toBe("7");
      expect(simplify("10 - 2 * 4").print()).toBe("2");
      expect(simplify("10 * 2 - 4").print()).toBe("16");
    });

    it("handles precedence order of implicit multiplication", () => {
      expect(simplify("2 + 2(1 + 1)").print()).toBe("6");
      expect(simplify("8 - 2(1 + 2)").print()).toBe("2");
      expect(simplify("2 * 2(1 + 2)").print()).toBe("12");
      expect(simplify("6 / 2(1 + 2)").print()).toBe("1");
      expect(simplify("1 + 5 % 3").print()).toBe("3");
    });

    it("handles order of exponentiation", () => {
      expect(simplify("2^2^3").print()).toBe("256");
      expect(simplify("2^3^2").print()).toBe("512");
      expect(simplify("-2^2").print()).toBe("-4");
      expect(simplify("-2^2^3").print()).toBe("-256");
      expect(simplify("(2^3)^2").print()).toBe("64");
      expect(simplify("2^(3^2)").print()).toBe("512");
    });

    it("handles order of implicit multiplication with exponentiation", () => {
      expect(simplify("2 ^ 3(1+2)").print()).toBe("512");
      expect(simplify("2 ^ 2(2)").print()).toBe("16");
      expect(simplify("2(1+2)^3").print()).toBe("54");
      expect(simplify("2(2)^2").print()).toBe("8");
    });
  });

  it("handles unary operators with multiplication", () => {
    expect(simplify("-2 * 3").print()).toBe("-6");
    expect(simplify("2 * -3").print()).toBe("-6");
    expect(simplify("-2 * -3").print()).toBe("6");
  });

  it("handles parentheses", () => {
    expect(simplify("(1 + 2) * 3").print()).toBe("9");
    expect(simplify("2 * (3 + 4)").print()).toBe("14");
  });

  it("handles nested parentheses", () => {
    expect(simplify("((1 + 1) * 2) + 1").print()).toBe("5");
  });

  it("handles unary operators with parentheses", () => {
    expect(simplify("-(1 + 1)").print()).toBe("-2");
  });

  it("handles implicit multiplication", () => {
    expect(simplify("2(2)").print()).toBe("4");
    expect(simplify("(2)2").print()).toBe("4");
    expect(simplify("(2)(2)").print()).toBe("4");
    expect(simplify("2(3+4)").print()).toBe("14");
    expect(simplify("(1+2)(3+4)").print()).toBe("21");
  });

  describe("decimals", () => {
    it("handles a decimal", () => {
      expect(simplify("0.1").print()).toBe("0.1");
      expect(simplify("0.01").print()).toBe("0.01");
    });

    it("handles a negative decimal", () => {
      expect(simplify("-0.1").print()).toBe("-0.1");
      expect(simplify("-0.01").print()).toBe("-0.01");
    });

    it("handles a decimal with implicit whole part", () => {
      expect(simplify(".1").print()).toBe("0.1");
      expect(simplify(".01").print()).toBe("0.01");
    });

    it("handles a decimal with implicit decimal part", () => {
      expect(simplify("1.").print()).toBe("1");
      expect(simplify("0.").print()).toBe("0");
      expect(simplify("10.").print()).toBe("10");
    });

    it("handles addition of 2 decimals", () => {
      expect(simplify("0.1 + 0.1").print()).toBe("0.2");
      expect(simplify("0.1 + 0.2").print()).toBe("0.3");
      expect(simplify("0.1 + 0.01").print()).toBe("0.11");
    });

    it("handles addition of a whole number with a decimal", () => {
      expect(simplify("1 + 0.2").print()).toBe("1.2");
      expect(simplify("0.3 + 2").print()).toBe("2.3");
    });

    it("handles multiplication of 2 decimals", () => {
      expect(simplify("0.5 * 0.5").print()).toBe("0.25");
      expect(simplify("0.1 * 0.2").print()).toBe("0.02");
    });

    it("handles multiplication of a whole number with a decimal", () => {
      expect(simplify("2 * 0.5").print()).toBe("1");
      expect(simplify("0.3 * 7").print()).toBe("2.1");
    });
  });

  it("handles scientific notation", () => {
    expect(simplify("1e0").print()).toBe("1");
    expect(simplify("1e2").print()).toBe("100");
    expect(simplify("1e-2").print()).toBe("0.01");
    expect(simplify("1.2e3").print()).toBe("1200");
    expect(simplify("1.2e-3").print()).toBe("0.0012");
    expect(simplify("-1.2e3").print()).toBe("-1200");
    expect(simplify("-1.2e-3").print()).toBe("-0.0012");
  });

  describe("division", () => {
    it("handles simple division", () => {
      expect(simplify("12 / 4").print()).toBe("3");
      expect(simplify("12 / 3").print()).toBe("4");
    });

    it("handles fractions", () => {
      expect(simplify("1/1").print()).toBe("1");
      expect(simplify("1/2").print()).toBe("1/2");
      expect(simplify("1/2").toString()).toBe("(1/2)");
      expect(simplify("1/3").print()).toBe("1/3");
      expect(simplify("1/2 + 1/3").print()).toBe("5/6");
      expect(simplify("1/2 - 1/3").print()).toBe("1/6");
      expect(simplify("1/2 + 0.5").print()).toBe("1");
      expect(simplify("1/2 + 2e5").print()).toBe("400001/2");
      expect(simplify("(1/3)(1/2)").print()).toBe("1/6");
    });

    it("handles division by 0", () => {
      expectUndefined("1/0").toMatchInlineSnapshot(`"1 / 0"`);
      expectUndefined("0(1/0)").toMatchInlineSnapshot(`"0 * (1 / 0)"`);
      expectUndefined("0/0").toMatchInlineSnapshot(`"0 / 0"`);
      expectUndefined("0(0/0)").toMatchInlineSnapshot(`"0 * (0 / 0)"`);
      expectUndefined("0 + 0/0").toMatchInlineSnapshot(`"0 + 0 / 0"`);
      expectUndefined("0 * 1/0").toMatchInlineSnapshot(`"0 / 0"`);
      expectUndefined("1/0 * 0").toMatchInlineSnapshot(`"1 / 0 * 0"`);
      expectUndefined("(1/0)^-1").toMatchInlineSnapshot(`"(1 / 0)^-1"`);
      expectUndefined("0^-1").toMatchInlineSnapshot(`"0^-1"`);
      expectUndefined("(1/0)^0").toMatchInlineSnapshot(`"(1 / 0)^0"`);
      expectUndefined("1^(1/0)").toMatchInlineSnapshot(`"1^(1 / 0)"`);
      expectUndefined("0^(1/0)").toMatchInlineSnapshot(`"0^(1 / 0)"`);
      expectUndefined("0(0^-1)").toMatchInlineSnapshot(`"0 * 0^-1"`);
      expectUndefined("0^(-2/3)").toMatchInlineSnapshot(`"0^(-2/3)"`);
      expectUndefined("1 % 0").toMatchInlineSnapshot(`"1 % 0"`);
      expectUndefined("0(1 % 0)").toMatchInlineSnapshot(`"0 * (1 % 0)"`);
      expectUndefined("0 % 0").toMatchInlineSnapshot(`"0 % 0"`);
      expectUndefined("0(0 % 0)").toMatchInlineSnapshot(`"0 * (0 % 0)"`);
    });

    it("handles division of 0", () => {
      expect(simplify("0/1").print()).toBe("0");
      expect(simplify("0/2").print()).toBe("0");
      expect(simplify("0/-2").print()).toBe("0");
    });

    it("handles double negatives", () => {
      expect(simplify("-(1/-1)").print()).toBe("1");
      expect(simplify("0 - (1/-1)").print()).toBe("1");
      expect(simplify("-1 - (2/-1)").print()).toBe("1");
    });
  });

  describe("modulo", () => {
    it("handles simple modulo", () => {
      expect(simplify("5 % 3").print()).toBe("2");
      expect(simplify("10 % 3").print()).toBe("1");
      expect(simplify("-25 % 7").print()).toBe("3");
      expect(simplify("-25 % -7").print()).toBe("-4");
      expect(simplify("25 % -7").print()).toBe("-3");
    });

    it("handles modulo with decimals", () => {
      expect(simplify("2.5 % 2").print()).toBe("0.5");
      expect(simplify("9.5 % 2.5").print()).toBe("2");
      expect(simplify("9 % 2.5").print()).toBe("1.5");
    });

    it("handles modulo with fractions", () => {
      expect(simplify("(5/6) % (2/7)").print()).toBe("11/42");
    });

    it("handles modulo with constants", () => {
      expect(simplify("0 % e").print()).toBe("0");
      expect(simplify("0 % pi").print()).toBe("0");
      expect(simplify("pi % e").print()).toBe("pi % e");
      expect(simplify("e % pi").print()).toBe("e % pi");
    });
  });

  describe("exponentiation", () => {
    it("handles simple exponentiation", () => {
      expect(simplify("2^5").print()).toBe("32");
      expect(simplify("3^3").print()).toBe("27");
    });

    it("handles negative exponentiation", () => {
      expect(simplify("2^-1").print()).toBe("1/2");
      expect(simplify("2^-2").print()).toBe("1/4");
      expect(simplify("-1^-1^-1").print()).toBe("-1");
    });

    it("handles exponentiation of fractions", () => {
      expect(simplify("(2/3)^3").print()).toBe("8/27");
    });

    it("handles exponentiation of decimals", () => {
      expect(simplify("1.5^2").print()).toBe("2.25");
    });

    it("handles exponentiation with parantheses", () => {
      expect(simplify("(1)^1").print()).toBe("1");
      expect(simplify("1^(1)").print()).toBe("1");
      expect(simplify("(1)^(1)").print()).toBe("1");
      expect(simplify("(-1)^1").print()).toBe("-1");
      expect(simplify("1^(-1)").print()).toBe("1");
      expect(simplify("(-1)^(-1)").print()).toBe("-1");
      expect(simplify("(-1)^(-1)^(-1)").print()).toBe("-1");
      expect(simplify("(-1)^-1^(-1)").print()).toBe("-1");
      expect(simplify("(-1)^(-1)^-1").print()).toBe("-1");
    });

    it("handles exponentiation of 0", () => {
      expect(simplify("0^0").print()).toBe("1");
      expect(simplify("0^1").print()).toBe("0");
      expect(simplify("0^0.5").print()).toBe("0");
      expect(simplify("0^(1/3)").print()).toBe("0");
      expect(simplify("0^(2/3)").print()).toBe("0");
      expect(simplify("0 ^ 1e100").print()).toBe("0");
    });

    it("handles exponentiation of 1", () => {
      expect(simplify("1^0").print()).toBe("1");
      expect(simplify("1^1").print()).toBe("1");
      expect(simplify("1^0.5").print()).toBe("1");
      expect(simplify("1^(1/3)").print()).toBe("1");
      expect(simplify("1^(2/3)").print()).toBe("1");
      expect(simplify("1^(-2/3)").print()).toBe("1");
      expect(simplify("1 ^ 1e100").print()).toBe("1");
    });

    it("handles exponentiation to 0th power", () => {
      expect(simplify("0.5^0").print()).toBe("1");
      expect(simplify("(1/3)^0").print()).toBe("1");
      expect(simplify("(2/3)^0").print()).toBe("1");
      expect(simplify("1e100^0").print()).toBe("1");
    });

    it("handles exponentiation to 1st power", () => {
      expect(simplify("0.5^1").print()).toBe("0.5");
      expect(simplify("2^1").print()).toBe("2");
    });

    it("handles exponentiation of -1 to an integer exponent", () => {
      expect(simplify("(-1)^0").print()).toBe("1");
      expect(simplify("(-1)^1").print()).toBe("-1");
      expect(simplify("(-1)^2").print()).toBe("1");
      expect(simplify("(-1)^3").print()).toBe("-1");
    });

    it.failing("handles exponentiation to a fractional power", () => {
      expect(simplify("4^(1/2)").print()).toBe("2");
      expect(simplify("4^0.5").print()).toBe("2");
      expect(simplify("(4x^2)^(1/2)").print()).toBe("2x");
      expect(simplify("(4x^2)^0.5").print()).toBe("2x");
    });
  });

  describe("constants", () => {
    it("handles a constant", () => {
      expect(simplify("pi").print()).toBe("pi");
      expect(simplify("e").print()).toBe("e");

      expect(simplify("1pi").print()).toBe("pi");
      expect(simplify("1e").print()).toBe("e");

      expect(simplify("3pi").print()).toBe("3pi");
      expect(simplify("3e").print()).toBe("3e");

      expect(simplify("2.5pi").print()).toBe("2.5pi");
      expect(simplify("2.5e").print()).toBe("2.5e");

      expect(simplify("+pi").print()).toBe("pi");
      expect(simplify("+e").print()).toBe("e");

      expect(simplify("-pi").print()).toBe("-pi");
      expect(simplify("-e").print()).toBe("-e");

      expect(simplify("0pi").print()).toBe("0");
      expect(simplify("0e").print()).toBe("0");
    });

    it("handles addition and subtraction of constants", () => {
      expect(simplify("pi + pi").print()).toBe("2pi");
      expect(simplify("e + e").print()).toBe("2e");
      expect(simplify("pi + 0").print()).toBe("pi");
      expect(simplify("0 + pi").print()).toBe("pi");
      expect(simplify("e + 0").print()).toBe("e");
      expect(simplify("0 + e").print()).toBe("e");

      expect(simplify("pi - pi").print()).toBe("0");
      expect(simplify("e - e").print()).toBe("0");
      expect(simplify("pi - 0").print()).toBe("pi");
      expect(simplify("0 - pi").print()).toBe("-pi");
      expect(simplify("e - 0").print()).toBe("e");
      expect(simplify("0 - e").print()).toBe("-e");

      expect(simplify("pi - pi + e").print()).toBe("e");
      expect(simplify("e - e + pi").print()).toBe("pi");

      expect(simplify("pi + e").print()).toBe("pi + e");
      expect(simplify("e + pi").print()).toBe("e + pi");
      expect(simplify("pi - e").print()).toBe("pi - e");
      expect(simplify("e - pi").print()).toBe("e - pi");
      expect(simplify("pi + 2").print()).toBe("pi + 2");
      expect(simplify("e + 2").print()).toBe("e + 2");
      expect(simplify("pi - 2").print()).toBe("pi - 2");
      expect(simplify("e - 2").print()).toBe("e - 2");
      expect(simplify("2 + e").print()).toBe("2 + e");
      expect(simplify("2 + pi").print()).toBe("2 + pi");
      expect(simplify("2 - e").print()).toBe("2 - e");
      expect(simplify("2 - pi").print()).toBe("2 - pi");

      expect(simplify("0pi + e").print()).toBe("e");
      expect(simplify("0e + pi").print()).toBe("pi");
      expect(simplify("0pi - e").print()).toBe("-e");
      expect(simplify("0e - pi").print()).toBe("-pi");

      expect(simplify("0/pi + e").print()).toBe("e");
      expect(simplify("0/e + pi").print()).toBe("pi");
      expect(simplify("0/pi - e").print()).toBe("-e");
      expect(simplify("0/e - pi").print()).toBe("-pi");

      expect(simplify("0 - (-pi)").print()).toBe("pi");
      expect(simplify("0 - (-e)").print()).toBe("e");
    });

    it("handles combination of multiplication and addition and subtraction of constants", () => {
      expect(simplify("2pi + 3pi").print()).toBe("5pi");
      expect(simplify("2pi + pi").print()).toBe("3pi");
      expect(simplify("(pi * 2) + pi").print()).toBe("3pi");
      expect(simplify("(pi * 2) + 3pi").print()).toBe("5pi");
      expect(simplify("(pi * 2) + (pi * 3)").print()).toBe("5pi");
      expect(simplify("pi + 2pi").print()).toBe("3pi");
      expect(simplify("pi + (pi * 2)").print()).toBe("3pi");
      expect(simplify("5pi - 3pi").print()).toBe("2pi");
      expect(simplify("2pi - pi").print()).toBe("pi");
      expect(simplify("pi - 2pi").print()).toBe("-pi");

      expect(simplify("2e + 3e").print()).toBe("5e");
      expect(simplify("2e + e").print()).toBe("3e");
      expect(simplify("(e * 2) + e").print()).toBe("3e");
      expect(simplify("(e * 2) + 3e").print()).toBe("5e");
      expect(simplify("(e * 2) + (e * 3)").print()).toBe("5e");
      expect(simplify("e + 2e").print()).toBe("3e");
      expect(simplify("e + (e * 2)").print()).toBe("3e");
      expect(simplify("5e - 3e").print()).toBe("2e");
      expect(simplify("2e - e").print()).toBe("e");
      expect(simplify("e - 2e").print()).toBe("-e");
    });

    it("handles combination of exponentiation and addition and subtraction of constants", () => {
      expect(simplify("0 + pi^2").print()).toBe("pi^2");
      expect(simplify("pi^2 + 0").print()).toBe("pi^2");
      expect(simplify("0 - pi^2").print()).toBe("-pi^2");
      expect(simplify("pi^2 - 0").print()).toBe("pi^2");
      expect(simplify("pi^2 + pi^2").print()).toBe("2pi^2");
    });

    it("handles multiplication of constants", () => {
      expect(simplify("2 * pi").print()).toBe("2pi");
      expect(simplify("2 * e").print()).toBe("2e");
      expect(simplify("pi * 2").print()).toBe("2pi");
      expect(simplify("e * 2").print()).toBe("2e");
      expect(simplify("0 * pi").print()).toBe("0");
      expect(simplify("0 * e").print()).toBe("0");
      expect(simplify("pi * 0").print()).toBe("0");
      expect(simplify("e * 0").print()).toBe("0");

      expect(simplify("pi * e").print()).toBe("pi * e");
      expect(simplify("e * pi").print()).toBe("e * pi");
      expect(simplify("2pi * e").print()).toBe("2pi * e");
      expect(simplify("2e * pi").print()).toBe("2e * pi");

      expect(simplify("pi * pi").print()).toBe("pi^2");
      expect(simplify("2 * pi * pi").print()).toBe("2pi^2");
      expect(simplify("2pi * 3").print()).toBe("6pi");
      expect(simplify("2 * 3pi").print()).toBe("6pi");
    });

    it("handles combination of division and multiplication of constants", () => {
      expect(simplify("1/2 * pi").print()).toBe("pi/2");
      expect(simplify("2/3 * pi").print()).toBe("2pi/3");
      expect(simplify("pi / 2 * pi").print()).toBe("pi^2/2");
      expect(simplify("pi(1/pi)").print()).toBe("1");
    });

    it("handles combination of exponentiation and multiplication of constants", () => {
      expect(simplify("pi * pi^-1").print()).toBe("1");
      expect(simplify("pi^-1 * pi").print()).toBe("1");
      expect(simplify("pi * pi^-2").print()).toBe("pi^-1");
      expect(simplify("pi^-2 * pi").print()).toBe("pi^-1");
      expect(simplify("pi^2 * pi^-2").print()).toBe("1");
      expect(simplify("pi^-2 * pi^2").print()).toBe("1");
      expect(simplify("pi^3 * pi^-2").print()).toBe("pi");
      expect(simplify("pi^-2 * pi^3").print()).toBe("pi");
      expect(simplify("pi^1.5 * pi^1.5").print()).toBe("pi^3");
      expect(simplify("pi^(-1/3) * pi^(2/3)").print()).toBe("pi^(1/3)");
      expect(simplify("(2pi)^3").print()).toBe("8pi^3");
      expect(simplify("(pi*2)^3").print()).toBe("8pi^3");
      expect(simplify("(2pi^-1)^-1").print()).toBe("pi/2");
    });

    it("handles division of constants", () => {
      expect(simplify("pi / 1").print()).toBe("pi");
      expect(simplify("e / 1").print()).toBe("e");
      expect(simplify("2pi / 1").print()).toBe("2pi");
      expect(simplify("2e / 1").print()).toBe("2e");
      expect(simplify("2pi / 2").print()).toBe("pi");
      expect(simplify("(pi * 2) / 2").print()).toBe("pi");
      expect(simplify("2e / 2").print()).toBe("e");
      expect(simplify("6pi / 2").print()).toBe("3pi");
      expect(simplify("6e / 2").print()).toBe("3e");
      expect(simplify("pi / 2").print()).toBe("pi/2");
      expect(simplify("e / 2").print()).toBe("e/2");
      expect(simplify("6pi / 9").print()).toBe("2pi/3");
      expect(simplify("6e / 9").print()).toBe("2e/3");

      expect(simplify("pi / pi").print()).toBe("1");
      expect(simplify("e / e").print()).toBe("1");
      expect(simplify("2pi / 2pi").print()).toBe("1");
      expect(simplify("2e / 2e").print()).toBe("1");
      expect(simplify("2pi / pi").print()).toBe("2");
      expect(simplify("2e / e").print()).toBe("2");
      expect(simplify("pi / 2pi").print()).toBe("1/2");
      expect(simplify("e / 2e").print()).toBe("1/2");

      expect(simplify("pi / e").print()).toBe("pi / e");
      expect(simplify("e / pi").print()).toBe("e / pi");
      expect(simplify("2pi / e").print()).toBe("2pi / e");
      expect(simplify("2e / pi").print()).toBe("2e / pi");

      expect(simplify("pi / (1/pi)").print()).toBe("pi^2");
    });

    it("handles combination of exponentiation and division of constants", () => {
      expect(simplify("pi^2 / 2").print()).toBe("pi^2/2");
      expect(simplify("2pi^2 / 2").print()).toBe("pi^2");
      expect(simplify("pi^2 / pi").print()).toBe("pi");
      expect(simplify("2pi^2 / pi").print()).toBe("2pi");
      expect(simplify("pi^3 / pi").print()).toBe("pi^2");
      expect(simplify("pi / pi^2").print()).toBe("pi^-1");
      expect(simplify("2pi / pi^2").print()).toBe("2pi^-1");
      expect(simplify("(1/pi)^-1").print()).toBe("pi");
      expect(simplify("(2/pi)^-1").print()).toBe("pi/2");
      expect(simplify("1 / pi^-1").print()).toBe("pi");
      expect(simplify("2 / pi^-1").print()).toBe("2pi");
      expect(simplify("1 / pi^-2").print()).toBe("pi^2");
      expect(simplify("2 / pi^-2").print()).toBe("2pi^2");
      expect(simplify("pi / pi^-1").print()).toBe("pi^2");
      expect(simplify("2pi / pi^-1").print()).toBe("2pi^2");
      expect(simplify("pi / pi^-2").print()).toBe("pi^3");
      expect(simplify("2pi / pi^-2").print()).toBe("2pi^3");
      expect(simplify("pi^-2 / pi^-3").print()).toBe("pi");
      expect(simplify("pi^-2 / pi").print()).toBe("pi^-3");
      expect(simplify("(pi/2)^3").print()).toBe("pi^3/8");
    });

    it("handles combination of exponentiation, division, addition and subtraction of constants", () => {
      expect(simplify("pi^-1 + 1/pi").print()).toBe("2pi^-1");
      expect(simplify("1/pi + pi^-1").print()).toBe("2pi^-1");
      expect(simplify("pi^-1 - 1/pi").print()).toBe("0");
      expect(simplify("1/pi - pi^-1").print()).toBe("0");
      expect(simplify("pi(pi / pi^2)").print()).toBe("1");
      expect(simplify("pi(2pi / pi^2)").print()).toBe("2");
    });

    it("handles exponentiation of constants", () => {
      expect(simplify("pi^0").print()).toBe("1");
      expect(simplify("e^0").print()).toBe("1");

      expect(simplify("pi^1").print()).toBe("pi");
      expect(simplify("e^1").print()).toBe("e");

      expect(simplify("pi^2").print()).toBe("pi^2");
      expect(simplify("e^2").print()).toBe("e^2");

      expect(simplify("pi^-1").print()).toBe("pi^-1");
      expect(simplify("e^-1").print()).toBe("e^-1");

      expect(simplify("pi^-2").print()).toBe("pi^-2");
      expect(simplify("e^-2").print()).toBe("e^-2");

      expect(simplify("pi^e").print()).toBe("pi^e");
      expect(simplify("e^pi").print()).toBe("e^pi");

      expect(simplify("2^e").print()).toBe("2^e");
      expect(simplify("2^pi").print()).toBe("2^pi");

      expect(simplify("pi^(1/2)").print()).toBe("pi^(1/2)");
      expect(simplify("pi^(1/2)").toString()).toBe("(pi ^ (1/2))");
      expect(simplify("pi^(2/3)").print()).toBe("pi^(2/3)");

      expect(simplify("pi^1.5").print()).toBe("pi^1.5");

      expect(simplify("(pi^2)^3").print()).toBe("pi^6");

      expect(simplify("(pi^4)^(1/2)").print()).toBe("pi^2");
    });
  });
});
