import { AlgebraError } from "./errors";
import type { NumericalNode, SymbolicNode, TreeNode } from "./nodes";
import {
  Add,
  Decimal,
  Divide,
  Fraction,
  Integer,
  isNumerical,
  Multiply,
  Power,
  Subtract,
} from "./nodes";

export class EvaluatorError extends AlgebraError {
  constructor(message: string) {
    super("EvaluatorError", message);
  }
}

export class Evaluator {
  constructor() {}

  public evaluate(node: TreeNode): TreeNode {
    switch (node.type) {
      case "INTEGER":
      case "DECIMAL":
      case "FRACTION":
      case "SYMBOL":
        return node;

      case "ADD":
      case "SUBTRACT": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericBinary(left, right, node.type);
        }

        const combined = this.tryCombineTerms(left, right, node.type);
        if (combined !== null) return combined;

        if (this.isZero(left))
          return node.type === "ADD" ? right : this.negate(right);
        if (this.isZero(right)) return left;

        return node.type === "ADD"
          ? new Add(left, right)
          : new Subtract(left, right);
      }

      case "MULTIPLY": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        if (this.isZero(left) || this.isZero(right)) return new Integer(0);
        if (this.isOne(left)) return right;
        if (this.isOne(right)) return left;

        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericMultiply(left, right);
        }

        const simplified = this.tryMultiplySymbolic(left, right);
        return simplified ?? new Multiply(left, right);
      }

      case "DIVIDE": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        if (this.isZero(right)) throw new EvaluatorError("Division by zero");
        if (this.isZero(left)) return new Integer(0);
        if (this.isOne(right)) return left;

        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericDivide(left, right);
        }

        return this.tryDivideSymbolic(left, right) ?? new Divide(left, right);
      }

      case "MOD": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        if (!isNumerical(left) || !isNumerical(right))
          throw new EvaluatorError("Modulo supported for numbers currently");
        return this.evaluateNumericMod(left, right);
      }

      case "POWER": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);

        const expInt = this.tryGetIntegerValue(right);
        const baseInt = this.tryGetIntegerValue(left);

        if (expInt === 1n) return left;
        if (expInt === 0n) return new Integer(1);
        if (baseInt === 1n) return new Integer(1);
        if (baseInt === 0n) {
          if (
            (right.type === "FRACTION" && right.numerator < 0n) ||
            (expInt !== null && expInt < 0n)
          ) {
            throw new EvaluatorError("Division by zero in power expression");
          }
          return new Integer(0);
        }

        if (isNumerical(left) && (isNumerical(right) || expInt !== null)) {
          if (expInt === null) {
            throw new EvaluatorError(
              "Fractional and decimal exponents are currently unsupported",
            );
          }
          return this.evaluatePower(left, expInt);
        }

        const simplified = this.tryExponentiateSymbolic(left, right, expInt);
        return simplified ?? new Power(left, right);
      }
    }
  }

  private isZero(node: TreeNode): boolean {
    return this.tryGetIntegerValue(node) === 0n;
  }

  private isOne(node: TreeNode): boolean {
    return this.tryGetIntegerValue(node) === 1n;
  }

  private negate(node: TreeNode): TreeNode {
    return new Multiply(new Integer(-1), node);
  }

  private extractTerm(
    node: TreeNode,
  ):
    | { coeff: NumericalNode; symbolNode: SymbolicNode | null }
    | { coeff: Integer; symbolNode: SymbolicNode } {
    if (isNumerical(node)) {
      return { coeff: node, symbolNode: null };
    }
    if (
      node.type === "MULTIPLY" &&
      isNumerical(node.left) &&
      (node.right.type === "SYMBOL" || node.right.type === "POWER")
    ) {
      return { coeff: node.left, symbolNode: node.right };
    }
    return { coeff: new Integer(1), symbolNode: node };
  }

  private tryCombineTerms(
    left: TreeNode,
    right: TreeNode,
    op: "ADD" | "SUBTRACT",
  ): TreeNode | null {
    const t1 = this.extractTerm(left);
    const t2 = this.extractTerm(right);

    if (
      t1.symbolNode &&
      t2.symbolNode &&
      t1.symbolNode.print() === t2.symbolNode.print()
    ) {
      const newCoeff = this.evaluateNumericBinary(
        t1.coeff,
        op === "ADD" ? t2.coeff : this.negateNumeric(t2.coeff),
        "ADD",
      );

      if (this.isZero(newCoeff)) return new Integer(0);
      if (this.isOne(newCoeff)) return t1.symbolNode;
      return new Multiply(newCoeff, t1.symbolNode);
    }

    return null;
  }

  private getBaseAndExp(
    node: SymbolicNode,
  ): { base: TreeNode; exp: NumericalNode } | null {
    if (node.type === "SYMBOL") {
      return { base: node, exp: new Integer(1) };
    }
    if (node.type === "POWER" && isNumerical(node.right)) {
      return { base: node.left, exp: node.right };
    }
    return null;
  }

  private tryMultiplySymbolic(
    left: TreeNode,
    right: TreeNode,
  ): TreeNode | null {
    const t1 = this.extractTerm(left);
    const t2 = this.extractTerm(right);

    if (t1.symbolNode === null && t2.symbolNode !== null) {
      const combinedCoeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);
      if (this.isZero(combinedCoeff)) return new Integer(0);
      if (this.isOne(combinedCoeff)) return t2.symbolNode;
      return new Multiply(combinedCoeff, t2.symbolNode);
    }
    if (t2.symbolNode === null && t1.symbolNode !== null) {
      const combinedCoeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);
      if (this.isZero(combinedCoeff)) return new Integer(0);
      if (this.isOne(combinedCoeff)) return t1.symbolNode;
      return new Multiply(combinedCoeff, t1.symbolNode);
    }

    if (left.print() === right.print() && left.type === "SYMBOL") {
      return new Power(left, new Integer(2));
    }

    const leftInfo = t1.symbolNode ? this.getBaseAndExp(t1.symbolNode) : null;
    const rightInfo = t2.symbolNode ? this.getBaseAndExp(t2.symbolNode) : null;

    if (
      leftInfo &&
      rightInfo &&
      leftInfo.base.print() === rightInfo.base.print()
    ) {
      const totalExp = this.evaluateNumericBinary(
        leftInfo.exp,
        rightInfo.exp,
        "ADD",
      );
      const combinedCoeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);

      let result: TreeNode;
      if (this.isZero(totalExp)) {
        result = new Integer(1);
      } else if (this.isOne(totalExp)) {
        result = leftInfo.base;
      } else {
        result = new Power(leftInfo.base, totalExp);
      }

      if (this.isOne(combinedCoeff)) return result;
      if (this.isOne(result)) return combinedCoeff;
      return new Multiply(combinedCoeff, result);
    }

    return null;
  }

  private tryDivideSymbolic(left: TreeNode, right: TreeNode): TreeNode | null {
    const t1 = this.extractTerm(left);
    const t2 = this.extractTerm(right);

    const rightInfo = t2.symbolNode ? this.getBaseAndExp(t2.symbolNode) : null;

    const leftInfo = t1.symbolNode
      ? this.getBaseAndExp(t1.symbolNode)
      : rightInfo
        ? { base: rightInfo.base, exp: new Integer(0n) }
        : null;

    if (
      leftInfo &&
      rightInfo &&
      leftInfo.base.print() === rightInfo.base.print()
    ) {
      const totalExp = this.evaluateNumericBinary(
        leftInfo.exp,
        rightInfo.exp,
        "SUBTRACT",
      );
      const combinedCoeff = this.evaluateNumericDivide(t1.coeff, t2.coeff);

      let result: TreeNode;
      if (this.isZero(totalExp)) {
        result = new Integer(1);
      } else if (this.isOne(totalExp)) {
        result = leftInfo.base;
      } else {
        result = new Power(leftInfo.base, totalExp);
      }

      if (this.isOne(combinedCoeff)) return result;
      if (this.isOne(result)) return combinedCoeff;
      return new Multiply(combinedCoeff, result);
    }

    if (t1.symbolNode && t2.symbolNode === null) {
      const reducedCoeff = this.evaluateNumericDivide(t1.coeff, t2.coeff);
      if (this.isZero(reducedCoeff)) return new Integer(0);
      if (this.isOne(reducedCoeff)) return t1.symbolNode;
      return new Multiply(reducedCoeff, t1.symbolNode);
    }

    return null;
  }

  private tryExponentiateSymbolic(
    left: TreeNode,
    right: TreeNode,
    expInt: bigint | null,
  ): TreeNode | null {
    if (left.type === "POWER") {
      const innerBase = left.left;
      const innerExp = left.right;
      const newExp = this.evaluate(new Multiply(innerExp, right));
      return this.evaluate(new Power(innerBase, newExp));
    }

    if (left.type === "MULTIPLY" && expInt !== null && expInt !== 0n) {
      const lTerm = this.extractTerm(left.left);
      const rTerm = this.extractTerm(left.right);
      if (lTerm.symbolNode === null && rTerm.symbolNode !== null) {
        const newCoeff = this.evaluatePower(lTerm.coeff, expInt);
        const newPower = this.evaluate(new Power(rTerm.symbolNode, right));
        if (this.isOne(newCoeff)) return newPower;
        return new Multiply(newCoeff, newPower);
      }
    }

    return null;
  }

  private negateNumeric(node: NumericalNode): Integer | Fraction {
    const f = Evaluator.toFraction(node);
    return this.normalizeFraction(-f.numerator, f.denominator);
  }

  private evaluateNumericBinary(
    left: NumericalNode,
    right: NumericalNode,
    op: "ADD" | "SUBTRACT",
  ): NumericalNode {
    if (left.type === "FRACTION" || right.type === "FRACTION") {
      const f1 = Evaluator.toFraction(left);
      const f2 = Evaluator.toFraction(right);
      const n =
        op === "ADD"
          ? f1.numerator * f2.denominator + f2.numerator * f1.denominator
          : f1.numerator * f2.denominator - f2.numerator * f1.denominator;
      return this.normalizeFraction(n, f1.denominator * f2.denominator);
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

    const coeff = op === "ADD" ? c1 + c2 : c1 - c2;
    return Evaluator.normalizeDecimal(coeff, e1);
  }

  private evaluateNumericMultiply(
    left: NumericalNode,
    right: NumericalNode,
  ): NumericalNode {
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

    return Evaluator.normalizeDecimal(
      decLeft.whole * decRight.whole,
      decLeft.exponent + decRight.exponent,
    );
  }

  private evaluateNumericDivide(
    left: NumericalNode,
    right: NumericalNode,
  ): NumericalNode {
    const f1 = Evaluator.toFraction(left);
    const f2 = Evaluator.toFraction(right);
    const n = f1.numerator * f2.denominator;
    const d = f1.denominator * f2.numerator;
    return this.normalizeFraction(n, d);
  }

  private evaluateNumericMod(
    left: NumericalNode,
    right: NumericalNode,
  ): NumericalNode {
    if (left.type === "FRACTION" || right.type === "FRACTION") {
      const a = Evaluator.toFraction(left);
      const b = Evaluator.toFraction(right);
      if (b.numerator === 0n) throw new EvaluatorError("Modulo by zero");

      const q = a.denominator * b.denominator;
      const n1 = a.numerator * (q / a.denominator);
      const n2 = b.numerator * (q / b.denominator);
      const n = ((n1 % n2) + n2) % n2;

      return this.normalizeFraction(n, q);
    }

    const f2 = Evaluator.toDecimal(right);

    if (f2.whole === 0n) {
      throw new EvaluatorError("Modulo by zero");
    }

    const f1 = Evaluator.toDecimal(left);

    const e1 = f1.exponent;
    const e2 = f2.exponent;

    const minExp = e1 < e2 ? e1 : e2;
    const c1 = f1.whole * (e1 > minExp ? 10n ** (e1 - minExp) : 1n);
    const c2 = f2.whole * (e2 > minExp ? 10n ** (e2 - minExp) : 1n);

    const c = ((c1 % c2) + c2) % c2;
    return Evaluator.normalizeDecimal(c, minExp);
  }

  private tryGetIntegerValue(node: TreeNode): bigint | null {
    if (node.type === "INTEGER") return node.value;
    if (node.type === "DECIMAL" && node.exponent >= 0n) {
      return node.whole * 10n ** node.exponent;
    }
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
    if (coeff === 0n) return new Integer(0);

    while (coeff % 10n === 0n && exp < 0n) {
      coeff /= 10n;
      exp += 1n;
    }

    if (exp === 0n) return new Integer(coeff);
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
    return exp >= 0n
      ? new Fraction(s * 10n ** exp, 1n)
      : new Fraction(s, 10n ** -exp);
  }

  static asDecimal(
    node: TreeNode,
    {
      sigFigs = 30,
      roundingMode = "round",
    }: { sigFigs?: number; roundingMode?: "round" | "truncate" } = {},
  ): Decimal | Integer {
    if (sigFigs <= 0) {
      throw new EvaluatorError("Significant figures must be greater than 0");
    }

    if (!isNumerical(node)) {
      throw new EvaluatorError(
        `Cannot convert node type ${node.type} to decimal directly`,
      );
    }

    if (node.type === "INTEGER") return node;

    let { numerator: num, denominator: den } = Evaluator.toFraction(node);
    if (num === 0n) return new Integer(0);

    const isNegative = num < 0n;
    if (isNegative) num = -num;

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
    if (isNegative) coeff = -coeff;

    return Evaluator.normalizeDecimal(coeff, finalExp);
  }
}
