import type { NumericalNode, TreeNode } from "./nodes";
import { Decimal, Fraction, Integer, Multiply } from "./nodes";
import { isNegativeNumber } from "./shared";

export function negate(node: NumericalNode): NumericalNode;
export function negate(node: TreeNode): TreeNode;
export function negate(node: TreeNode): TreeNode {
  if (node.type === "UNDEFINED") return node;
  if (node.type === "INTEGER") return new Integer(-node.value);
  if (node.type === "DECIMAL") return new Decimal(-node.whole, node.exponent);
  if (node.type === "FRACTION")
    return new Fraction(-node.numerator, node.denominator);
  if (
    node.type === "MULTIPLY" &&
    isNegativeNumber(node.left) &&
    node.left.type !== "UNDEFINED"
  ) {
    return new Multiply(negate(node.left), node.right);
  }
  return new Multiply(new Integer(-1), node);
}

export function toFraction(node: NumericalNode): Fraction {
  if (node.type === "FRACTION") return node;
  if (node.type === "INTEGER") return new Fraction(node.value, 1n);
  return node.exponent >= 0n
    ? new Fraction(node.whole * 10n ** node.exponent, 1n)
    : new Fraction(node.whole, 10n ** -node.exponent);
}
