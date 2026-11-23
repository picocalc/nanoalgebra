import type { EvaluatorOptions } from "#evaluator";
import { constants, Evaluator } from "#evaluator";
import { AlgebraError } from "#lib/errors";
import { tokenize } from "#lib/lexer";
import type { TreeNode } from "#lib/nodes";
import type { ParserOptions } from "#lib/parser";
import { functions, Parser } from "#lib/parser";
import { printNode } from "#lib/printer";

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
  printNode,
  Parser,
  Evaluator,
  constants,
  functions,
  AlgebraError,
};
