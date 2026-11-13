import { Evaluator } from "#lib/evaluator";
import { tokenize } from "#lib/lexer";
import type { DefinedNode, TreeNode } from "#lib/nodes";
import { Parser, type ParserOptions } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

const functions = new Set(["abs", "sqrt"] as const);

function parse(
  expression: string,
  options: ParserOptions = { functions },
): DefinedNode {
  const tokens = tokenize(expression);
  return new Parser(tokens, options).parse();
}

function simplify(
  expression: string,
  options: ParserOptions = { functions },
): TreeNode {
  const tree = parse(expression, options);
  const evaluator = new Evaluator();
  return evaluator.simplify(tree);
}

export { simplify, parse, tokenize, Parser, Evaluator };
