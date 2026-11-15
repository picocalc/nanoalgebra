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

interface TokenBinaryOperator {
  type: "PLUS" | "MINUS" | "MUL" | "DIV" | "POW" | "MOD";
  pos: number;
}

interface TokenCharacter {
  type: "FACTORIAL" | "PIPE" | "LPAREN" | "RPAREN" | "COMMA" | "SEMICOLON";
  pos: number;
}

export type Token =
  | TokenNumber
  | TokenIdentifier
  | TokenBinaryOperator
  | TokenCharacter;

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
  ",": "COMMA",
  ";": "SEMICOLON",
};

/**
 * Simple lexer (tokenizer).
 */
export function tokenize(expression: string): Token[] {
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

    if (isDigit(ch) || ch === ".") {
      let whole = "";
      let fraction: string | undefined = undefined;
      let exponent: string | undefined = undefined;

      const consumeDigits = () => {
        const start = index;
        while (index < length && isDigit(expression[index])) index++;
        return expression.slice(start, index);
      };

      if (ch === ".") {
        whole = "0";
        index++;
        fraction = consumeDigits();
        if (fraction.length === 0) {
          throw new LexerError("Expected digit after decimal separator", index);
        }
      } else {
        whole = consumeDigits();
        if (index < length && expression[index] === ".") {
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
      if (index < length && expression[index] === ".") {
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
