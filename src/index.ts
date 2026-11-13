import { Evaluator } from "#lib/evaluator";
import { tokenize } from "#lib/lexer";
import type { DefinedNode, TreeNode } from "#lib/nodes";
import { Parser } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

function parse(expression: string): DefinedNode {
  const tokens = tokenize(expression);
  return new Parser(tokens).parse();
}

function simplify(expression: string): TreeNode {
  const tree = parse(expression);
  const evaluator = new Evaluator();
  return evaluator.simplify(tree);
}

export { simplify, parse, tokenize, Parser, Evaluator };
