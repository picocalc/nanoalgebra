import { powBitLength } from "bigint.bitlength";

import type { NumericalNode, TreeNode } from "./nodes";
import { Decimal, Fraction, Integer, Multiply } from "./nodes";

export function negate(node: TreeNode): TreeNode {
  if (node.type === "UNDEFINED") return node;
  if (node.type === "INTEGER") return new Integer(-node.value);
  if (node.type === "DECIMAL") return new Decimal(-node.whole, node.exponent);
  if (node.type === "FRACTION")
    return new Fraction(-node.numerator, node.denominator);
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

export function isOne(node: TreeNode): boolean {
  if (node.type === "INTEGER") return node.value === 1n;
  if (node.type === "DECIMAL") return node.whole === 1n && node.exponent === 0n;
  return false;
}

export function isNumerical(node: TreeNode): node is NumericalNode {
  return (
    node.type === "INTEGER" ||
    node.type === "DECIMAL" ||
    node.type === "FRACTION"
  );
}

export function tryGetIntegerValue(node: TreeNode): bigint | null {
  if (node.type === "INTEGER") return node.value;
  return null;
}

export function isEvenInteger(node: TreeNode): boolean {
  const int = tryGetIntegerValue(node);
  return !(!int || int % 2n);
}

export function isInteger(node: TreeNode): boolean {
  if (tryGetIntegerValue(node) !== null) return true;
  if (
    node.type === "FUNCTION" &&
    (node.name === "floor" || node.name === "ceil") &&
    node.args.length === 1
  ) {
    return true;
  }
  if (
    node.type === "ADD" ||
    node.type === "SUBTRACT" ||
    node.type === "MULTIPLY"
  ) {
    return isInteger(node.left) && isInteger(node.right);
  }
  if (node.type === "POWER") {
    const exp = tryGetIntegerValue(node.right);
    return !!exp && isInteger(node.left);
  }
  return false;
}

export function isEqual(left: TreeNode, right: TreeNode): boolean {
  if (left.type === "INTEGER" && right.type === "INTEGER") {
    return left.value === right.value;
  }
  if (left.type === "SYMBOL" && right.type === "SYMBOL") {
    return left.name === right.name;
  }
  if (left.type === "POWER" && right.type === "POWER") {
    return isEqual(left.left, right.left) && isEqual(left.right, right.right);
  }
  if (left.type === "MULTIPLY" && right.type === "MULTIPLY") {
    return (
      (isEqual(left.left, right.left) && isEqual(left.right, right.right)) ||
      (isEqual(left.left, right.right) && isEqual(left.right, right.left))
    );
  }
  if (left.type === "FUNCTION" && right.type === "FUNCTION") {
    return (
      left.name === right.name &&
      left.args.every((val, i) => right.args[i] && isEqual(val, right.args[i]))
    );
  }
  return false;
}

export const POW_BITS_THRESHOLD = 40_000n;

export function isAbovePowThreshold(base: bigint, exp: bigint): boolean {
  if (base === -1n || base === 0n || base === 1n) return false;
  if (exp > POW_BITS_THRESHOLD || -exp < -POW_BITS_THRESHOLD) return true;
  return powBitLength(base, exp) > POW_BITS_THRESHOLD;
}
