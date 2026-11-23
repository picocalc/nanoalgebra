import { ZERO } from "./constants";
import type { NumericalNode, TreeNode } from "./nodes";
import { Decimal, Fraction, Integer, Multiply } from "./nodes";
import { isAbovePowThreshold, isNegativeNumber } from "./shared";

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

export function tryToFraction(node: NumericalNode): Fraction | null {
  if (node.type === "FRACTION") return node;
  if (node.type === "INTEGER") return new Fraction(node.value, 1n);
  if (node.whole !== 0n && isAbovePowThreshold(10n, node.exponent)) {
    return null;
  }
  return node.exponent >= 0n
    ? new Fraction(node.whole * 10n ** node.exponent, 1n)
    : new Fraction(node.whole, 10n ** -node.exponent);
}

export function toDecimal(node: Integer | Decimal): Decimal {
  return node.type === "INTEGER" ? new Decimal(node.value, 0n) : node;
}

export function normalizeDecimal(
  coeff: bigint,
  exp: bigint,
): Decimal | Integer {
  if (coeff === 0n) return ZERO;
  while (coeff % 10n === 0n && exp < 0n) {
    coeff /= 10n;
    exp += 1n;
  }
  return exp === 0n ? new Integer(coeff) : new Decimal(coeff, exp);
}

export function normalizeFraction(n: bigint, d: bigint): Integer | Fraction {
  const frac = new Fraction(n, d);
  return frac.denominator === 1n ? new Integer(frac.numerator) : frac;
}
