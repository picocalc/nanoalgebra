import { ONE, ZERO } from "#lib/constants";
import {
  alignDecimals,
  normalizeDecimal,
  normalizeFraction,
  toDecimal,
  tryToFraction,
} from "#lib/convert";
import type { Decimal, Fraction, NumericalNode, Power } from "#lib/nodes";
import { FunctionCall, Integer } from "#lib/nodes";
import { isAbovePowThreshold, tryGetIntegerValue } from "#lib/shared";
import { floorMod, modPow } from "#math/modulo";

export function evaluateNumericFloorCeil(
  node: NumericalNode,
  op: "floor" | "ceil",
): Integer | FunctionCall {
  if (node.type === "DECIMAL" && node.exponent < 0n) {
    if (node.whole === 0n) return ZERO;
    if (BigInt.bitLength(node.whole) <= -node.exponent) {
      if (op === "floor") return node.whole > 0n ? ZERO : new Integer(-1n);
      return node.whole > 0n ? ONE : ZERO;
    }
  }

  const frac = tryToFraction(node);
  if (!frac) return new FunctionCall(op, [node]);

  const { numerator, denominator } = frac;
  const q = numerator / denominator;
  const r = numerator % denominator;
  if (op === "floor") return new Integer(r < 0n ? q - 1n : q);
  return new Integer(r > 0n ? q + 1n : q);
}

export function evaluateNumericPair(
  left: NumericalNode,
  right: NumericalNode,
  fracOp: (a: Fraction, b: Fraction) => [bigint, bigint],
  decOp: (d1: Decimal, d2: Decimal) => [bigint, bigint] | null,
): NumericalNode | null {
  if (left.type === "FRACTION" || right.type === "FRACTION") {
    const f1 = tryToFraction(left);
    const f2 = tryToFraction(right);
    if (!f1 || !f2) return null;
    const [n, d] = fracOp(f1, f2);
    return normalizeFraction(n, d);
  }
  const res = decOp(toDecimal(left), toDecimal(right));
  if (!res) return null;
  return normalizeDecimal(res[0], res[1]);
}

export function evaluateNumericBinary(
  left: NumericalNode,
  right: NumericalNode,
  op: "ADD" | "SUBTRACT",
): NumericalNode | null {
  return evaluateNumericPair(
    left,
    right,
    (a, b) => [
      op === "ADD"
        ? a.numerator * b.denominator + b.numerator * a.denominator
        : a.numerator * b.denominator - b.numerator * a.denominator,
      a.denominator * b.denominator,
    ],
    (a, b) => {
      const aligned = alignDecimals(a, b);
      if (!aligned) return null;
      const { c1, c2, exp } = aligned;
      return [op === "ADD" ? c1 + c2 : c1 - c2, exp];
    },
  );
}

export function evaluateNumericMultiply(
  left: NumericalNode,
  right: NumericalNode,
): NumericalNode | null {
  return evaluateNumericPair(
    left,
    right,
    (a, b) => [a.numerator * b.numerator, a.denominator * b.denominator],
    (a, b) => [a.whole * b.whole, a.exponent + b.exponent],
  );
}

export function evaluateNumericDivide(
  left: NumericalNode,
  right: NumericalNode,
): NumericalNode | null {
  if (left.type !== "FRACTION" && right.type !== "FRACTION") {
    const d1 = toDecimal(left);
    const d2 = toDecimal(right);
    const diff = d1.exponent - d2.exponent;
    if (isAbovePowThreshold(10n, diff)) return null;
    return diff >= 0n
      ? normalizeFraction(d1.whole * 10n ** diff, d2.whole)
      : normalizeFraction(d1.whole, d2.whole * 10n ** -diff);
  }

  const f1 = tryToFraction(left);
  const f2 = tryToFraction(right);
  if (!f1 || !f2) return null;
  return normalizeFraction(
    f1.numerator * f2.denominator,
    f1.denominator * f2.numerator,
  );
}

export function evaluateNumericMod(
  left: NumericalNode,
  right: NumericalNode,
): NumericalNode | null {
  if (left.type !== "FRACTION" && right.type !== "FRACTION") {
    const d1 = toDecimal(left);
    const d2 = toDecimal(right);
    if (
      d1.exponent >= 0n &&
      d2.exponent >= 0n &&
      !isAbovePowThreshold(10n, d2.exponent)
    ) {
      const mod = d2.whole * 10n ** d2.exponent;
      const pow10 = modPow(10n, d1.exponent, mod < 0n ? -mod : mod);
      const rem = ((((d1.whole % mod) * pow10) % mod) + mod) % mod;
      return new Integer(rem);
    }
  }

  return evaluateNumericPair(
    left,
    right,
    (a, b) => {
      const n1 = a.numerator * b.denominator;
      const n2 = b.numerator * a.denominator;
      return [floorMod(n1, n2), a.denominator * b.denominator];
    },
    (a, b) => {
      const aligned = alignDecimals(a, b);
      if (!aligned) return null;
      const { c1, c2, exp } = aligned;
      return [floorMod(c1, c2), exp];
    },
  );
}

export function evaluatePowerMod(
  power: Power,
  right: NumericalNode,
): Integer | null {
  const mod = tryGetIntegerValue(right);
  const exp = tryGetIntegerValue(power.right);
  if (mod === null || mod === 0n || exp === null || exp <= 0n) {
    return null;
  }

  const m = mod < 0n ? -mod : mod;
  if (m === 1n) return ZERO;

  let b: bigint;
  const base = tryGetIntegerValue(power.left);
  if (base !== null) {
    b = floorMod(base, m);
  } else if (power.left.type === "DECIMAL" && power.left.exponent >= 0n) {
    const pow10 = modPow(10n, power.left.exponent, m);
    b = floorMod((power.left.whole % m) * pow10, m);
  } else {
    return null;
  }

  const rem = modPow(b, exp, m);
  return new Integer(floorMod(rem, mod));
}
