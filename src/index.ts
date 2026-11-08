import type { LexerOptions } from "#lib/lexer";
import { tokenize } from "#lib/lexer";
import { Parser } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

export { tokenize } from "#lib/lexer";

function evaluate(expression: string, options?: LexerOptions): string {
  return new Parser(tokenize(expression, options))
    .parse()
    .evaluate()
    .toString();
}

export { evaluate, Parser };
