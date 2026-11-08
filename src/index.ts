import { Evaluator } from "#lib/evaluator";
import type { LexerOptions } from "#lib/lexer";
import { tokenize } from "#lib/lexer";
import type { NumericalNode, TreeNode } from "#lib/nodes";
import { Parser } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

function parse(expression: string, options?: LexerOptions): TreeNode {
  const tokens = tokenize(expression, options);
  return new Parser(tokens).parse();
}

function evaluate(expression: string, options?: LexerOptions): NumericalNode {
  const tree = parse(expression, options);
  const evaluator = new Evaluator();
  return evaluator.evaluate(tree);
}

export { evaluate, parse, tokenize, Parser, Evaluator };
