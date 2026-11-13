import type { EvaluatorOptions } from "#lib/evaluator";
import { Evaluator } from "#lib/evaluator";
import { tokenize } from "#lib/lexer";
import type { TreeNode } from "#lib/nodes";
import type { ParserOptions } from "#lib/parser";
import { Parser } from "#lib/parser";

export { AlgebraError } from "#lib/errors";

function parse(expression: string, options?: ParserOptions): TreeNode {
  const tokens = tokenize(expression);
  return new Parser(tokens, options).parse();
}

function simplify(
  expression: string,
  options?: ParserOptions & EvaluatorOptions,
): TreeNode {
  const tree = parse(expression, options);
  const evaluator = new Evaluator(options);
  return evaluator.simplify(tree);
}

export { simplify, parse, tokenize, Parser, Evaluator };
