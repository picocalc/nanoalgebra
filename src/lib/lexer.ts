import { AlgebraError } from "#lib/errors";

export class LexerError extends AlgebraError {
  constructor(message: string, pos: number) {
    super("LexerError", message, pos);
  }
}

export interface TokenBase {
  pos: number;
}

export interface TokenNumber extends TokenBase {
  type: "NUMBER";
  whole: string;
  fraction?: string;
  exponent?: string;
}

export interface TokenIdentifier extends TokenBase {
  type: "IDENTIFIER";
  id: string;
}

export type TokenBinaryOperator =
  | { type: "MUL"; pos: number }
  | { type: "DIV"; pos: number }
  | { type: "POW"; pos: number }
  | { type: "MOD"; pos: number };

export type Token =
  | TokenNumber
  | TokenIdentifier
  | TokenBinaryOperator
  | { type: "PLUS"; pos: number }
  | { type: "MINUS"; pos: number }
  | { type: "FACTORIAL"; pos: number }
  | { type: "PIPE"; pos: number }
  | { type: "LPAREN"; pos: number }
  | { type: "RPAREN"; pos: number };

type TokenType = Exclude<Token, TokenNumber | TokenIdentifier>["type"];

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

function isDigit(ch?: string): ch is Digit {
  if (ch === undefined) return false;
  return ch >= "0" && ch <= "9";
}

function isAlpha(ch?: string): boolean {
  if (ch === undefined) return false;
  return ch >= "a" && ch <= "z";
}

export interface LexerOptions {
  readonly decimalSeparator?: "." | ",";
}

/**
 * Maximum allowed expression length
 */
const MAX_EXPRESSION_LENGTH = 75_000_000;

const CHAR_MAP: Record<string, TokenType> = {
  "(": "LPAREN",
  ")": "RPAREN",
  "+": "PLUS",
  "-": "MINUS",
  "*": "MUL",
  "/": "DIV",
  "^": "POW",
  "!": "FACTORIAL",
  "|": "PIPE",
  "%": "MOD",
};

/**
 * Simple lexer (tokenizer).
 */
export function tokenize(
  expression: string,
  options: LexerOptions = {},
): Token[] {
  const { decimalSeparator = "." } = options;
  const tokens: Token[] = [];
  const length = expression.length;

  if (length > MAX_EXPRESSION_LENGTH) {
    throw new LexerError(
      `Expression length (${length}) exceeds the maximum allowed limit of ${MAX_EXPRESSION_LENGTH}`,
      0,
    );
  }

  for (let index = 0; index < length; index++) {
    const ch = expression[index]!;
    const pos = index;

    if (ch === " ") continue;

    if (isDigit(ch) || ch === decimalSeparator) {
      let whole = "";
      let fraction: string | undefined = undefined;
      let exponent: string | undefined = undefined;

      const consumeDigits = () => {
        const start = index;
        while (index < length && isDigit(expression[index])) index++;
        return expression.slice(start, index);
      };

      if (ch === decimalSeparator) {
        whole = "0";
        index++;
        fraction = consumeDigits();
        if (fraction.length === 0) {
          throw new LexerError("Expected digit after decimal separator", index);
        }
      } else {
        whole = consumeDigits();
        if (index < length && expression[index] === decimalSeparator) {
          index++;
          fraction = consumeDigits();
        }
      }

      if (
        index < length &&
        (expression[index] === "e" || expression[index] === "E")
      ) {
        let lookahead = index + 1;
        let sign = "";

        const next = expression[lookahead];

        if (lookahead < length && (next === "+" || next === "-")) {
          sign = next;
          lookahead++;
        }

        if (lookahead < length && isDigit(expression[lookahead])) {
          index = lookahead;
          exponent = sign + consumeDigits();
        }
      }

      // Final check for trailing separators
      if (index < length && expression[index] === decimalSeparator) {
        throw new LexerError("Invalid decimal number format", index);
      }

      index--;
      tokens.push({ type: "NUMBER", whole, fraction, exponent, pos });
      continue;
    }

    if (isAlpha(ch)) {
      let id = "";
      while (index < length && isAlpha(expression[index])) {
        id += expression[index++];
      }
      index--;
      tokens.push({ type: "IDENTIFIER", id, pos });
      continue;
    }

    const type = CHAR_MAP[ch];

    if (!type) {
      throw new LexerError(`Unexpected character '${ch}'`, index);
    }

    tokens.push({ type, pos });
  }

  return tokens;
}
