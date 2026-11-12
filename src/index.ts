import { Evaluator } from "#lib/evaluator";
import type { LexerOptions } from "#lib/lexer";
import { tokenize } from "#lib/lexer";
import type { DefinedNode, TreeNode } from "#lib/nodes";
import { Parser } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

function parse(expression: string, options?: LexerOptions): DefinedNode {
  const tokens = tokenize(expression, options);
  return new Parser(tokens).parse();
}

function simplify(expression: string, options?: LexerOptions): TreeNode {
  const tree = parse(expression, options);
  const evaluator = new Evaluator();
  return evaluator.simplify(tree);
}

export { simplify, parse, tokenize, Parser, Evaluator };
