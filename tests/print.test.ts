import { describe, it, expect } from "bun:test";

import { parse } from "#src";

function testPrint(expression: string) {
  const parsed = parse(expression);
  const printed = parsed.print();
  const stringified = parsed.toString();
  expect(parse(printed).toString()).toBe(stringified);
  expect(parse(stringified).toString()).toBe(stringified);
  return expect(printed);
}

describe(".print() and .toString()", () => {
  it("handles unary negation", () => {
    testPrint("-1").toMatchInlineSnapshot(`"-1"`);
    testPrint("-2.5").toMatchInlineSnapshot(`"-2.5"`);
    testPrint("-pi").toMatchInlineSnapshot(`"-pi"`);
    testPrint("-(2 + 3)").toMatchInlineSnapshot(`"-(2 + 3)"`);
    testPrint("-(2 - 3)").toMatchInlineSnapshot(`"-(2 - 3)"`);
    testPrint("-(2 / 3)").toMatchInlineSnapshot(`"-(2 / 3)"`);
    testPrint("-(2 * 3)").toMatchInlineSnapshot(`"-(2 * 3)"`);
    testPrint("-(2 % 3)").toMatchInlineSnapshot(`"-(2 % 3)"`);
    testPrint("(-1)^pi").toMatchInlineSnapshot(`"(-1)^pi"`);
    testPrint("(-2.5e)^pi").toMatchInlineSnapshot(`"(-2.5e)^pi"`);
  });

  it("handles addition", () => {
    testPrint("1 + 1").toMatchInlineSnapshot(`"1 + 1"`);
  });

  it("handles subtraction", () => {
    testPrint("1 - 1").toMatchInlineSnapshot(`"1 - 1"`);
  });

  it("handles multiplication", () => {
    testPrint("1 * 1").toMatchInlineSnapshot(`"1 * 1"`);
  });

  it("handles division", () => {
    testPrint("1 / 1").toMatchInlineSnapshot(`"1 / 1"`);
  });

  it("handles module division", () => {
    testPrint("1 % 1").toMatchInlineSnapshot(`"1 % 1"`);
  });

  it("handles exponentiation", () => {
    testPrint("1 ^ 1").toMatchInlineSnapshot(`"1^1"`);
  });

  it("handles expressions with multiple operators", () => {
    testPrint("1 + 2 - 3").toMatchInlineSnapshot(`"1 + 2 - 3"`);
    testPrint("1 + 2 + 3").toMatchInlineSnapshot(`"1 + 2 + 3"`);
    testPrint("3 - 2 + 1").toMatchInlineSnapshot(`"3 - 2 + 1"`);
    testPrint("1 + 2 * 3").toMatchInlineSnapshot(`"1 + 2 * 3"`);
    testPrint("6 / 3 - 2").toMatchInlineSnapshot(`"6 / 3 - 2"`);
    testPrint("6 / 3 / 2").toMatchInlineSnapshot(`"6 / 3 / 2"`);
  });

  it("handles expressions with parentheses", () => {
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

  it("handles expressions with constants", () => {
    testPrint("2pi * e").toMatchInlineSnapshot(`"2pi * e"`);
    testPrint("pi^(2/3)").toMatchInlineSnapshot(`"pi^(2 / 3)"`);
  });
});
