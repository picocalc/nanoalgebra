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
    });
  });
});
