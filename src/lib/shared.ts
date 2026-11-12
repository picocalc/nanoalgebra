import {
  Decimal,
  Integer,
  Multiply,
  type DefinedNode,
  type TreeNode,
} from "./nodes";

export function negate(node: DefinedNode): DefinedNode {
  if (node.type === "INTEGER") return new Integer(-node.value);
  if (node.type === "DECIMAL") return new Decimal(-node.whole, node.exponent);
  if (
    node.type === "MULTIPLY" &&
    isNegative(node.left) &&
    node.left.type !== "UNDEFINED"
  ) {
    return new Multiply(negate(node.left), node.right);
  }
  return new Multiply(new Integer(-1), node);
}

export function isNegative(node: TreeNode): boolean {
  if (node.type === "UNDEFINED") return isNegative(node.node);
  if (node.type === "INTEGER") return node.value < 0n;
  if (node.type === "DECIMAL") return node.whole < 0n;
  if (node.type === "FRACTION") return node.numerator < 0n;
  if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
    return isNegative(node.left);
  }
  return false;
}

export function isZero(node: TreeNode): boolean {
  if (node.type === "INTEGER") return node.value === 0n;
  return false;
}
