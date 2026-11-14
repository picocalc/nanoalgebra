import { powBitLength } from "bigint.bitlength";

import { AlgebraError } from "./errors";
import type {
  NumericalNode,
  SymbolicNode,
  DefinedNode,
  TreeNode,
} from "./nodes";
import {
  Add,
  Decimal,
  Divide,
  Fraction,
  FunctionCall,
  Integer,
  isNumerical,
  Modulo,
  Multiply,
  Power,
  Subtract,
  Undefined,
} from "./nodes";
import { isZero, negate, POW_BITS_THRESHOLD } from "./shared";

export class EvaluatorError extends AlgebraError {
  constructor(message: string) {
    super("EvaluatorError", message);
  }
}

type SymbolDomain = "positive" | "negative" | "real" | "complex";

export interface EvaluatorOptions {
  constants?: ReadonlyMap<string, SymbolDomain>;
  complex?: boolean;
}

export const constants: ReadonlyMap<string, SymbolDomain> = new Map<
  string,
  SymbolDomain
>([
  ["pi", "positive"],
  ["e", "positive"],
]);

export class Evaluator {
  constructor(readonly options: Readonly<EvaluatorOptions> = { constants }) {}

  public simplify(node: TreeNode): TreeNode {
    switch (node.type) {
      case "INTEGER":
      case "DECIMAL":
      case "FRACTION":
      case "SYMBOL":
      case "UNDEFINED":
        return node;

      case "ADD":
      case "SUBTRACT": {
        const left = this.simplify(node.left);
        const right = this.simplify(node.right);

        const simplified =
          node.type === "ADD"
            ? new Add(left, right)
            : new Subtract(left, right);

        if (left.type === "UNDEFINED" || right.type === "UNDEFINED")
          return new Undefined(simplified);

        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericBinary(left, right, node.type);
        }

        const combined = this.tryCombineTerms(left, right, node.type);
        if (combined !== null) return combined;

        if (isZero(left))
          return node.type === "ADD" ? right : this.simplify(negate(right));
        if (isZero(right)) return left;

        return simplified;
      }

      case "MULTIPLY": {
        const left = this.simplify(node.left);
        const right = this.simplify(node.right);
        const simplified = new Multiply(left, right);
        if (left.type === "UNDEFINED" || right.type === "UNDEFINED")
          return new Undefined(simplified);
        if (this.isOne(left)) return right;
        if (this.isOne(right)) return left;
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericMultiply(left, right);
        }
        return this.tryMultiplySymbolic(left, right) ?? simplified;
      }

      case "DIVIDE": {
        const left = this.simplify(node.left);
        const right = this.simplify(node.right);
        const simplified = new Divide(left, right);
        if (
          left.type === "UNDEFINED" ||
          right.type === "UNDEFINED" ||
          isZero(right)
        )
          return new Undefined(simplified);
        if (isZero(left)) return new Integer(0);
        if (this.isOne(right)) return left;

        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericDivide(left, right);
        }

        return this.tryDivideSymbolic(left, right) ?? simplified;
      }

      case "MOD": {
        const left = this.simplify(node.left);
        const right = this.simplify(node.right);
        const simplified = new Modulo(left, right);
        if (
          left.type === "UNDEFINED" ||
          right.type === "UNDEFINED" ||
          isZero(right)
        )
          return new Undefined(simplified);
        if (isZero(left)) return new Integer(0);
        if (!isNumerical(left) || !isNumerical(right)) return simplified;
        return this.evaluateNumericMod(left, right);
      }

      case "POWER": {
        const left = this.simplify(node.left);
        const right = this.simplify(node.right);
        const simplified = new Power(left, right);
        if (left.type === "UNDEFINED" || right.type === "UNDEFINED")
          return new Undefined(simplified);

        const expInt = this.tryGetIntegerValue(right);
        const baseInt = this.tryGetIntegerValue(left);

        if (
          left.type === "FUNCTION" &&
          left.name === "abs" &&
          expInt !== null &&
          expInt % 2n === 0n &&
          (!this.options.complex || this.isReal(left.args[0]))
        ) {
          return this.simplify(new Power(left.args[0], right));
        }

        if (expInt === 1n) return left;
        if (expInt === 0n) return new Integer(1);
        if (baseInt === 1n) return new Integer(1);
        if (baseInt === 0n) {
          if (
            (right.type === "FRACTION" && right.numerator < 0n) ||
            (expInt !== null && expInt < 0n)
          ) {
            return new Undefined(simplified);
          }
          return new Integer(0);
        }

        if (isNumerical(left) && isNumerical(right) && expInt !== null) {
          return this.evaluatePower(left, expInt);
        }

        return this.tryExponentiateSymbolic(left, right, expInt) ?? simplified;
      }

      case "FUNCTION": {
        const {
          name,
          args: [first, ...rest],
        } = node;

        const args = [
          this.simplify(first),
          ...rest.map((n) => this.simplify(n)),
        ] as const;

        if (name === "abs" && args.length === 1) {
          return this.evaluateAbs(args[0]);
        }

        if (name === "sqrt" && args.length === 1) {
          return this.simplify(new Power(args[0], new Fraction(1n, 2n)));
        }

        return new FunctionCall(name, args);
      }
    }
  }

  private evaluateAbs(node: TreeNode): TreeNode {
    if (isNumerical(node)) {
      return this.evaluateNumericAbs(node);
    }
    if (this.isPositive(node)) {
      return node;
    }
    if (node.type === "MULTIPLY" && isNumerical(node.left)) {
      const absCoeff = this.evaluateNumericAbs(node.left);
      const absRight = this.evaluateAbs(node.right);
      if (this.isOne(absCoeff)) return absRight;
      return this.simplify(new Multiply(absCoeff, absRight));
    }
    return new FunctionCall("abs", [node]);
  }

  private isNonZero(node: TreeNode): boolean {
    if (isNumerical(node)) {
      return !isZero(node);
    }
    if (node.type === "SYMBOL") {
      const domain = this.options.constants?.get(node.name);
      return domain === "positive" || domain === "negative";
    }
    if (node.type === "POWER") {
      return this.isNonZero(node.left);
    }
    if (node.type === "MULTIPLY") {
      return this.isNonZero(node.left) && this.isNonZero(node.right);
    }
    return false;
  }

  private isReal(node: TreeNode): boolean {
    if (!this.options.complex) return true;
    if (isNumerical(node)) return true;
    if (node.type === "SYMBOL") {
      const domain = this.options.constants?.get(node.name);
      return (
        domain === "positive" || domain === "negative" || domain === "real"
      );
    }
    if (node.type === "FUNCTION" && node.name === "abs") {
      return true;
    }
    if (node.type === "POWER") {
      if (this.isReal(node.left)) {
        const expInt = this.tryGetIntegerValue(node.right);
        if (expInt !== null) return true;
        if (this.isPositive(node.left) && this.isReal(node.right)) return true;
      }
      return false;
    }
    return false;
  }

  private isPositive(node: TreeNode): boolean {
    if (isNumerical(node)) {
      const frac = Evaluator.toFraction(node);
      return frac.numerator >= 0n;
    }
    if (node.type === "SYMBOL") {
      return this.options.constants?.get(node.name) === "positive";
    }
    if (node.type === "FUNCTION" && node.name === "abs") {
      return true;
    }
    if (node.type === "POWER") {
      const expInt = this.tryGetIntegerValue(node.right);
      if (expInt !== null && expInt % 2n === 0n && this.isReal(node.left)) {
        return true;
      }
      return this.isPositive(node.left) && this.isReal(node.right);
    }
    return false;
  }

  private isOne(node: TreeNode): boolean {
    return this.tryGetIntegerValue(node) === 1n;
  }

  private isEvenRoot(exp: TreeNode): boolean {
    if (!isNumerical(exp)) return false;
    const frac = Evaluator.toFraction(exp);
    return frac.denominator % 2n === 0n;
  }

  private extractTerm(
    node: TreeNode,
  ):
    | { coeff: NumericalNode; symbolNode: SymbolicNode | null }
    | { coeff: Integer; symbolNode: TreeNode } {
    if (isNumerical(node)) {
      return { coeff: node, symbolNode: null };
    }
    if (
      node.type === "MULTIPLY" &&
      isNumerical(node.left) &&
      (node.right.type === "SYMBOL" ||
        node.right.type === "POWER" ||
        node.right.type === "FUNCTION")
    ) {
      return { coeff: node.left, symbolNode: node.right };
    }
    return { coeff: new Integer(1), symbolNode: node };
  }

  private tryCombineTerms(
    left: DefinedNode,
    right: DefinedNode,
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

      if (isZero(newCoeff)) return new Integer(0);
      if (this.isOne(newCoeff)) return t1.symbolNode;
      return new Multiply(newCoeff, t1.symbolNode);
    }

    return null;
  }

  private getBaseAndExp(
    node: TreeNode,
  ): { base: TreeNode; exp: NumericalNode } | null {
    if (node.type === "SYMBOL" || node.type === "FUNCTION") {
      return { base: node, exp: new Integer(1) };
    }
    if (node.type === "POWER" && isNumerical(node.right)) {
      return { base: node.left, exp: node.right };
    }
    return null;
  }

  private tryMultiplySymbolic(
    left: DefinedNode,
    right: DefinedNode,
  ): TreeNode | null {
    if (left.type === "DIVIDE" && right.type === "DIVIDE") {
      return this.simplify(
        new Divide(
          new Multiply(left.left, right.left),
          new Multiply(left.right, right.right),
        ),
      );
    }
    if (left.type === "DIVIDE") {
      return this.simplify(
        new Divide(new Multiply(left.left, right), left.right),
      );
    }
    if (right.type === "DIVIDE") {
      return this.simplify(
        new Divide(new Multiply(left, right.left), right.right),
      );
    }

    const t1 = this.extractTerm(left);
    const t2 = this.extractTerm(right);

    if (t1.symbolNode === null && t2.symbolNode !== null) {
      const combinedCoeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);
      if (isZero(combinedCoeff)) return new Integer(0);
      if (this.isOne(combinedCoeff)) return t2.symbolNode;
      return new Multiply(combinedCoeff, t2.symbolNode);
    }
    if (t2.symbolNode === null && t1.symbolNode !== null) {
      const combinedCoeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);
      if (isZero(combinedCoeff)) return new Integer(0);
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

      if (
        !this.options.complex &&
        !this.isPositive(leftInfo.base) &&
        (this.isEvenRoot(leftInfo.exp) || this.isEvenRoot(rightInfo.exp)) &&
        !this.isEvenRoot(totalExp)
      ) {
        if (
          t1.symbolNode &&
          t2.symbolNode &&
          t1.symbolNode.print() === t2.symbolNode.print()
        ) {
          const squared = new Power(t1.symbolNode, new Integer(2));
          if (this.isOne(combinedCoeff)) return squared;
          return new Multiply(combinedCoeff, squared);
        }
        return null;
      }

      const result = isZero(totalExp)
        ? new Integer(1)
        : this.isOne(totalExp)
          ? leftInfo.base
          : this.simplify(new Power(leftInfo.base, totalExp));

      if (this.isOne(combinedCoeff)) return result;
      if (this.isOne(result)) return combinedCoeff;
      return this.simplify(new Multiply(combinedCoeff, result));
    }

    return null;
  }

  private tryDivideSymbolic(
    left: DefinedNode,
    right: DefinedNode,
  ): TreeNode | null {
    if (left.type === "DIVIDE") {
      return this.simplify(
        new Divide(left.left, new Multiply(left.right, right)),
      );
    }

    const t1 = this.extractTerm(left);
    const t2 = this.extractTerm(right);

    const rightInfo = t2.symbolNode ? this.getBaseAndExp(t2.symbolNode) : null;

    const leftInfo = t1.symbolNode
      ? this.getBaseAndExp(t1.symbolNode)
      : rightInfo
        ? { base: rightInfo.base, exp: new Integer(0) }
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

      if (
        !this.options.complex &&
        !this.isPositive(leftInfo.base) &&
        (this.isEvenRoot(leftInfo.exp) || this.isEvenRoot(rightInfo.exp)) &&
        !this.isEvenRoot(totalExp)
      ) {
        return null;
      }

      if (isZero(totalExp) && !this.isNonZero(leftInfo.base)) {
        return null;
      }

      const result = isZero(totalExp)
        ? new Integer(1)
        : this.isOne(totalExp)
          ? leftInfo.base
          : this.simplify(new Power(leftInfo.base, totalExp));

      if (this.isOne(combinedCoeff)) return result;
      if (this.isOne(result)) return combinedCoeff;
      return this.simplify(new Multiply(combinedCoeff, result));
    }

    if (t1.symbolNode && t2.symbolNode === null) {
      const reducedCoeff = this.evaluateNumericDivide(t1.coeff, t2.coeff);
      if (isZero(reducedCoeff)) return new Integer(0);
      if (this.isOne(reducedCoeff)) return t1.symbolNode;
      return new Multiply(reducedCoeff, t1.symbolNode);
    }

    return null;
  }

  private tryExponentiateSymbolic(
    left: DefinedNode,
    right: DefinedNode,
    expInt: bigint | null,
  ): TreeNode | null {
    if (left.type === "POWER") {
      const innerBase = left.left;
      const innerExp = left.right;
      const innerExpInt = this.tryGetIntegerValue(innerExp);
      const newExp = this.simplify(new Multiply(innerExp, right));

      const rightFrac = isNumerical(right) ? Evaluator.toFraction(right) : null;

      if (
        this.isOne(newExp) &&
        innerExpInt !== null &&
        innerExpInt % 2n === 0n &&
        rightFrac !== null &&
        rightFrac.denominator % 2n === 0n
      ) {
        if (this.isPositive(innerBase)) {
          return innerBase;
        }
        if (this.options.complex) {
          return null;
        }
        return this.simplify(new FunctionCall("abs", [innerBase]));
      }

      if (
        this.options.complex &&
        !this.isPositive(innerBase) &&
        expInt === null
      ) {
        return null;
      }

      if (
        !this.options.complex &&
        !this.isPositive(innerBase) &&
        this.isEvenRoot(innerExp) &&
        !this.isEvenRoot(newExp)
      ) {
        return null;
      }

      return this.simplify(new Power(innerBase, newExp));
    }

    if (left.type === "MULTIPLY" && expInt !== null && expInt !== 0n) {
      const lTerm = this.extractTerm(left.left);
      const rTerm = this.extractTerm(left.right);
      if (lTerm.symbolNode === null && rTerm.symbolNode !== null) {
        const newCoeff = this.evaluatePower(lTerm.coeff, expInt);
        const newPower = this.simplify(new Power(rTerm.symbolNode, right));
        if (this.isOne(newCoeff)) return newPower;
        return this.simplify(new Multiply(newCoeff, newPower));
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

      const q = a.denominator * b.denominator;
      const n1 = a.numerator * (q / a.denominator);
      const n2 = b.numerator * (q / b.denominator);
      const n = ((n1 % n2) + n2) % n2;

      return this.normalizeFraction(n, q);
    }

    const f2 = Evaluator.toDecimal(right);
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

  private evaluatePower(
    base: NumericalNode,
    exp: bigint,
  ): NumericalNode | Power {
    if (exp > 0n) {
      if (base.type === "INTEGER") {
        if (powBitLength(base.value, exp) > POW_BITS_THRESHOLD) {
          return new Power(base, new Integer(exp));
        }
        return new Integer(base.value ** exp);
      }
      if (base.type === "DECIMAL") {
        if (
          powBitLength(base.whole, exp) > POW_BITS_THRESHOLD ||
          base.exponent * exp > POW_BITS_THRESHOLD ||
          base.exponent * exp < -POW_BITS_THRESHOLD
        ) {
          return new Power(base, new Integer(exp));
        }
        const coeff = base.whole ** exp;
        const exponent = base.exponent * exp;
        return Evaluator.normalizeDecimal(coeff, exponent);
      }
      if (
        powBitLength(base.numerator, exp) > POW_BITS_THRESHOLD ||
        powBitLength(base.denominator, exp) > POW_BITS_THRESHOLD
      ) {
        return new Power(base, new Integer(exp));
      }
      return this.normalizeFraction(
        base.numerator ** exp,
        base.denominator ** exp,
      );
    }

    const e = -exp;
    const f = Evaluator.toFraction(base);
    if (
      powBitLength(f.denominator, e) > POW_BITS_THRESHOLD ||
      powBitLength(f.numerator, e) > POW_BITS_THRESHOLD
    ) {
      return new Power(base, new Integer(exp));
    }
    return this.normalizeFraction(f.denominator ** e, f.numerator ** e);
  }

  private evaluateNumericAbs(node: NumericalNode): NumericalNode {
    if (node.type === "INTEGER") {
      return node.value < 0n ? new Integer(-node.value) : node;
    }
    if (node.type === "DECIMAL") {
      return node.whole < 0n
        ? Evaluator.normalizeDecimal(-node.whole, node.exponent)
        : node;
    }
    return node.numerator < 0n
      ? this.normalizeFraction(-node.numerator, node.denominator)
      : node;
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
    const targetDigits = BigInt(sigFigs);
    const totalDigitsToGen = targetDigits + 1n;

    for (let i = 0n; i < totalDigitsToGen; i++) {
      coeff = coeff * 10n + num / den;
      num = (num % den) * 10n;
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
