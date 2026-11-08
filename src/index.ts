import { Evaluator } from "#lib/evaluator";
import type { LexerOptions } from "#lib/lexer";
import { tokenize } from "#lib/lexer";
import { Parser } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

function evaluate(expression: string, options?: LexerOptions): string {
  const tokens = tokenize(expression, options);
  const tree = new Parser(tokens).parse();
  const evaluator = new Evaluator();
  return evaluator.toDecimal(evaluator.evaluate(tree)).toString();
}

export { evaluate, tokenize, Parser, Evaluator };
