import { describe, it, expect } from "bun:test";

import type { ParserOptions } from "#lib/parser";
import { printNode } from "#lib/printer";
import { parse } from "#src";

function testPrint(expression: string, options?: ParserOptions) {
  const parsed = parse(expression, options);
  const printed = printNode(parsed);
  const stringified = parsed.toString();
  expect(parse(printed, options).toString()).toBe(stringified);
  expect(parse(stringified, options).toString()).toBe(stringified);
  return expect(printed);
}

describe("printNode and .toString()", () => {
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
    testPrint("-(2 % 3 * pi)").toMatchInlineSnapshot(`"-(2 % 3 * pi)"`);
    testPrint("-(1 * (-1)^2)").toMatchInlineSnapshot(`"-(1 * (-1)^2)"`);
    testPrint("-(2 * (-3)^2)").toMatchInlineSnapshot(`"-(2 * (-3)^2)"`);
    testPrint("-(1 * (-3)^2)").toMatchInlineSnapshot(`"-(1 * (-3)^2)"`);
    testPrint("-(3 * (-1)^2)").toMatchInlineSnapshot(`"-(3 * (-1)^2)"`);
    testPrint("(-1) * (-pi * 2)").toMatchInlineSnapshot(`"-1 * (-pi * 2)"`);
    testPrint("(-2) * (-pi * 2)").toMatchInlineSnapshot(`"-2 * (-pi * 2)"`);
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

  it("handles scientific notation", () => {
    testPrint("1e2").toMatchInlineSnapshot(`"100"`);
    testPrint("1e-2").toMatchInlineSnapshot(`"0.01"`);

    testPrint("2e2").toMatchInlineSnapshot(`"200"`);
    testPrint("2e-2").toMatchInlineSnapshot(`"0.02"`);

    testPrint("2e200000").toMatchInlineSnapshot(`"2e200000"`);
    testPrint("2e-200000").toMatchInlineSnapshot(`"2e-200000"`);

    testPrint("-1e2").toMatchInlineSnapshot(`"-100"`);
    testPrint("-1e-2").toMatchInlineSnapshot(`"-0.01"`);

    testPrint("-2e2").toMatchInlineSnapshot(`"-200"`);
    testPrint("-2e-2").toMatchInlineSnapshot(`"-0.02"`);

    testPrint("-2e200000").toMatchInlineSnapshot(`"-2e200000"`);
    testPrint("-2e-200000").toMatchInlineSnapshot(`"-2e-200000"`);
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

  it("handles undefined", () => {
    testPrint("undefined").toMatchInlineSnapshot(`"undefined"`);
  });

  it("handles functions", () => {
    const functions = new Set(["fn"]);
    testPrint("fn(1 + 1, fn(-pi))", { functions }).toMatchInlineSnapshot(
      `"fn(1 + 1, fn(-pi))"`,
    );
    testPrint("2fn(1)", { functions }).toMatchInlineSnapshot(`"2fn(1)"`);
    testPrint("-fn(1)", { functions }).toMatchInlineSnapshot(`"-fn(1)"`);
    testPrint("-2fn(1)", { functions }).toMatchInlineSnapshot(`"-2fn(1)"`);
  });
});
