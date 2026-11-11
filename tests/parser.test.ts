import { describe, it, expect } from "bun:test";

import { ParserError } from "#lib/parser";
import { parse } from "#src";

function testPrint(expression: string) {
  const parsed = parse(expression);
  const printed = parsed.print();
  expect(parse(printed).toString()).toBe(parsed.toString());
  return expect(printed);
}

describe("parse", () => {
  it("parses negative number", () => {
    testPrint("-1").toMatchInlineSnapshot(`"-1"`);
  });

  it("parses addition", () => {
    testPrint("1 + 1").toMatchInlineSnapshot(`"1 + 1"`);
  });

  it("parses subtraction", () => {
    testPrint("1 - 1").toMatchInlineSnapshot(`"1 - 1"`);
  });

  it("parses multiplication", () => {
    testPrint("1 * 1").toMatchInlineSnapshot(`"1 * 1"`);
  });

  it("parses division", () => {
    testPrint("1 / 1").toMatchInlineSnapshot(`"1 / 1"`);
  });

  it("parses module division", () => {
    testPrint("1 % 1").toMatchInlineSnapshot(`"1 % 1"`);
  });

  it("parses exponentiation", () => {
    testPrint("1 ^ 1").toMatchInlineSnapshot(`"1^1"`);
  });

  it("parses and prints expressions with multiple operators", () => {
    testPrint("1 + 2 - 3").toMatchInlineSnapshot(`"1 + 2 - 3"`);
    testPrint("1 + 2 + 3").toMatchInlineSnapshot(`"1 + 2 + 3"`);
    testPrint("3 - 2 + 1").toMatchInlineSnapshot(`"3 - 2 + 1"`);
    testPrint("1 + 2 * 3").toMatchInlineSnapshot(`"1 + 2 * 3"`);
    testPrint("6 / 3 - 2").toMatchInlineSnapshot(`"6 / 3 - 2"`);
    testPrint("6 / 3 / 2").toMatchInlineSnapshot(`"6 / 3 / 2"`);
  });

  it("parses and prints expressions with parentheses", () => {
    testPrint("5 - (2 + 2)").toMatchInlineSnapshot(`"5 - (2 + 2)"`);
    testPrint("3(1 + 2)").toMatchInlineSnapshot(`"3 * (1 + 2)"`);
    testPrint("(1 + 2) * (3 + 4)").toMatchInlineSnapshot(`"(1 + 2) * (3 + 4)"`);
    testPrint("(1 + 2) / (3 + 4)").toMatchInlineSnapshot(`"(1 + 2) / (3 + 4)"`);
    testPrint("24 / (6 / 2)").toMatchInlineSnapshot(`"24 / (6 / 2)"`);
    testPrint("(1 + 2) % (3 + 4)").toMatchInlineSnapshot(`"(1 + 2) % (3 + 4)"`);
    testPrint("(1 + 2) ^ (3 + 4)").toMatchInlineSnapshot(`"(1 + 2)^(3 + 4)"`);
    testPrint("(2^3)^2").toMatchInlineSnapshot(`"(2^3)^2"`);
    testPrint("(2 / 3)^2").toMatchInlineSnapshot(`"(2 / 3)^2"`);
  });

  it("parses and prints expressions with constants", () => {
    testPrint("2pi * e").toMatchInlineSnapshot(`"2pi * e"`);
    testPrint("pi^(2/3)").toMatchInlineSnapshot(`"pi^(2 / 3)"`);
  });

  describe("invalid expressions", () => {
    it("handles empty expression", () => {
      expect(() => parse("")).toThrow(ParserError);
    });

    it("handles unexpected end of expression", () => {
      expect(() => parse("(")).toThrow(ParserError);
      expect(() => parse("(1")).toThrow(ParserError);
    });

    it("handles unexpected tokens", () => {
      expect(() => parse(")")).toThrow(ParserError);
      expect(() => parse("1)")).toThrow(ParserError);
    });
  });
});
