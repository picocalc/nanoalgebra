import { describe, it, expect } from "bun:test";

import { ParserError } from "#lib/parser";
import { parse } from "#src";

describe("parse", () => {
  it("parses addition", () => {
    expect(parse("1 + 1").toString()).toBe("(1 + 1)");
  });

  it("parses subtraction", () => {
    expect(parse("1 - 1").toString()).toBe("(1 - 1)");
  });

  it("parses multiplication", () => {
    expect(parse("1 * 1").toString()).toBe("(1 * 1)");
  });

  it("parses division", () => {
    expect(parse("1 / 1").toString()).toBe("(1 / 1)");
  });

  it("parses module division", () => {
    expect(parse("1 % 1").toString()).toBe("(1 % 1)");
  });

  it("parses exponentiationF", () => {
    expect(parse("1 ^ 1").toString()).toBe("(1 ^ 1)");
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
