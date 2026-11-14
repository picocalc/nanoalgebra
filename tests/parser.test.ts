import { describe, it, expect } from "bun:test";

import { ParserError } from "#lib/parser";
import { parse } from "#src";

describe("parse", () => {
  it("handles unary negation", () => {
    expect(parse("-1")).toMatchObject({ type: "INTEGER", value: -1n });
    expect(parse("-2.5")).toMatchObject({
      type: "DECIMAL",
      whole: -25n,
      exponent: -1n,
    });
    expect(parse("-(1 + 1)")).toMatchObject({
      type: "MULTIPLY",
      left: { type: "INTEGER", value: -1n },
      right: { type: "ADD" },
    });
    expect(parse("-pi")).toMatchObject({
      type: "MULTIPLY",
      left: { type: "INTEGER", value: -1n },
      right: { type: "SYMBOL" },
    });
  });

  it("handles constants and functions", () => {
    expect(parse("pi")).toMatchObject({ type: "SYMBOL", name: "pi" });
    expect(parse("sqrt(4)")).toMatchObject({
      type: "FUNCTION",
      name: "sqrt",
      args: [{ type: "INTEGER", value: 4n }],
    });
  });

  it("handles undefined", () => {
    expect(parse("undefined")).toMatchObject({
      type: "UNDEFINED",
      node: { type: "SYMBOL", name: "undefined" },
    });
  });

  describe("invalid expressions", () => {
    it("handles an empty expression", () => {
      expect(() => parse("")).toThrow(ParserError);
    });

    it("handles unexpected end of expression", () => {
      expect(() => parse("(")).toThrow(ParserError);
      expect(() => parse("(1")).toThrow(ParserError);
    });

    it("handles unexpected tokens", () => {
      expect(() => parse(")")).toThrow(ParserError);
      expect(() => parse("1)")).toThrow(ParserError);
      expect(() => parse("2 3")).toThrow(ParserError);
      expect(() => parse("pi 2")).toThrow(ParserError);
      expect(() => parse(",")).toThrow(ParserError);
    });

    it("handles incorrect functions", () => {
      expect(() => parse("sqrt()")).toThrow(ParserError);
      expect(() => parse("sqrt(4")).toThrow(ParserError);
      expect(() => parse("sqrt 4")).toThrow(ParserError);
    });
  });
});
