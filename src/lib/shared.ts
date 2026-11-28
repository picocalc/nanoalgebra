import { powBitLength } from "bigint.bitlength";

import type { NumericalNode, SymbolNode, TreeNode } from "./nodes";

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

export function isI(node: TreeNode): node is SymbolNode & { name: "i" } {
  return node.type === "SYMBOL" && node.name === "i";
}

export function tryGetIntegerValue(node: TreeNode): bigint | null {
  if (node.type === "INTEGER") return node.value;
  return null;
}

export function isEvenInteger(node: TreeNode): boolean {
  const int = tryGetIntegerValue(node);
  return !(!int || int % 2n);
}

export function isEvenRoot(exp: TreeNode): boolean {
  if (!isNumerical(exp)) return false;
  if (exp.type === "INTEGER") return false;
  if (exp.type === "FRACTION") return exp.denominator % 2n === 0n;
  if (exp.exponent >= 0n || exp.whole === 0n) return false;

  const e = -exp.exponent;
  let w = exp.whole < 0n ? -exp.whole : exp.whole;
  let twos = 0n;
  while ((w & 1n) === 0n && twos < e) {
    w >>= 1n;
    twos += 1n;
  }
  return twos < e;
}

export const POW_BITS_THRESHOLD = 40_000n;

export function isAbovePowThreshold(base: bigint, exp: bigint): boolean {
  if (base === -1n || base === 0n || base === 1n) return false;
  const e = exp < 0n ? -exp : exp;
  if (e > POW_BITS_THRESHOLD) return true;
  return powBitLength(base, e) > POW_BITS_THRESHOLD;
}
