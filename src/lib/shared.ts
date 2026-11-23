import { powBitLength } from "bigint.bitlength";

import type { NumericalNode, TreeNode } from "./nodes";

export function isNegativeNumber(node: TreeNode): boolean {
  if (node.type === "INTEGER") return node.value < 0n;
  if (node.type === "DECIMAL") return node.whole < 0n;
  if (node.type === "FRACTION") return node.numerator < 0n;
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

export function isNegativeOne(node: TreeNode): boolean {
  if (node.type === "INTEGER") return node.value === -1n;
  if (node.type === "DECIMAL")
    return node.whole === -1n && node.exponent === 0n;
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

function flattenOperands(
  node: TreeNode,
  type: "ADD" | "MULTIPLY",
  out: TreeNode[] = [],
): TreeNode[] {
  if (node.type !== type) {
    out.push(node);
    return out;
  }
  flattenOperands(node.left, type, out);
  flattenOperands(node.right, type, out);
  return out;
}

export function isEqual(left: TreeNode, right: TreeNode): boolean {
  if (left.type === "SYMBOL" && right.type === "SYMBOL") {
    return left.name === right.name;
  }
  if (left.type === "INTEGER" && right.type === "INTEGER") {
    return left.value === right.value;
  }
  if (left.type === "DECIMAL" && right.type === "DECIMAL") {
    return left.whole === right.whole && left.exponent === right.exponent;
  }
  if (left.type === "FRACTION" && right.type === "FRACTION") {
    return (
      left.numerator === right.numerator &&
      left.denominator === right.denominator
    );
  }
  if (left.type === "POWER" && right.type === "POWER") {
    return isEqual(left.left, right.left) && isEqual(left.right, right.right);
  }
  if (
    (left.type === "MULTIPLY" && right.type === "MULTIPLY") ||
    (left.type === "ADD" && right.type === "ADD")
  ) {
    const leftOps = flattenOperands(left, left.type);
    const rightOps = flattenOperands(right, right.type);
    if (leftOps.length !== rightOps.length) return false;

    const matched = Array.from<boolean>({ length: rightOps.length }).fill(
      false,
    );
    return leftOps.every((lOp) => {
      const idx = rightOps.findIndex(
        (rOp, i) => !matched[i] && isEqual(lOp, rOp),
      );
      if (idx === -1) return false;
      matched[idx] = true;
      return true;
    });
  }
  if (left.type === "FUNCTION" && right.type === "FUNCTION") {
    return (
      left.name === right.name &&
      left.args.length === right.args.length &&
      left.args.every((val, i) => right.args[i] && isEqual(val, right.args[i]))
    );
  }
  return false;
}

export const POW_BITS_THRESHOLD = 40_000n;

export function isAbovePowThreshold(base: bigint, exp: bigint): boolean {
  if (base === -1n || base === 0n || base === 1n) return false;
  const e = exp < 0n ? -exp : exp;
  if (e > POW_BITS_THRESHOLD) return true;
  return powBitLength(base, e) > POW_BITS_THRESHOLD;
}
