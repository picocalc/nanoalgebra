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

      default:
        throw new EvaluatorError("Unknown node type during evaluation");
    }
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
