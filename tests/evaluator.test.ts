import { describe, it, expect } from "bun:test";

import type { EvaluatorOptions } from "#evaluator";
import type { ParserOptions } from "#lib/parser";
import { printNode } from "#lib/printer";
import { simplify } from "#src";

function expectUndefined(
  expression: string,
  options?: ParserOptions & EvaluatorOptions,
) {
  const simplified = simplify(expression, options);
  expect(simplified.toString()).toBe("undefined");
  const printed = printNode(simplified);
  const doubleSimplified = simplify(printed, options);
  expect(doubleSimplified.toString()).toBe("undefined");
  expect(printNode(doubleSimplified)).toBe(printed);
  return expect(printed);
}

describe("evaluate", () => {
  it("handles a number", () => {
    expect(printNode(simplify("1"))).toBe("1");
  });

  it("handles simple addition", () => {
    expect(printNode(simplify("1 + 1"))).toBe("2");
  });

  it("handles a simple positive number", () => {
    expect(printNode(simplify("+1"))).toBe("1");
    expect(printNode(simplify("+0"))).toBe("0");
  });

  it("handles simple negation", () => {
    expect(printNode(simplify("-1"))).toBe("-1");
    expect(printNode(simplify("-0"))).toBe("0");
  });

  it("handles double unary operator", () => {
    expect(printNode(simplify("--1"))).toBe("1");
    expect(printNode(simplify("-+1"))).toBe("-1");
    expect(printNode(simplify("+-1"))).toBe("-1");
    expect(printNode(simplify("++1"))).toBe("1");
  });

  it("handles simple subtraction", () => {
    expect(printNode(simplify("1 - 1"))).toBe("0");
  });

  it("handles addition and subtraction", () => {
    expect(printNode(simplify("2 + 2 - 1"))).toBe("3");
    expect(printNode(simplify("2 - 1 + 2"))).toBe("3");
    expect(printNode(simplify("5 - 1 - 2"))).toBe("2");
  });

  it("handles simple multiplication", () => {
    expect(printNode(simplify("3 * 4"))).toBe("12");
  });

  describe("operation precedence order", () => {
    it("handles operator precedence order", () => {
      expect(printNode(simplify("1 + 2 * 3"))).toBe("7");
      expect(printNode(simplify("2 * 3 + 1"))).toBe("7");
      expect(printNode(simplify("10 - 2 * 4"))).toBe("2");
      expect(printNode(simplify("10 * 2 - 4"))).toBe("16");
    });

    it("handles precedence order of implicit multiplication", () => {
      expect(printNode(simplify("2 + 2(1 + 1)"))).toBe("6");
      expect(printNode(simplify("8 - 2(1 + 2)"))).toBe("2");
      expect(printNode(simplify("2 * 2(1 + 2)"))).toBe("12");
      expect(printNode(simplify("6 / 2(1 + 2)"))).toBe("1");
      expect(printNode(simplify("1 + 5 % 3"))).toBe("3");
    });

    it("handles order of exponentiation", () => {
      expect(printNode(simplify("2^2^3"))).toBe("256");
      expect(printNode(simplify("2^3^2"))).toBe("512");
      expect(printNode(simplify("-2^2"))).toBe("-4");
      expect(printNode(simplify("-2^2^3"))).toBe("-256");
      expect(printNode(simplify("(2^3)^2"))).toBe("64");
      expect(printNode(simplify("2^(3^2)"))).toBe("512");
    });

    it("handles order of implicit multiplication with exponentiation", () => {
      expect(printNode(simplify("2 ^ 3(1+2)"))).toBe("512");
      expect(printNode(simplify("2 ^ 2(2)"))).toBe("16");
      expect(printNode(simplify("2(1+2)^3"))).toBe("54");
      expect(printNode(simplify("2(2)^2"))).toBe("8");
    });
  });

  it("handles unary operators with multiplication", () => {
    expect(printNode(simplify("-2 * 3"))).toBe("-6");
    expect(printNode(simplify("2 * -3"))).toBe("-6");
    expect(printNode(simplify("-2 * -3"))).toBe("6");
  });

  it("handles parentheses", () => {
    expect(printNode(simplify("(1 + 2) * 3"))).toBe("9");
    expect(printNode(simplify("2 * (3 + 4)"))).toBe("14");
  });

  it("handles nested parentheses", () => {
    expect(printNode(simplify("((1 + 1) * 2) + 1"))).toBe("5");
  });

  it("handles unary operators with parentheses", () => {
    expect(printNode(simplify("-(1 + 1)"))).toBe("-2");
  });

  it("handles implicit multiplication", () => {
    expect(printNode(simplify("2(2)"))).toBe("4");
    expect(printNode(simplify("(2)2"))).toBe("4");
    expect(printNode(simplify("(2)(2)"))).toBe("4");
    expect(printNode(simplify("2(3+4)"))).toBe("14");
    expect(printNode(simplify("(1+2)(3+4)"))).toBe("21");
  });

  describe("decimals", () => {
    it("handles a decimal", () => {
      expect(printNode(simplify("0.1"))).toBe("0.1");
      expect(printNode(simplify("0.01"))).toBe("0.01");
    });

    it("handles a negative decimal", () => {
      expect(printNode(simplify("-0.1"))).toBe("-0.1");
      expect(printNode(simplify("-0.01"))).toBe("-0.01");
    });

    it("handles a decimal with implicit whole part", () => {
      expect(printNode(simplify(".1"))).toBe("0.1");
      expect(printNode(simplify(".01"))).toBe("0.01");
    });

    it("handles a decimal with implicit decimal part", () => {
      expect(printNode(simplify("1."))).toBe("1");
      expect(printNode(simplify("0."))).toBe("0");
      expect(printNode(simplify("10."))).toBe("10");
    });

    it("handles a decimal with leading 0s", () => {
      expect(printNode(simplify("0.0"))).toBe("0");
      expect(printNode(simplify("0.00"))).toBe("0");
      expect(printNode(simplify("00.0"))).toBe("0");
      expect(printNode(simplify("00.00"))).toBe("0");
      expect(printNode(simplify("1.0"))).toBe("1");
      expect(printNode(simplify("1.00"))).toBe("1");
      expect(printNode(simplify("01.0"))).toBe("1");
      expect(printNode(simplify("01.00"))).toBe("1");

      expect(printNode(simplify("0e0"))).toBe("0");
      expect(printNode(simplify("0e1"))).toBe("0");
      expect(printNode(simplify("0e-1"))).toBe("0");
      expect(printNode(simplify("0.0e0"))).toBe("0");
      expect(printNode(simplify("0.0e1"))).toBe("0");
      expect(printNode(simplify("0.0e-1"))).toBe("0");
      expect(printNode(simplify("1e0"))).toBe("1");
      expect(printNode(simplify("1.0e0"))).toBe("1");
    });

    it("handles addition of 2 decimals", () => {
      expect(printNode(simplify("0.1 + 0.1"))).toBe("0.2");
      expect(printNode(simplify("0.1 + 0.2"))).toBe("0.3");
      expect(printNode(simplify("0.1 + 0.01"))).toBe("0.11");
    });

    it("handles addition of a whole number with a decimal", () => {
      expect(printNode(simplify("1 + 0.2"))).toBe("1.2");
      expect(printNode(simplify("0.3 + 2"))).toBe("2.3");
    });

    it("handles multiplication of 2 decimals", () => {
      expect(printNode(simplify("0.5 * 0.5"))).toBe("0.25");
      expect(printNode(simplify("0.1 * 0.2"))).toBe("0.02");
    });

    it("handles multiplication of a whole number with a decimal", () => {
      expect(printNode(simplify("2 * 0.5"))).toBe("1");
      expect(printNode(simplify("0.3 * 7"))).toBe("2.1");
    });

    it("handles division of decimals", () => {
      expect(printNode(simplify("0.25 / 2"))).toBe("1/8");
      expect(printNode(simplify("0.005 / 0.2"))).toBe("1/40");
    });
  });

  it("handles scientific notation", () => {
    expect(printNode(simplify("1e0"))).toBe("1");
    expect(printNode(simplify("1e2"))).toBe("100");
    expect(printNode(simplify("1e-2"))).toBe("0.01");
    expect(printNode(simplify("1.2e3"))).toBe("1200");
    expect(printNode(simplify("1.2e-3"))).toBe("0.0012");
    expect(printNode(simplify("-1.2e3"))).toBe("-1200");
    expect(printNode(simplify("-1.2e-3"))).toBe("-0.0012");
  });

  describe("large numbers", () => {
    it("handles exponentiation of large numbers to a fractional power", () => {
      expect(printNode(simplify("sqrt(10 ^ 10^10)"))).toBe("10^5000000000");
      expect(printNode(simplify("(10^1e10)^1e-9"))).toBe("10000000000");
      expect(printNode(simplify("(10^1e10)^1e-10"))).toBe("10");
    });

    it("handles further operations with large numbers", () => {
      expect(printNode(simplify("0 * (10^1e10)"))).toBe("0");
      expect(printNode(simplify("-10^10^10"))).toBe("-10^10000000000");
      expect(printNode(simplify("abs(10^10^10)"))).toBe("10^10000000000");
      expect(printNode(simplify("ceil(10^10^10)"))).toBe("10^10000000000");
      expect(printNode(simplify("floor(10^10^10)"))).toBe("10^10000000000");
      expect(printNode(simplify("(10^10^10) + 1"))).toBe("10^10000000000 + 1");
      expect(printNode(simplify("(10^10^10) ^ 10"))).toBe("10^100000000000");
      expect(printNode(simplify("10 ^ (10^10^10)"))).toBe("10^10^10000000000");
      expect(printNode(simplify("10^10^10^10 % 9^9^9^9"))).toBe(
        "10^10^10000000000 % 9^9^387420489",
      );
    });

    it("handles exponentiation to a large exponent", () => {
      expect(printNode(simplify("2 ^ (5^10)"))).toBe("2^9765625");
      expect(printNode(simplify("5 ^ (5^10)"))).toBe("5^9765625");
      expect(printNode(simplify("10 ^ (10^10)"))).toBe("10^10000000000");

      expect(printNode(simplify("(10^2e4)^10"))).toBe("10^200000");
      expect(printNode(simplify("(10^1e5)^2"))).toBe("10^200000");
      expect(printNode(simplify("(10^2e5)"))).toBe("10^200000");
      expect(printNode(simplify("(10^5e4)^10"))).toBe("10^500000");
      expect(printNode(simplify("(10^2e5)^2"))).toBe("10^400000");
      expect(printNode(simplify("(10^2e5)^10"))).toBe("10^2000000");
      expect(printNode(simplify("(10^2e5)^1e3"))).toBe("10^200000000");

      expect(printNode(simplify("2.5 ^ (5^10)"))).toBe("2.5^9765625");

      expect(printNode(simplify("(1/10) ^ (5^10)"))).toBe("(1/10)^9765625");

      expect(printNode(simplify("2.5 ^ ((-5) ^ 9)"))).toBe("2.5^-1953125");
    });

    it("handles large decimals", () => {
      expect(printNode(simplify("1e1000000"))).toBe("1e1000000");
      expect(printNode(simplify("1e1000000 + 1"))).toBe("1e1000000 + 1");
      expect(printNode(simplify("1e1000000 + x + 1 + 2e1000000"))).toBe(
        "3e1000000 + x + 1",
      );
      expect(printNode(simplify("1/3 + 1e1000000"))).toBe("1/3 + 1e1000000");
      expect(printNode(simplify("1e1000000 / 3"))).toBe("1e1000000 / 3");
      expect(printNode(simplify("(1/3) * 1e1000000"))).toBe("1/3 * 1e1000000");
      expect(printNode(simplify("(1e1000000)^(1/3)"))).toBe("1e1000000^(1/3)");
    });

    it("handles operations with large decimals", () => {
      expect(printNode(simplify("1e1000000 + 2e1000000"))).toBe("3e1000000");
      expect(printNode(simplify("1e1000000 - 1e1000000"))).toBe("0");
      expect(printNode(simplify("1e1000000 * 3"))).toBe("3e1000000");
      expect(printNode(simplify("1e1000000 / 2e999999"))).toBe("5");
      expect(printNode(simplify("1e-1000000 / 2e-1000000"))).toBe("1/2");
      expect(printNode(simplify("(1e1000000)^2"))).toBe("1e2000000");
      expect(printNode(simplify("(1e1000000)^(-2)"))).toBe("1e-2000000");

      expect(printNode(simplify("floor(1e1000000)"))).toBe("1e1000000");
      expect(printNode(simplify("floor(1e-1000000)"))).toBe("0");
      expect(printNode(simplify("ceil(1e-1000000)"))).toBe("1");
      expect(printNode(simplify("floor(-1e-1000000)"))).toBe("-1");
      expect(printNode(simplify("ceil(-1e-1000000)"))).toBe("0");

      expectUndefined("(-4)^(1e-1000000)").toMatchInlineSnapshot(
        `"(-4)^1e-1000000"`,
      );
    });
  });

  describe("division", () => {
    it("handles simple division", () => {
      expect(printNode(simplify("12 / 4"))).toBe("3");
      expect(printNode(simplify("12 / 3"))).toBe("4");
    });

    it("handles fractions", () => {
      expect(printNode(simplify("1/1"))).toBe("1");
      expect(printNode(simplify("1/2"))).toBe("1/2");
      expect(simplify("1/2").toString()).toBe("(1/2)");
      expect(printNode(simplify("1/3"))).toBe("1/3");
      expect(printNode(simplify("1/2 + 1/3"))).toBe("5/6");
      expect(printNode(simplify("1/2 - 1/3"))).toBe("1/6");
      expect(printNode(simplify("1/2 + 0.5"))).toBe("1");
      expect(printNode(simplify("1/2 + 2e5"))).toBe("400001/2");
      expect(printNode(simplify("(1/3)(1/2)"))).toBe("1/6");
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
      expectUndefined("1 / (0 * pi^2)").toMatchInlineSnapshot(`"1 / 0"`);
    });

    it("handles division of 0", () => {
      expect(printNode(simplify("0/1"))).toBe("0");
      expect(printNode(simplify("0/2"))).toBe("0");
      expect(printNode(simplify("0/-2"))).toBe("0");
    });

    it("handles double negatives", () => {
      expect(printNode(simplify("-(1/-1)"))).toBe("1");
      expect(printNode(simplify("0 - (1/-1)"))).toBe("1");
      expect(printNode(simplify("-1 - (2/-1)"))).toBe("1");
    });
  });

  describe("modulo", () => {
    it("handles simple modulo", () => {
      expect(printNode(simplify("5 % 3"))).toBe("2");
      expect(printNode(simplify("10 % 3"))).toBe("1");
      expect(printNode(simplify("-25 % 7"))).toBe("3");
      expect(printNode(simplify("-25 % -7"))).toBe("-4");
      expect(printNode(simplify("25 % -7"))).toBe("-3");
    });

    it("handles modulo with decimals", () => {
      expect(printNode(simplify("2.5 % 2"))).toBe("0.5");
      expect(printNode(simplify("9.5 % 2.5"))).toBe("2");
      expect(printNode(simplify("9 % 2.5"))).toBe("1.5");
    });

    it("handles modulo with fractions", () => {
      expect(printNode(simplify("(5/6) % (2/7)"))).toBe("11/42");
    });

    it("handles modulo with constants", () => {
      expect(printNode(simplify("0 % e"))).toBe("0");
      expect(printNode(simplify("0 % pi"))).toBe("0");
      expect(printNode(simplify("pi % e"))).toBe("pi % e");
      expect(printNode(simplify("e % pi"))).toBe("e % pi");
      expect(printNode(simplify("e^pi % 7"))).toBe("e^pi % 7");
      expect(printNode(simplify("e^3 % 7"))).toBe("e^3 % 7");
    });

    it("handles modulo with large numbers", () => {
      expect(printNode(simplify("1e1000000 % 3"))).toBe("1");
      expect(printNode(simplify("1e1000000 % 7"))).toBe("4");
      expect(printNode(simplify("1e1000000 % 11"))).toBe("1");

      expect(printNode(simplify("7^77777 % 5"))).toBe("2");

      expect(printNode(simplify("(3e100000)^100000 % 13"))).toBe("9");
    });
  });

  describe("exponentiation", () => {
    it("handles simple exponentiation", () => {
      expect(printNode(simplify("2^5"))).toBe("32");
      expect(printNode(simplify("3^3"))).toBe("27");
    });

    it("handles negative exponentiation", () => {
      expect(printNode(simplify("2^-1"))).toBe("1/2");
      expect(printNode(simplify("2^-2"))).toBe("1/4");
      expect(printNode(simplify("-1^-1^-1"))).toBe("-1");
    });

    it("handles exponentiation of fractions", () => {
      expect(printNode(simplify("(2/3)^3"))).toBe("8/27");
    });

    it("handles exponentiation of decimals", () => {
      expect(printNode(simplify("1.5^2"))).toBe("2.25");
    });

    it("handles exponentiation with parantheses", () => {
      expect(printNode(simplify("(1)^1"))).toBe("1");
      expect(printNode(simplify("1^(1)"))).toBe("1");
      expect(printNode(simplify("(1)^(1)"))).toBe("1");
      expect(printNode(simplify("(-1)^1"))).toBe("-1");
      expect(printNode(simplify("1^(-1)"))).toBe("1");
      expect(printNode(simplify("(-1)^(-1)"))).toBe("-1");
      expect(printNode(simplify("(-1)^(-1)^(-1)"))).toBe("-1");
      expect(printNode(simplify("(-1)^-1^(-1)"))).toBe("-1");
      expect(printNode(simplify("(-1)^(-1)^-1"))).toBe("-1");
    });

    it("handles exponentiation of 0", () => {
      expect(printNode(simplify("0^0"))).toBe("1");
      expect(printNode(simplify("0^1"))).toBe("0");
      expect(printNode(simplify("0^0.5"))).toBe("0");
      expect(printNode(simplify("0^(1/3)"))).toBe("0");
      expect(printNode(simplify("0^(2/3)"))).toBe("0");
      expect(printNode(simplify("0 ^ 1e100"))).toBe("0");
    });

    it("handles exponentiation of 1", () => {
      expect(printNode(simplify("1^0"))).toBe("1");
      expect(printNode(simplify("1^1"))).toBe("1");
      expect(printNode(simplify("1^0.5"))).toBe("1");
      expect(printNode(simplify("1^(1/3)"))).toBe("1");
      expect(printNode(simplify("1^(2/3)"))).toBe("1");
      expect(printNode(simplify("1^(-2/3)"))).toBe("1");
      expect(printNode(simplify("1 ^ 1e100"))).toBe("1");
      expect(printNode(simplify("1 ^ (10^1e10)"))).toBe("1");
    });

    it("handles exponentiation to 0th power", () => {
      expect(printNode(simplify("0.5^0"))).toBe("1");
      expect(printNode(simplify("(1/3)^0"))).toBe("1");
      expect(printNode(simplify("(2/3)^0"))).toBe("1");
      expect(printNode(simplify("1e100^0"))).toBe("1");
      expect(printNode(simplify("(10^1e10)^0"))).toBe("1");
    });

    it("handles exponentiation to 1st power", () => {
      expect(printNode(simplify("0.5^1"))).toBe("0.5");
      expect(printNode(simplify("2^1"))).toBe("2");
    });

    it("handles exponentiation of -1 to an integer exponent", () => {
      expect(printNode(simplify("(-1)^0"))).toBe("1");
      expect(printNode(simplify("(-1)^1"))).toBe("-1");
      expect(printNode(simplify("(-1)^2"))).toBe("1");
      expect(printNode(simplify("(-1)^3"))).toBe("-1");
    });

    it("handles combination of exponentiation to a fractional power, multiplication and division", () => {
      expect(printNode(simplify("5 ^ 2.5 * 5 ^ 0.5"))).toBe("125");
      expect(printNode(simplify("5 ^ 2.5 / 5 ^ 0.5"))).toBe("25");
      expect(printNode(simplify("(2 * 2^0.5) ^ (-2)^2"))).toBe("64");
    });

    it("handles exponentiation to a fractional power", () => {
      expect(printNode(simplify("4^(1/2)"))).toBe("2");
      expect(printNode(simplify("4^0.5"))).toBe("2");

      expect(printNode(simplify("(4pi^2)^(1/2)"))).toBe("2pi");
      expect(printNode(simplify("(4pi^2)^0.5"))).toBe("2pi");

      expect(printNode(simplify("sqrt(0)"))).toBe("0");
      expect(printNode(simplify("sqrt(1)"))).toBe("1");
      expect(printNode(simplify("sqrt(16)"))).toBe("4");

      expect(printNode(simplify("8^(1/3)"))).toBe("2");
      expect(printNode(simplify("8^(2/3)"))).toBe("4");
      expect(printNode(simplify("32^0.2"))).toBe("2");
      expect(printNode(simplify("343^(1/3)"))).toBe("7");
      expect(printNode(simplify("216^(4/3)"))).toBe("1296");

      expect(printNode(simplify("8^(-1/3)"))).toBe("1/2");
      expect(printNode(simplify("8^(-2/3)"))).toBe("1/4");
      expect(printNode(simplify("32^-0.2"))).toBe("1/2");

      expect(printNode(simplify("(-8)^(1/3)"))).toBe("-2");
      expect(printNode(simplify("(-8)^(2/3)"))).toBe("4");
      expect(printNode(simplify("(-32)^0.2"))).toBe("-2");
      expect(printNode(simplify("(-343)^(1/3)"))).toBe("-7");
      expect(printNode(simplify("(-216)^(4/3)"))).toBe("1296");
      expect(printNode(simplify("(-1e-101)^(1/101)"))).toBe("-1/10");

      expect(printNode(simplify("sqrt(24) * sqrt(6)"))).toBe("12");
      expect(printNode(simplify("sqrt(24) / sqrt(6)"))).toBe("2");

      expect(printNode(simplify("(-2)^(1/3) * (-4)^(1/3)"))).toBe("2");

      expect(printNode(simplify("sqrt(4x)"))).toBe("2x^(1/2)");

      expect(printNode(simplify("sqrt(2a * 2b)"))).toBe("2 * (a * b)^(1/2)");
    });

    it("handles exponentiation of fractions to a fractional power", () => {
      expect(printNode(simplify("sqrt(4/9)"))).toBe("2/3");
      expect(printNode(simplify("(4/9)^(-1/2)"))).toBe("3/2");
      expect(printNode(simplify("(8/27)^(1/3)"))).toBe("2/3");
      expect(printNode(simplify("(-8/27)^(1/3)"))).toBe("-2/3");
    });

    it("handles exponentiation of decimals to a fractional power", () => {
      expect(printNode(simplify("sqrt(0.25)"))).toBe("1/2");
    });

    it("handles exponentiation of negatives to a fractional power", () => {
      expectUndefined("sqrt(-1)").toMatchInlineSnapshot(`"(-1)^(1/2)"`);
      expectUndefined("sqrt(-1) * sqrt(-1)").toMatchInlineSnapshot(
        `"(-1)^(1/2) * (-1)^(1/2)"`,
      );
      expectUndefined("sqrt(-1)^2").toMatchInlineSnapshot(`"((-1)^(1/2))^2"`);
      expectUndefined("sqrt(-1)^3").toMatchInlineSnapshot(`"((-1)^(1/2))^3"`);
      expectUndefined("sqrt(-1) * sqrt(-1)^3").toMatchInlineSnapshot(
        `"(-1)^(1/2) * ((-1)^(1/2))^3"`,
      );
      expectUndefined("sqrt(-1)^4").toMatchInlineSnapshot(`"((-1)^(1/2))^4"`);
      expectUndefined("(-1)^(-1/2)").toMatchInlineSnapshot(`"(-1)^(-1/2)"`);
      expectUndefined("abs(sqrt(-1))").toMatchInlineSnapshot(
        `"abs((-1)^(1/2))"`,
      );
      expectUndefined("sqrt(sqrt(-1))").toMatchInlineSnapshot(
        `"sqrt((-1)^(1/2))"`,
      );
      expectUndefined("sqrt(x)", {
        constants: new Map([["x", "negative"]]),
      }).toMatchInlineSnapshot(`"x^(1/2)"`);
    });
  });

  describe("constants", () => {
    it("handles a constant", () => {
      expect(printNode(simplify("pi"))).toBe("pi");
      expect(printNode(simplify("e"))).toBe("e");

      expect(printNode(simplify("1pi"))).toBe("pi");
      expect(printNode(simplify("1e"))).toBe("e");

      expect(printNode(simplify("3pi"))).toBe("3pi");
      expect(printNode(simplify("3e"))).toBe("3e");

      expect(printNode(simplify("2.5pi"))).toBe("2.5pi");
      expect(printNode(simplify("2.5e"))).toBe("2.5e");

      expect(printNode(simplify("+pi"))).toBe("pi");
      expect(printNode(simplify("+e"))).toBe("e");

      expect(printNode(simplify("-pi"))).toBe("-pi");
      expect(printNode(simplify("-e"))).toBe("-e");

      expect(printNode(simplify("0pi"))).toBe("0");
      expect(printNode(simplify("0e"))).toBe("0");

      expect(printNode(simplify("0pi^2"))).toBe("0");
      expect(printNode(simplify("0e^2"))).toBe("0");

      expect(printNode(simplify("0pi^-1"))).toBe("0");
      expect(printNode(simplify("0e^-1"))).toBe("0");
    });

    it("handles addition and subtraction of constants", () => {
      expect(printNode(simplify("pi + pi"))).toBe("2pi");
      expect(printNode(simplify("e + e"))).toBe("2e");
      expect(printNode(simplify("pi + 0"))).toBe("pi");
      expect(printNode(simplify("0 + pi"))).toBe("pi");
      expect(printNode(simplify("e + 0"))).toBe("e");
      expect(printNode(simplify("0 + e"))).toBe("e");

      expect(printNode(simplify("pi - pi"))).toBe("0");
      expect(printNode(simplify("e - e"))).toBe("0");
      expect(printNode(simplify("pi - 0"))).toBe("pi");
      expect(printNode(simplify("0 - pi"))).toBe("-pi");
      expect(printNode(simplify("e - 0"))).toBe("e");
      expect(printNode(simplify("0 - e"))).toBe("-e");

      expect(printNode(simplify("pi + e"))).toBe("pi + e");
      expect(printNode(simplify("e + pi"))).toBe("e + pi");
      expect(printNode(simplify("pi - e"))).toBe("pi - e");
      expect(printNode(simplify("e - pi"))).toBe("e - pi");
      expect(printNode(simplify("pi + 2"))).toBe("pi + 2");
      expect(printNode(simplify("e + 2"))).toBe("e + 2");
      expect(printNode(simplify("pi - 2"))).toBe("pi - 2");
      expect(printNode(simplify("e - 2"))).toBe("e - 2");
      expect(printNode(simplify("2 + e"))).toBe("2 + e");
      expect(printNode(simplify("2 + pi"))).toBe("2 + pi");
      expect(printNode(simplify("2 - e"))).toBe("2 - e");
      expect(printNode(simplify("2 - pi"))).toBe("2 - pi");

      expect(printNode(simplify("pi - (-e)"))).toBe("pi + e");
      expect(printNode(simplify("e - (-pi)"))).toBe("e + pi");

      expect(printNode(simplify("pi - pi + e"))).toBe("e");
      expect(printNode(simplify("e - e + pi"))).toBe("pi");

      expect(printNode(simplify("e + (pi - pi)"))).toBe("e");
      expect(printNode(simplify("pi + (e - e)"))).toBe("pi");

      expect(printNode(simplify("e + pi - pi"))).toBe("e");
      expect(printNode(simplify("e - pi + pi"))).toBe("e");
      expect(printNode(simplify("(e - pi) - (e - pi)"))).toBe("0");

      expect(printNode(simplify("e + pi + e"))).toBe("2e + pi");
      expect(printNode(simplify("e - pi + e"))).toBe("2e - pi");

      expect(printNode(simplify("2 + pi + 3"))).toBe("5 + pi");
      expect(printNode(simplify("1/2 + pi + 0.5"))).toBe("1 + pi");
      expect(printNode(simplify("2 + pi - 3"))).toBe("-1 + pi");

      expect(printNode(simplify("0pi + e"))).toBe("e");
      expect(printNode(simplify("0e + pi"))).toBe("pi");
      expect(printNode(simplify("0pi - e"))).toBe("-e");
      expect(printNode(simplify("0e - pi"))).toBe("-pi");

      expect(printNode(simplify("0/pi + e"))).toBe("e");
      expect(printNode(simplify("0/e + pi"))).toBe("pi");
      expect(printNode(simplify("0/pi - e"))).toBe("-e");
      expect(printNode(simplify("0/e - pi"))).toBe("-pi");

      expect(printNode(simplify("0 - (-pi)"))).toBe("pi");
      expect(printNode(simplify("0 - (-e)"))).toBe("e");
    });

    it("handles combination of multiplication, addition and subtraction of constants", () => {
      expect(printNode(simplify("2pi + 3pi"))).toBe("5pi");
      expect(printNode(simplify("2pi + pi"))).toBe("3pi");
      expect(printNode(simplify("(pi * 2) + pi"))).toBe("3pi");
      expect(printNode(simplify("(pi * 2) + 3pi"))).toBe("5pi");
      expect(printNode(simplify("(pi * 2) + (pi * 3)"))).toBe("5pi");
      expect(printNode(simplify("pi + 2pi"))).toBe("3pi");
      expect(printNode(simplify("pi + (pi * 2)"))).toBe("3pi");
      expect(printNode(simplify("5pi - 3pi"))).toBe("2pi");
      expect(printNode(simplify("2pi - pi"))).toBe("pi");
      expect(printNode(simplify("pi - 2pi"))).toBe("-pi");

      expect(printNode(simplify("2e + 3e"))).toBe("5e");
      expect(printNode(simplify("2e + e"))).toBe("3e");
      expect(printNode(simplify("(e * 2) + e"))).toBe("3e");
      expect(printNode(simplify("(e * 2) + 3e"))).toBe("5e");
      expect(printNode(simplify("(e * 2) + (e * 3)"))).toBe("5e");
      expect(printNode(simplify("e + 2e"))).toBe("3e");
      expect(printNode(simplify("e + (e * 2)"))).toBe("3e");
      expect(printNode(simplify("5e - 3e"))).toBe("2e");
      expect(printNode(simplify("2e - e"))).toBe("e");
      expect(printNode(simplify("e - 2e"))).toBe("-e");

      expect(printNode(simplify("e * pi - e * pi"))).toBe("0");
      expect(printNode(simplify("e * pi - pi * e"))).toBe("0");

      expect(printNode(simplify("(2 * (pi + 1)) * 3pi"))).toBe(
        "6 * (pi + 1) * pi",
      );

      expect(printNode(simplify("-(-pi - 1)"))).toBe("pi + 1");
    });

    it("handles combination of exponentiation, addition and subtraction of constants", () => {
      expect(printNode(simplify("0 + pi^2"))).toBe("pi^2");
      expect(printNode(simplify("pi^2 + 0"))).toBe("pi^2");
      expect(printNode(simplify("0 - pi^2"))).toBe("-pi^2");
      expect(printNode(simplify("pi^2 - 0"))).toBe("pi^2");
      expect(printNode(simplify("pi^2 + pi^2"))).toBe("2pi^2");
    });

    it("handles multiplication of constants", () => {
      expect(printNode(simplify("2 * pi"))).toBe("2pi");
      expect(printNode(simplify("2 * e"))).toBe("2e");
      expect(printNode(simplify("pi * 2"))).toBe("2pi");
      expect(printNode(simplify("e * 2"))).toBe("2e");
      expect(printNode(simplify("0 * pi"))).toBe("0");
      expect(printNode(simplify("0 * e"))).toBe("0");
      expect(printNode(simplify("pi * 0"))).toBe("0");
      expect(printNode(simplify("e * 0"))).toBe("0");

      expect(printNode(simplify("pi * e"))).toBe("pi * e");
      expect(printNode(simplify("e * pi"))).toBe("e * pi");
      expect(printNode(simplify("2pi * e"))).toBe("2pi * e");
      expect(printNode(simplify("2e * pi"))).toBe("2e * pi");

      expect(printNode(simplify("pi * pi"))).toBe("pi^2");
      expect(printNode(simplify("2 * pi * pi"))).toBe("2pi^2");
      expect(printNode(simplify("2pi * 3"))).toBe("6pi");
      expect(printNode(simplify("2 * 3pi"))).toBe("6pi");

      expect(printNode(simplify("2e * 3pi"))).toBe("6e * pi");

      expect(printNode(simplify("e * pi * e"))).toBe("e^2 * pi");
      expect(printNode(simplify("e * (e * pi)"))).toBe("e^2 * pi");
      expect(printNode(simplify("e * (pi * e)"))).toBe("e^2 * pi");
    });

    it("handles combination of division and multiplication of constants", () => {
      expect(printNode(simplify("1/2 * pi"))).toBe("pi/2");
      expect(printNode(simplify("-1/2 * pi"))).toBe("-pi/2");
      expect(printNode(simplify("2/3 * pi"))).toBe("2pi/3");
      expect(printNode(simplify("pi / 2 * pi"))).toBe("pi^2/2");
      expect(printNode(simplify("pi(1/pi)"))).toBe("1");

      expect(printNode(simplify("e * pi / pi"))).toBe("e");
      expect(printNode(simplify("e / pi * pi"))).toBe("e");
      expect(printNode(simplify("(e / pi) / (e / pi)"))).toBe("1");
      expect(printNode(simplify("(2e / pi) / (2e / pi)"))).toBe("1");
      expect(printNode(simplify("(2e / pi) / (e / 2pi)"))).toBe("4");
      expect(printNode(simplify("(e * pi) / (e * pi)"))).toBe("1");
      expect(printNode(simplify("(2e * pi) / (2e * pi)"))).toBe("1");
      expect(printNode(simplify("(2e * pi) / (e * 2pi)"))).toBe("1");
      expect(printNode(simplify("(2e * pi) / (2e * pi)"))).toBe("1");
      expect(printNode(simplify("(2e * pi) / (e * 2pi)"))).toBe("1");
      expect(printNode(simplify("(e / pi) * (pi / e)"))).toBe("1");
      expect(printNode(simplify("(2e / pi) * (2pi / e)"))).toBe("4");
      expect(printNode(simplify("(2e / pi) * (pi / 2e)"))).toBe("1");

      expect(printNode(simplify("0 / -pi"))).toBe("0");
      expect(printNode(simplify("0 / 2pi"))).toBe("0");
      expect(printNode(simplify("0 / (pi / 2)"))).toBe("0");
    });

    it("handles combination of exponentiation and multiplication of constants", () => {
      expect(printNode(simplify("pi * pi^-1"))).toBe("1");
      expect(printNode(simplify("pi^-1 * pi"))).toBe("1");
      expect(printNode(simplify("pi * pi^-2"))).toBe("pi^-1");
      expect(printNode(simplify("pi^-2 * pi"))).toBe("pi^-1");
      expect(printNode(simplify("pi^2 * pi^-2"))).toBe("1");
      expect(printNode(simplify("pi^-2 * pi^2"))).toBe("1");
      expect(printNode(simplify("pi^3 * pi^-2"))).toBe("pi");
      expect(printNode(simplify("pi^-2 * pi^3"))).toBe("pi");
      expect(printNode(simplify("pi^1.5 * pi^1.5"))).toBe("pi^3");
      expect(printNode(simplify("pi^(-1/3) * pi^(2/3)"))).toBe("pi^(1/3)");
      expect(printNode(simplify("(2pi)^3"))).toBe("8pi^3");
      expect(printNode(simplify("(pi*2)^3"))).toBe("8pi^3");
      expect(printNode(simplify("(2pi^-1)^-1"))).toBe("pi/2");
      expect(printNode(simplify("2pi * 2^(-1/2)"))).toBe("2^(1/2) * pi");
    });

    it("handles division of constants", () => {
      expect(printNode(simplify("0/pi"))).toBe("0");
      expect(printNode(simplify("0/e"))).toBe("0");

      expect(printNode(simplify("pi / 1"))).toBe("pi");
      expect(printNode(simplify("e / 1"))).toBe("e");
      expect(printNode(simplify("2pi / 1"))).toBe("2pi");
      expect(printNode(simplify("2e / 1"))).toBe("2e");
      expect(printNode(simplify("2pi / 2"))).toBe("pi");
      expect(printNode(simplify("(pi * 2) / 2"))).toBe("pi");
      expect(printNode(simplify("2e / 2"))).toBe("e");
      expect(printNode(simplify("6pi / 2"))).toBe("3pi");
      expect(printNode(simplify("6e / 2"))).toBe("3e");
      expect(printNode(simplify("pi / 2"))).toBe("pi/2");
      expect(printNode(simplify("e / 2"))).toBe("e/2");
      expect(printNode(simplify("6pi / 9"))).toBe("2pi/3");
      expect(printNode(simplify("6e / 9"))).toBe("2e/3");

      expect(printNode(simplify("pi / pi"))).toBe("1");
      expect(printNode(simplify("e / e"))).toBe("1");
      expect(printNode(simplify("2pi / 2pi"))).toBe("1");
      expect(printNode(simplify("2e / 2e"))).toBe("1");
      expect(printNode(simplify("2pi / pi"))).toBe("2");
      expect(printNode(simplify("2e / e"))).toBe("2");
      expect(printNode(simplify("pi / 2pi"))).toBe("1/2");
      expect(printNode(simplify("e / 2e"))).toBe("1/2");

      expect(printNode(simplify("pi / e"))).toBe("pi / e");
      expect(printNode(simplify("e / pi"))).toBe("e / pi");
      expect(printNode(simplify("2pi / e"))).toBe("2pi / e");
      expect(printNode(simplify("2e / pi"))).toBe("2e / pi");

      expect(printNode(simplify("pi / (1/pi)"))).toBe("pi^2");
    });

    it("handles combination of exponentiation and division of constants", () => {
      expect(printNode(simplify("pi^2 / 2"))).toBe("pi^2/2");
      expect(printNode(simplify("2pi^2 / 2"))).toBe("pi^2");
      expect(printNode(simplify("pi^2 / pi"))).toBe("pi");
      expect(printNode(simplify("2pi^2 / pi"))).toBe("2pi");
      expect(printNode(simplify("pi^3 / pi"))).toBe("pi^2");
      expect(printNode(simplify("pi / pi^2"))).toBe("pi^-1");
      expect(printNode(simplify("2pi / pi^2"))).toBe("2pi^-1");
      expect(printNode(simplify("(1/pi)^-1"))).toBe("pi");
      expect(printNode(simplify("(2/pi)^-1"))).toBe("pi/2");
      expect(printNode(simplify("1 / pi^-1"))).toBe("pi");
      expect(printNode(simplify("2 / pi^-1"))).toBe("2pi");
      expect(printNode(simplify("1 / pi^-2"))).toBe("pi^2");
      expect(printNode(simplify("2 / pi^-2"))).toBe("2pi^2");
      expect(printNode(simplify("pi / pi^-1"))).toBe("pi^2");
      expect(printNode(simplify("2pi / pi^-1"))).toBe("2pi^2");
      expect(printNode(simplify("pi / pi^-2"))).toBe("pi^3");
      expect(printNode(simplify("2pi / pi^-2"))).toBe("2pi^3");
      expect(printNode(simplify("pi^-2 / pi^-3"))).toBe("pi");
      expect(printNode(simplify("pi^-2 / pi"))).toBe("pi^-3");
      expect(printNode(simplify("(pi/2)^3"))).toBe("pi^3/8");
    });

    it("handles combination of exponentiation, division, multiplication, addition and subtraction of constants", () => {
      expect(printNode(simplify("pi^-1 + 1/pi"))).toBe("2pi^-1");
      expect(printNode(simplify("1/pi + pi^-1"))).toBe("2pi^-1");
      expect(printNode(simplify("pi^-1 - 1/pi"))).toBe("0");
      expect(printNode(simplify("1/pi - pi^-1"))).toBe("0");
      expect(printNode(simplify("pi(pi / pi^2)"))).toBe("1");

      expect(printNode(simplify("e / pi^2"))).toBe("e / pi^2");
      expect(printNode(simplify("e / pi / pi"))).toBe("e / pi^2");
      expect(printNode(simplify("e^2 / pi"))).toBe("e^2 / pi");
      expect(printNode(simplify("e * (e / pi)"))).toBe("e^2 / pi");
      expect(printNode(simplify("pi(2pi / pi^2)"))).toBe("2");

      expect(printNode(simplify("(-pi - 1) / -1"))).toBe("pi + 1");

      expect(printNode(simplify("(e + pi) / (e + pi)"))).toBe("1");
      expect(printNode(simplify("(pi + 1) / (pi + 1)"))).toBe("1");
      expect(printNode(simplify("(pi + 1.5) / (pi + 1.5)"))).toBe("1");
      expect(printNode(simplify("(pi + 1/2) / (pi + 1/2)"))).toBe("1");

      expect(printNode(simplify("(1 + pi + e) / (pi + e + 1)"))).toBe("1");

      expect(printNode(simplify("pi^e * pi^-e"))).toBe("1");
      expect(printNode(simplify("e^pi * e^-pi"))).toBe("1");

      expect(printNode(simplify("2^e * 2^-e"))).toBe("1");
      expect(printNode(simplify("2^pi * 2^-pi"))).toBe("1");
    });

    it("handles exponentiation of constants", () => {
      expect(printNode(simplify("pi^0"))).toBe("1");
      expect(printNode(simplify("e^0"))).toBe("1");

      expect(printNode(simplify("pi^1"))).toBe("pi");
      expect(printNode(simplify("e^1"))).toBe("e");

      expect(printNode(simplify("pi^2"))).toBe("pi^2");
      expect(printNode(simplify("e^2"))).toBe("e^2");

      expect(printNode(simplify("pi^-1"))).toBe("pi^-1");
      expect(printNode(simplify("e^-1"))).toBe("e^-1");

      expect(printNode(simplify("pi^-2"))).toBe("pi^-2");
      expect(printNode(simplify("e^-2"))).toBe("e^-2");

      expect(printNode(simplify("pi^e"))).toBe("pi^e");
      expect(printNode(simplify("e^pi"))).toBe("e^pi");

      expect(printNode(simplify("2^e"))).toBe("2^e");
      expect(printNode(simplify("2^pi"))).toBe("2^pi");

      expect(printNode(simplify("2pi^2"))).toBe("2pi^2");
      expect(printNode(simplify("-pi^2"))).toBe("-pi^2");

      expect(printNode(simplify("pi^(1/2)"))).toBe("pi^(1/2)");
      expect(simplify("pi^(1/2)").toString()).toBe("(pi ^ (1/2))");
      expect(printNode(simplify("pi^(2/3)"))).toBe("pi^(2/3)");

      expect(printNode(simplify("pi^1.5"))).toBe("pi^1.5");

      expect(printNode(simplify("(pi^2)^3"))).toBe("pi^6");

      expect(printNode(simplify("(pi^4)^(1/2)"))).toBe("pi^2");
    });
  });

  describe("variables", () => {
    it("handles exponentiation", () => {
      expect(printNode(simplify("(-x)^2"))).toBe("x^2");
      expect(printNode(simplify("(-x)^3"))).toBe("-x^3");
    });

    it("handles fractional exponents", () => {
      expect(printNode(simplify("(x^2)^(1/2)"))).toBe("abs(x)");
      expect(printNode(simplify("(x^3)^(1/3)"))).toBe("x");
      expect(printNode(simplify("(x^4)^(1/4)"))).toBe("abs(x)");
      expect(printNode(simplify("(x^2)^(1/4)"))).toBe("abs(x)^(1/2)");
      expect(printNode(simplify("(x^2)^(1/6)"))).toBe("abs(x)^(1/3)");
      expect(printNode(simplify("(x^6)^(1/2)"))).toBe("abs(x)^3");
    });

    it("handles exponentiation with multiplications", () => {
      expect(printNode(simplify("x^2 * x^-2"))).toBe("1");
      expect(printNode(simplify("2^x * 2^-x"))).toBe("1");
      expect(printNode(simplify("e^x * e^-x"))).toBe("1");

      expect(printNode(simplify("x^x * x^-x"))).not.toBe("1");
      expect(printNode(simplify("(-2)^x * (-2)^-x"))).not.toBe("1");
      expect(printNode(simplify("0^x * 0^-x"))).not.toBe("1");

      expect(printNode(simplify("0^x * 0^-x", { complex: true }))).not.toBe(
        "1",
      );
    });
  });

  describe("functions", () => {
    it("handles sqrt function", () => {
      expect(printNode(simplify("sqrt(pi)"))).toBe("pi^(1/2)");
      expect(printNode(simplify("sqrt(pi^2)"))).toBe("pi");
      expect(printNode(simplify("sqrt(pi)^2"))).toBe("pi");
      expect(printNode(simplify("sqrt(pi) * pi"))).toBe("pi^(3/2)");

      expect(printNode(simplify("sqrt(2) * sqrt(2)"))).toBe("2");
      expect(printNode(simplify("sqrt(2)^2"))).toBe("2");
      expect(printNode(simplify("sqrt(2)"))).toBe("2^(1/2)");
      expect(printNode(simplify("2 / sqrt(2)"))).toBe("2^(1/2)");

      expect(printNode(simplify("sqrt(x)"))).toBe("x^(1/2)");
      expect(printNode(simplify("sqrt(x^2)"))).toBe("abs(x)");
      expect(printNode(simplify("sqrt(x^4)"))).toBe("x^2");
      expect(printNode(simplify("sqrt(x)^2"))).toBe("(x^(1/2))^2");
      expect(printNode(simplify("sqrt(sqrt(x)^2)"))).toBe("x^(1/2)");
      expect(printNode(simplify("sqrt(x)^-1"))).toBe("x^(-1/2)");
      expect(printNode(simplify("sqrt(x) * sqrt(x)^3"))).toBe("(x^(1/2))^4");
      expect(printNode(simplify("sqrt(x) / sqrt(x)^-1"))).toBe("(x^(1/2))^2");
    });

    it("handles abs function", () => {
      expect(printNode(simplify("abs(2)"))).toBe("2");
      expect(printNode(simplify("abs(-2)"))).toBe("2");
      expect(printNode(simplify("abs(-0.5)"))).toBe("0.5");
      expect(printNode(simplify("abs(-1/2)"))).toBe("1/2");

      expect(printNode(simplify("abs(pi)"))).toBe("pi");
      expect(printNode(simplify("abs(-pi)"))).toBe("pi");
      expect(printNode(simplify("abs(pi + 1)"))).toBe("pi + 1");
      expect(printNode(simplify("abs(pi^2)"))).toBe("pi^2");
      expect(printNode(simplify("abs(pi)^2"))).toBe("pi^2");
      expect(printNode(simplify("abs(e^pi)"))).toBe("e^pi");
      expect(printNode(simplify("abs(abs(pi))"))).toBe("pi");
      expect(printNode(simplify("abs(pi) * abs(pi)"))).toBe("pi^2");

      expect(printNode(simplify("abs(x)"))).toBe("abs(x)");
      expect(printNode(simplify("abs(-x)"))).toBe("abs(x)");
      expect(printNode(simplify("abs(x^2)"))).toBe("x^2");
      expect(printNode(simplify("abs(x^1e2)"))).toBe("x^100");
      expect(printNode(simplify("abs(2^x)"))).toBe("2^x");
      expect(printNode(simplify("abs(e^x)"))).toBe("e^x");
      expect(printNode(simplify("abs(x)^2"))).toBe("x^2");
      expect(printNode(simplify("abs(x) * abs(x)"))).toBe("x^2");
      expect(printNode(simplify("abs(x^4)"))).toBe("x^4");
      expect(printNode(simplify("abs(x)^4"))).toBe("x^4");
      expect(printNode(simplify("abs(x^x)"))).toBe("abs(x^x)");
      expect(printNode(simplify("(abs(x)^3)^2"))).toBe("x^6");
      expect(printNode(simplify("(abs(x^3))^2"))).toBe("x^6");
      expect(printNode(simplify("abs(abs(x))"))).toBe("abs(x)");
      expect(printNode(simplify("abs(-abs(x))"))).toBe("abs(x)");
      expect(printNode(simplify("abs(abs(x) + 1)"))).toBe("abs(x) + 1");
      expect(printNode(simplify("abs(2x)"))).toBe("2abs(x)");
      expect(printNode(simplify("x^2 / abs(x)"))).toBe("abs(x)");
      expect(printNode(simplify("x^3 / abs(x)"))).toBe("x * abs(x)");

      const negativeXoptions = {
        constants: new Map([["x", "negative" as const]]),
      };
      expect(printNode(simplify("abs(x)", negativeXoptions))).toBe("-x");
      expect(printNode(simplify("abs(-x)", negativeXoptions))).toBe("-x");
      expect(printNode(simplify("abs(pi - x)", negativeXoptions))).toBe(
        "pi - x",
      );
      expect(printNode(simplify("abs(x - pi)", negativeXoptions))).toBe(
        "-x + pi",
      );
    });

    it("handles sqrt function with abs function", () => {
      expect(printNode(simplify("abs(sqrt(x))"))).toBe("x^(1/2)");
      expect(printNode(simplify("abs(sqrt(-x))"))).toBe("(-x)^(1/2)");
    });

    it("handles floor and ceil functions", () => {
      expect(printNode(simplify("floor(1)"))).toBe("1");
      expect(printNode(simplify("ceil(1)"))).toBe("1");

      expect(printNode(simplify("floor(1.5)"))).toBe("1");
      expect(printNode(simplify("ceil(1.5)"))).toBe("2");
      expect(printNode(simplify("floor(1.2e2)"))).toBe("120");
      expect(printNode(simplify("ceil(1.2e2)"))).toBe("120");

      expect(printNode(simplify("floor(-1.5)"))).toBe("-2");
      expect(printNode(simplify("ceil(-1.5)"))).toBe("-1");
      expect(printNode(simplify("floor(-1.2e2)"))).toBe("-120");
      expect(printNode(simplify("ceil(-1.2e2)"))).toBe("-120");

      expect(printNode(simplify("floor(3/2)"))).toBe("1");
      expect(printNode(simplify("ceil(3/2)"))).toBe("2");

      expect(printNode(simplify("floor(-3/2)"))).toBe("-2");
      expect(printNode(simplify("ceil(-3/2)"))).toBe("-1");

      expect(printNode(simplify("floor(floor(x))"))).toBe("floor(x)");
      expect(printNode(simplify("ceil(ceil(x))"))).toBe("ceil(x)");

      expect(printNode(simplify("ceil(floor(x))"))).toBe("floor(x)");
      expect(printNode(simplify("floor(ceil(x))"))).toBe("ceil(x)");

      expect(printNode(simplify("floor(floor(x) + floor(x))"))).toBe(
        "2floor(x)",
      );
      expect(printNode(simplify("ceil(ceil(x) + ceil(x))"))).toBe("2ceil(x)");

      expect(printNode(simplify("ceil(floor(x)^2)"))).toBe("floor(x)^2");
      expect(printNode(simplify("floor(ceil(x)^2)"))).toBe("ceil(x)^2");

      expect(printNode(simplify("ceil(floor(x)^-1)"))).not.toBe("floor(x)^-1");
      expect(printNode(simplify("floor(ceil(x)^-1)"))).not.toBe("ceil(x)^-1");

      expect(printNode(simplify("floor(x + 1)"))).toBe("floor(x) + 1");
      expect(printNode(simplify("ceil(x + 1)"))).toBe("ceil(x) + 1");

      expect(printNode(simplify("floor(x + floor(x))"))).toBe("2floor(x)");
      expect(printNode(simplify("ceil(x + ceil(x))"))).toBe("2ceil(x)");

      expect(printNode(simplify("floor(x + ceil(x))"))).toBe(
        "floor(x) + ceil(x)",
      );
      expect(printNode(simplify("ceil(x + floor(x))"))).toBe(
        "ceil(x) + floor(x)",
      );
    });

    it("handles floor and ceil functions with abs function", () => {
      expect(printNode(simplify("floor(abs(floor(x)))"))).toBe("abs(floor(x))");
      expect(printNode(simplify("ceil(abs(floor(x)))"))).toBe("abs(floor(x))");
      expect(printNode(simplify("ceil(abs(ceil(x)))"))).toBe("abs(ceil(x))");
      expect(printNode(simplify("floor(abs(ceil(x)))"))).toBe("abs(ceil(x))");

      expect(printNode(simplify("abs(floor(abs(x)))"))).toBe("floor(abs(x))");
      expect(printNode(simplify("abs(ceil(abs(x)))"))).toBe("ceil(abs(x))");

      expect(printNode(simplify("floor(2^abs(floor(x)))"))).toBe(
        "2^abs(floor(x))",
      );
    });

    it("handles functions", () => {
      const functions = new Set(["fn"]);
      expect(printNode(simplify("fn(1 + 1)", { functions }))).toBe("fn(2)");
      expect(printNode(simplify("fn(2 * 2, 5-3)", { functions }))).toBe(
        "fn(4, 2)",
      );
    });
  });

  describe("complex domain", () => {
    const options = { complex: true };

    it("handles i", () => {
      expect(printNode(simplify("i", options))).toBe("i");

      expectUndefined("i").toMatchInlineSnapshot(`"i"`);
      expectUndefined("i^2").toMatchInlineSnapshot(`"i^2"`);
    });

    it("handles exponentiation of i", () => {
      expect(printNode(simplify("i^2", options))).toBe("-1");
      expect(printNode(simplify("i^3", options))).toBe("-i");
      expect(printNode(simplify("i^4", options))).toBe("1");

      expect(printNode(simplify("i^5", options))).toBe("i");
      expect(printNode(simplify("i^6", options))).toBe("-1");
      expect(printNode(simplify("i^7", options))).toBe("-i");
      expect(printNode(simplify("i^8", options))).toBe("1");

      expect(printNode(simplify("i^1e2", options))).toBe("1");

      expect(printNode(simplify("i^-1", options))).toBe("-i");
      expect(printNode(simplify("i^-2", options))).toBe("-1");
      expect(printNode(simplify("i^-3", options))).toBe("i");
      expect(printNode(simplify("i^-4", options))).toBe("1");

      expect(printNode(simplify("(2i)^2", options))).toBe("-4");
      expect(printNode(simplify("(2i)^3", options))).toBe("-8i");
      expect(printNode(simplify("(2i)^4", options))).toBe("16");

      expect(printNode(simplify("(-i)^2", options))).toBe("-1");
      expect(printNode(simplify("(-i)^3", options))).toBe("i");
    });

    it("handles exponentiation in complex domain", () => {
      expect(printNode(simplify("(-z)^2"))).toBe("z^2");
      expect(printNode(simplify("(-z)^3"))).toBe("-z^3");
    });

    it("handles fractional exponents in complex domain", () => {
      expect(printNode(simplify("(z^(1/2))^2", options))).toBe("z");
      expect(printNode(simplify("(z^2)^(1/2)", options))).toBe("(z^2)^(1/2)");
      expect(printNode(simplify("(z^3)^(1/3)", options))).toBe("(z^3)^(1/3)");

      expect(printNode(simplify("216^(4/3)", options))).toBe("1296");
      expect(printNode(simplify("32^-0.2", options))).toBe("1/2");

      expect(printNode(simplify("(-4)^(3/2)", options))).toBe("-8i");

      expect(printNode(simplify("(-8)^(1/3)", options))).not.toBe("-2");
    });

    it("handles sqrt function in complex domain", () => {
      expect(printNode(simplify("sqrt(-1) * sqrt(-1)", options))).toBe("-1");
      expect(printNode(simplify("sqrt(-1) * -sqrt(-1)", options))).toBe("1");
      expect(printNode(simplify("sqrt(-1)^4", options))).toBe("1");

      expect(printNode(simplify("sqrt(pi^2)", options))).toBe("pi");

      expect(printNode(simplify("sqrt(z)^2", options))).toBe("z");
      expect(printNode(simplify("sqrt(sqrt(z)^2)"))).toBe("z^(1/2)");
      expect(printNode(simplify("sqrt(z^2)", options))).toBe("(z^2)^(1/2)");
      expect(printNode(simplify("sqrt(z^4)", options))).toBe("(z^4)^(1/2)");

      expect(printNode(simplify("sqrt(-1)", options))).toBe("i");
      expect(printNode(simplify("sqrt(-4)", options))).toBe("2i");
      expect(printNode(simplify("sqrt(-16)", options))).toBe("4i");

      expect(
        printNode(
          simplify("sqrt(x^2)", {
            complex: true,
            constants: new Map([["x", "real"]]),
          }),
        ),
      ).toBe("abs(x)");
      expect(
        printNode(
          simplify("sqrt(x^2)", {
            complex: true,
            constants: new Map([["x", "positive"]]),
          }),
        ),
      ).toBe("x");
      expect(
        printNode(
          simplify("sqrt(x^2)", {
            complex: true,
            constants: new Map([["x", "negative"]]),
          }),
        ),
      ).toBe("-x");
    });

    it("handles abs function in complex domain", () => {
      expect(printNode(simplify("abs(pi)", options))).toBe("pi");
      expect(printNode(simplify("abs(e^pi)", options))).toBe("e^pi");

      expect(printNode(simplify("abs(z^2)", options))).toBe("abs(z^2)");
      expect(printNode(simplify("abs(z)^2", options))).toBe("abs(z)^2");
      expect(printNode(simplify("abs(z) * abs(z)", options))).toBe("abs(z)^2");
      expect(printNode(simplify("abs(2^z)", options))).toBe("abs(2^z)");
      expect(printNode(simplify("abs(e^z)", options))).toBe("abs(e^z)");
      expect(printNode(simplify("abs(abs(z))", options))).toBe("abs(z)");
      expect(printNode(simplify("abs(-abs(z))", options))).toBe("abs(z)");
      expect(printNode(simplify("abs(abs(z) + 1)", options))).toBe(
        "abs(z) + 1",
      );
      expect(printNode(simplify("abs(2z)", options))).toBe("2abs(z)");
      expect(printNode(simplify("z^2 / abs(z)", options))).toBe("z^2 / abs(z)");
      expect(printNode(simplify("z^3 / abs(z)", options))).toBe("z^3 / abs(z)");

      expect(printNode(simplify("abs(i)", options))).toBe("1");
      expect(printNode(simplify("abs(-i)", options))).toBe("1");
      expect(printNode(simplify("abs(2i)", options))).toBe("2");
      expect(printNode(simplify("abs(-2i)", options))).toBe("2");
      expect(printNode(simplify("abs(3 + 4i)", options))).not.toBe("7");
    });

    it("handles sqrt function with abs function in complex domain", () => {
      expect(printNode(simplify("abs(sqrt(z))", options))).not.toBe("z^(1/2)");
      expect(
        printNode(
          simplify("abs(sqrt(x))", {
            complex: true,
            constants: new Map([["x", "real"]]),
          }),
        ),
      ).toBe("x^(1/2)");
    });
  });
});
