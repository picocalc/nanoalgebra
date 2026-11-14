import { AlgebraError } from "#lib/errors";
import type { EvaluatorOptions } from "#lib/evaluator";
import { constants, Evaluator } from "#lib/evaluator";
import { tokenize } from "#lib/lexer";
import type { TreeNode } from "#lib/nodes";
import type { ParserOptions } from "#lib/parser";
import { functions, Parser } from "#lib/parser";

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

export {
  simplify,
  parse,
  tokenize,
  Parser,
  Evaluator,
  constants,
  functions,
  AlgebraError,
};
