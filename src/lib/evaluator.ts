import { AlgebraError } from "./errors";
import type { NumericalNode, TreeNode } from "./nodes";
import { Decimal, Fraction, Integer } from "./nodes";

export class EvaluatorError extends AlgebraError {
  constructor(message: string) {
    super("EvaluatorError", message);
  }
}

export class Evaluator {
  constructor() {}

  public evaluate(node: TreeNode): NumericalNode {
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
          const f1 = Evaluator.toFraction(left);
          const f2 = Evaluator.toFraction(right);
          const n =
            node.type === "ADD"
              ? f1.numerator * f2.denominator + f2.numerator * f1.denominator
              : f1.numerator * f2.denominator - f2.numerator * f1.denominator;
          const d = f1.denominator * f2.denominator;
          return this.normalizeFraction(n, d);
        }

        let { whole: c1, exponent: e1 } = Evaluator.toDecimal(left);
        let { whole: c2, exponent: e2 } = Evaluator.toDecimal(right);

        if (e1 > e2) {
          c1 *= 10n ** (e1 - e2);
          e1 = e2;
        } else if (e2 > e1) {
          c2 *= 10n ** (e2 - e1);
          e2 = e1;
        }

        const coeff = node.type === "ADD" ? c1 + c2 : c1 - c2;
        return Evaluator.normalizeDecimal(coeff, e1);
      }

      case "MULTIPLY": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        if (left.type === "FRACTION" || right.type === "FRACTION") {
          const f1 = Evaluator.toFraction(left);
          const f2 = Evaluator.toFraction(right);
          return this.normalizeFraction(
            f1.numerator * f2.numerator,
            f1.denominator * f2.denominator,
          );
        }

        const decLeft = Evaluator.toDecimal(left);
        const decRight = Evaluator.toDecimal(right);

        const coeff = decLeft.whole * decRight.whole;
        const exp = decLeft.exponent + decRight.exponent;

        return Evaluator.normalizeDecimal(coeff, exp);
      }

      case "DIVIDE": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        const f1 = Evaluator.toFraction(left);
        const f2 = Evaluator.toFraction(right);

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

  private tryGetIntegerValue(node: NumericalNode): bigint | null {
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

  private evaluatePower(base: NumericalNode, exp: bigint): NumericalNode {
    if (exp > 0n) {
      if (base.type === "INTEGER") {
        return new Integer(base.value ** exp);
      }
      if (base.type === "DECIMAL") {
        const coeff = base.whole ** exp;
        const exponent = base.exponent * exp;
        return Evaluator.normalizeDecimal(coeff, exponent);
      }
      return this.normalizeFraction(
        base.numerator ** exp,
        base.denominator ** exp,
      );
    }

    const f = Evaluator.toFraction(base);
    return this.normalizeFraction(f.denominator ** -exp, f.numerator ** -exp);
  }

  private static normalizeDecimal(
    coeff: bigint,
    exp: bigint,
  ): Decimal | Integer {
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

  static toDecimal(node: Decimal | Integer): Decimal {
    if (node.type === "INTEGER") {
      return new Decimal(node.value, 0n);
    }
    return node;
  }

  static toFraction(node: NumericalNode): Fraction {
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

  static asDecimal(
    node: NumericalNode,
    {
      sigFigs = 30,
      roundingMode = "round",
    }: { sigFigs?: number; roundingMode?: "round" | "truncate" } = {},
  ): Decimal | Integer {
    if (sigFigs <= 0) {
      throw new EvaluatorError("Significant figures must be greater than 0");
    }

    if (node.type === "INTEGER") {
      return node;
    }

    let { numerator: num, denominator: den } = Evaluator.toFraction(node);

    if (num === 0n) {
      return new Integer(0);
    }

    const isNegative = num < 0n;
    if (isNegative) {
      num = -num;
    }

    let scaleExp = 0n;
    while (num < den) {
      num *= 10n;
      scaleExp -= 1n;
    }
    while (num >= den * 10n) {
      den *= 10n;
      scaleExp += 1n;
    }

    let coeff = 0n;
    let currentNum = num;
    const targetDigits = BigInt(sigFigs);
    const totalDigitsToGen = targetDigits + 1n;

    for (let i = 0n; i < totalDigitsToGen; i++) {
      coeff = coeff * 10n + currentNum / den;
      currentNum = (currentNum % den) * 10n;
    }

    const extraDigit = coeff % 10n;
    coeff /= 10n;

    if (roundingMode === "round" && extraDigit >= 5n) {
      coeff += 1n;
    }

    const finalExp = scaleExp - (targetDigits - 1n);

    if (isNegative) {
      coeff = -coeff;
    }

    return Evaluator.normalizeDecimal(coeff, finalExp);
  }
}
