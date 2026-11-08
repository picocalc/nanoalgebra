import { AlgebraError } from "./errors";
import type { TreeNode } from "./nodes";
import { Decimal, Fraction, Integer } from "./nodes";

export class EvaluatorError extends AlgebraError {
  constructor(message: string) {
    super("EvaluatorError", message);
  }
}

export type NumericalType = Decimal | Integer | Fraction;

export class Evaluator {
  constructor() {}

  public evaluate(node: TreeNode): NumericalType {
    switch (node.type) {
      case "INTEGER":
      case "DECIMAL":
      case "FRACTION":
        return node;

      case "ADD":
      case "SUBTRACT": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        if (left.type === "FRACTION" || right.type === "FRACTION") {
          const f1 = this.toFraction(left);
          const f2 = this.toFraction(right);
          const n =
            node.type === "ADD"
              ? f1.numerator * f2.denominator + f2.numerator * f1.denominator
              : f1.numerator * f2.denominator - f2.numerator * f1.denominator;
          const d = f1.denominator * f2.denominator;
          return this.normalizeFraction(n, d);
        }

        let { whole: c1, exponent: e1 } = this.toDecimal(left);
        let { whole: c2, exponent: e2 } = this.toDecimal(right);

        if (e1 > e2) {
          c1 *= 10n ** (e1 - e2);
          e1 = e2;
        } else if (e2 > e1) {
          c2 *= 10n ** (e2 - e1);
          e2 = e1;
        }

        const coeff = node.type === "ADD" ? c1 + c2 : c1 - c2;
        return this.normalizeDecimal(coeff, e1);
      }

      case "MULTIPLY": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        if (left.type === "FRACTION" || right.type === "FRACTION") {
          const f1 = this.toFraction(left);
          const f2 = this.toFraction(right);
          return this.normalizeFraction(
            f1.numerator * f2.numerator,
            f1.denominator * f2.denominator,
          );
        }

        const decLeft = this.toDecimal(left);
        const decRight = this.toDecimal(right);

        const coeff = decLeft.whole * decRight.whole;
        const exp = decLeft.exponent + decRight.exponent;

        return this.normalizeDecimal(coeff, exp);
      }

      case "DIVIDE": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        const f1 = this.toFraction(left);
        const f2 = this.toFraction(right);

        if (f2.numerator === 0n) throw new EvaluatorError("Division by zero");

        const n = f1.numerator * f2.denominator;
        const d = f1.denominator * f2.numerator;

        return this.normalizeFraction(n, d);
      }

      case "POWER": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        const baseInt = this.tryGetIntegerValue(left);
        const expInt = this.tryGetIntegerValue(right);

        if (baseInt === 1n || expInt === 0n) {
          return new Integer(1);
        }

        if (baseInt === 0n) {
          if (
            (right.type === "FRACTION" && right.numerator < 0n) ||
            (expInt !== null && expInt < 0n)
          ) {
            throw new EvaluatorError("Division by zero in power expression");
          }
          return new Integer(0);
        }

        if (expInt === null) {
          throw new EvaluatorError("Non-integer exponents are not supported");
        }

        return this.evaluatePower(left, expInt);
      }

      default:
        throw new EvaluatorError("Unknown node type during evaluation");
    }
  }

  private tryGetIntegerValue(node: NumericalType): bigint | null {
    if (node.type === "INTEGER") return node.value;
    if (node.type === "DECIMAL") {
      if (node.exponent >= 0n) {
        return node.whole * 10n ** node.exponent;
      }
      return null;
    }
    if (node.denominator === 1n) return node.numerator;
    return null;
  }

  private evaluatePower(base: NumericalType, exp: bigint): NumericalType {
    if (exp > 0n) {
      if (base.type === "INTEGER") {
        return new Integer(base.value ** exp);
      }
      if (base.type === "DECIMAL") {
        const coeff = base.whole ** exp;
        const exponent = base.exponent * exp;
        return this.normalizeDecimal(coeff, exponent);
      }
      return this.normalizeFraction(
        base.numerator ** exp,
        base.denominator ** exp,
      );
    }

    const f = this.toFraction(base);
    return this.normalizeFraction(f.denominator ** -exp, f.numerator ** -exp);
  }

  public toDecimal(node: Decimal | Integer): Decimal {
    if (node.type === "INTEGER") {
      return new Decimal(node.value, 0n);
    }
    return node;
  }

  public toFraction(node: NumericalType): Fraction {
    if (node.type === "FRACTION") return node;
    if (node.type === "INTEGER") return new Fraction(node.value, 1n);

    const s = node.whole;
    const exp = node.exponent;
    if (exp >= 0n) {
      return new Fraction(s * 10n ** exp, 1n);
    } else {
      return new Fraction(s, 10n ** -exp);
    }
  }

  private normalizeDecimal(coeff: bigint, exp: bigint): Decimal | Integer {
    if (coeff === 0n) {
      return new Integer(0);
    }

    while (coeff % 10n === 0n && exp < 0n) {
      coeff /= 10n;
      exp += 1n;
    }

    if (exp === 0n) {
      return new Integer(coeff);
    }
    return new Decimal(coeff, exp);
  }

  private normalizeFraction(n: bigint, d: bigint): Integer | Fraction {
    const frac = new Fraction(n, d);
    if (frac.denominator === 1n) {
      return new Integer(frac.numerator);
    }
    return frac;
  }
}
