import { powBitLength } from "bigint.bitlength";

import { AlgebraError } from "./errors";
import type { DefinedNode, NumericalNode, TreeNode } from "./nodes";
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
import { isNegative, isZero, negate, POW_BITS_THRESHOLD } from "./shared";

export class EvaluatorError extends AlgebraError {
  constructor(message: string) {
    super("EvaluatorError", message);
  }
}

type SymbolDomain = "positive" | "negative" | "real" | "complex";
type BinaryOpType =
  | "ADD"
  | "SUBTRACT"
  | "MULTIPLY"
  | "DIVIDE"
  | "MOD"
  | "POWER";

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
  private static readonly ZERO = new Integer(0);
  private static readonly ONE = new Integer(1);

  constructor(readonly options: Readonly<EvaluatorOptions> = { constants }) {}

  public simplify(node: TreeNode): TreeNode {
    switch (node.type) {
      case "INTEGER":
      case "DECIMAL":
      case "FRACTION":
      case "SYMBOL":
      case "UNDEFINED":
        return node;

      case "FUNCTION": {
        const {
          name,
          args: [first, ...rest],
        } = node;
        const args = [
          this.simplify(first),
          ...rest.map((n) => this.simplify(n)),
        ] as const;

        if (name === "abs" && args.length === 1)
          return this.evaluateAbs(args[0]);
        if (name === "sqrt" && args.length === 1) {
          return this.simplify(new Power(args[0], new Fraction(1n, 2n)));
        }
        return new FunctionCall(name, args);
      }

      default:
        return this.simplifyBinary(node);
    }
  }

  private simplifyBinary(
    node: Extract<TreeNode, { type: BinaryOpType }>,
  ): TreeNode {
    const left = this.simplify(node.left);
    const right = this.simplify(node.right);
    const simplified = this.rebuildBinary(node.type, left, right);

    if (left.type === "UNDEFINED" || right.type === "UNDEFINED") {
      return new Undefined(simplified);
    }

    switch (node.type) {
      case "ADD":
      case "SUBTRACT": {
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericBinary(left, right, node.type);
        }
        const combined = this.tryCombineTerms(left, right, node.type);
        if (combined !== null) return combined;
        if (isZero(left)) {
          return node.type === "ADD" ? right : this.simplify(negate(right));
        }
        return isZero(right) ? left : simplified;
      }

      case "MULTIPLY": {
        if (this.isOne(left)) return right;
        if (this.isOne(right)) return left;
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericMultiply(left, right);
        }
        return this.tryMultiplySymbolic(left, right) ?? simplified;
      }

      case "DIVIDE": {
        if (isZero(right)) return new Undefined(simplified);
        if (this.isOne(right)) return left;
        if (isZero(left)) {
          if (this.isNonZero(right)) return Evaluator.ZERO;
          const den = this.simplifyZeroNumeratorDenominator(right);
          return den === right ? simplified : new Divide(left, den);
        }
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericDivide(left, right);
        }
        return this.tryDivideSymbolic(left, right) ?? simplified;
      }

      case "MOD": {
        if (isZero(right)) return new Undefined(simplified);
        if (isZero(left)) return Evaluator.ZERO;
        return isNumerical(left) && isNumerical(right)
          ? this.evaluateNumericMod(left, right)
          : simplified;
      }

      case "POWER": {
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
        if (expInt === 0n || baseInt === 1n) return Evaluator.ONE;
        if (baseInt === 0n) {
          return isNumerical(right) && isNegative(right)
            ? new Undefined(simplified)
            : Evaluator.ZERO;
        }
        if (isNumerical(left) && isNumerical(right) && expInt !== null) {
          return this.evaluatePower(left, expInt);
        }
        return this.tryExponentiateSymbolic(left, right, expInt) ?? simplified;
      }
    }
  }

  private rebuildBinary(
    type: BinaryOpType,
    left: TreeNode,
    right: TreeNode,
  ): DefinedNode {
    switch (type) {
      case "ADD":
        return new Add(left, right);
      case "SUBTRACT":
        return new Subtract(left, right);
      case "MULTIPLY":
        return new Multiply(left, right);
      case "DIVIDE":
        return new Divide(left, right);
      case "MOD":
        return new Modulo(left, right);
      case "POWER":
        return new Power(left, right);
    }
  }

  private evaluateAbs(node: TreeNode): TreeNode {
    if (isNumerical(node)) return this.evaluateNumericAbs(node);
    if (this.isPositive(node)) return node;
    if (node.type === "MULTIPLY") {
      const { coeff, factors } = this.extractFactors(node);
      if (!this.isOne(coeff)) {
        return this.withCoeff(
          this.evaluateNumericAbs(coeff),
          this.evaluateAbs(this.multiplyAll(factors)),
          true,
        );
      }
    }
    if (node.type === "DIVIDE") {
      const num = this.evaluateAbs(node.left);
      const den = this.evaluateAbs(node.right);
      const isUnchangedAbs = (orig: TreeNode, res: TreeNode) =>
        res.type === "FUNCTION" && res.name === "abs" && res.args[0] === orig;

      if (!isUnchangedAbs(node.left, num) || !isUnchangedAbs(node.right, den)) {
        return this.simplify(new Divide(num, den));
      }
    }
    return new FunctionCall("abs", [node]);
  }

  private symbolDomain(node: TreeNode): SymbolDomain | undefined {
    return node.type === "SYMBOL"
      ? this.options.constants?.get(node.name)
      : undefined;
  }

  private isNonZero(node: TreeNode): boolean {
    if (isNumerical(node)) return !isZero(node);
    const domain = this.symbolDomain(node);
    if (domain) return domain === "positive" || domain === "negative";
    if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
      return this.isNonZero(node.left) && this.isNonZero(node.right);
    }
    if (node.type === "POWER") return this.isNonZero(node.left);
    if (node.type === "FUNCTION" && node.name === "abs") {
      return this.isNonZero(node.args[0]);
    }
    return false;
  }

  private isReal(node: TreeNode): boolean {
    if (!this.options.complex || isNumerical(node)) return true;
    const domain = this.symbolDomain(node);
    return domain === "positive" || domain === "negative" || domain === "real";
  }

  private isPositive(node: TreeNode): boolean {
    if (isNumerical(node)) return !isNegative(node);
    if (this.symbolDomain(node) === "positive") return true;
    if (node.type === "FUNCTION" && node.name === "abs") return true;
    if (node.type === "DIVIDE") {
      return node.left.print() === node.right.print();
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
    return (
      isNumerical(exp) && Evaluator.toFraction(exp).denominator % 2n === 0n
    );
  }

  private losesEvenRootParity(
    base: TreeNode,
    exp1: NumericalNode,
    exp2: NumericalNode,
    totalExp: NumericalNode,
  ): boolean {
    return (
      !this.options.complex &&
      !this.isPositive(base) &&
      (this.isEvenRoot(exp1) || this.isEvenRoot(exp2)) &&
      !this.isEvenRoot(totalExp)
    );
  }

  private withCoeff(
    coeff: TreeNode,
    body: TreeNode,
    simplify = false,
  ): TreeNode {
    if (isZero(coeff)) return Evaluator.ZERO;
    if (this.isOne(coeff)) return body;
    if (this.isOne(body)) return coeff;
    const mul = new Multiply(coeff, body);
    return simplify ? this.simplify(mul) : mul;
  }

  private buildTerm(
    coeff: NumericalNode,
    factors: readonly TreeNode[],
  ): TreeNode {
    if (isZero(coeff)) return Evaluator.ZERO;
    if (factors.length === 0) return coeff;
    return this.withCoeff(
      coeff,
      factors.reduce((acc, f) => new Multiply(acc, f)),
    );
  }

  private makePower(base: TreeNode, exp: NumericalNode): TreeNode {
    if (isZero(exp)) return Evaluator.ONE;
    return this.simplify(new Power(base, exp));
  }

  private multiplyAll(nodes: readonly TreeNode[]): TreeNode {
    return nodes.reduce((acc, f) => this.simplify(new Multiply(acc, f)));
  }

  private extractFactors(node: TreeNode): {
    coeff: NumericalNode;
    factors: TreeNode[];
  } {
    if (isNumerical(node)) return { coeff: node, factors: [] };
    if (node.type === "MULTIPLY") {
      const left = this.extractFactors(node.left);
      const right = this.extractFactors(node.right);
      const coeff = this.isOne(left.coeff)
        ? right.coeff
        : this.isOne(right.coeff)
          ? left.coeff
          : this.evaluateNumericMultiply(left.coeff, right.coeff);
      return { coeff, factors: [...left.factors, ...right.factors] };
    }
    return { coeff: Evaluator.ONE, factors: [node] };
  }

  private singleFactor(factors: readonly TreeNode[]): TreeNode | undefined {
    return factors.length === 1 ? factors[0] : undefined;
  }

  private tryCombineTerms(
    left: DefinedNode,
    right: DefinedNode,
    op: "ADD" | "SUBTRACT",
  ): TreeNode | null {
    const t1 = this.extractFactors(left);
    const t2 = this.extractFactors(right);

    if (
      t1.factors.length > 0 &&
      t1.factors.length === t2.factors.length &&
      t1.factors.every((f, i) => f.print() === t2.factors[i]?.print())
    ) {
      return this.buildTerm(
        this.evaluateNumericBinary(t1.coeff, t2.coeff, op),
        t1.factors,
      );
    }
    return null;
  }

  private getBaseAndExp(
    node: TreeNode | undefined,
  ): { base: TreeNode; exp: NumericalNode } | null {
    if (!node) return null;
    if (node.type === "SYMBOL" || node.type === "FUNCTION") {
      return { base: node, exp: Evaluator.ONE };
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
    if (left.type === "DIVIDE" || right.type === "DIVIDE") {
      const [n1, d1] =
        left.type === "DIVIDE" ? [left.left, left.right] : [left, null];
      const [n2, d2] =
        right.type === "DIVIDE" ? [right.left, right.right] : [right, null];
      const den = d1 && d2 ? new Multiply(d1, d2) : (d1 ?? d2)!;
      return this.simplify(new Divide(new Multiply(n1, n2), den));
    }

    const t1 = this.extractFactors(left);
    const t2 = this.extractFactors(right);

    if (t1.factors.length === 0 || t2.factors.length === 0) {
      return this.buildTerm(this.evaluateNumericMultiply(t1.coeff, t2.coeff), [
        ...t1.factors,
        ...t2.factors,
      ]);
    }

    const s1 = this.singleFactor(t1.factors);
    const s2 = this.singleFactor(t2.factors);
    const leftInfo = this.getBaseAndExp(s1);
    const rightInfo = this.getBaseAndExp(s2);

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
        this.losesEvenRootParity(
          leftInfo.base,
          leftInfo.exp,
          rightInfo.exp,
          totalExp,
        )
      ) {
        return s1 && s2 && s1.print() === s2.print()
          ? this.withCoeff(combinedCoeff, new Power(s1, new Integer(2)))
          : null;
      }

      return this.withCoeff(
        combinedCoeff,
        this.makePower(leftInfo.base, totalExp),
        true,
      );
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

    const num = this.extractFactors(left);
    const den = this.extractFactors(right);

    const singleDen = this.singleFactor(den.factors);
    if (num.factors.length === 0 && singleDen) {
      const rightInfo = this.getBaseAndExp(singleDen);
      if (!rightInfo) return null;

      const totalExp = this.evaluateNumericBinary(
        Evaluator.ZERO,
        rightInfo.exp,
        "SUBTRACT",
      );

      return this.withCoeff(
        this.evaluateNumericDivide(num.coeff, den.coeff),
        this.makePower(rightInfo.base, totalExp),
        true,
      );
    }

    if (num.factors.length > 0 && den.factors.length === 0) {
      return this.buildTerm(
        this.evaluateNumericDivide(num.coeff, den.coeff),
        num.factors,
      );
    }

    if (num.factors.length === 0 || den.factors.length === 0) return null;

    const denFactors = [...den.factors];
    const denUsed = Array.from({ length: denFactors.length }).fill(false);
    const newNumFactors: TreeNode[] = [];
    let cancelled = false;

    for (const numFactor of num.factors) {
      const leftInfo = this.getBaseAndExp(numFactor);
      if (!leftInfo) {
        newNumFactors.push(numFactor);
        continue;
      }

      let matched = false;
      for (let j = 0; j < denFactors.length; j++) {
        if (denUsed[j]) continue;
        const rightInfo = this.getBaseAndExp(denFactors[j]);
        if (!rightInfo || leftInfo.base.print() !== rightInfo.base.print()) {
          continue;
        }

        const totalExp = this.evaluateNumericBinary(
          leftInfo.exp,
          rightInfo.exp,
          "SUBTRACT",
        );

        if (!isNegative(totalExp) && !this.isNonZero(leftInfo.base)) {
          const guard =
            leftInfo.base.type === "FUNCTION" && leftInfo.base.name === "abs"
              ? leftInfo.base.args[0]
              : leftInfo.base;
          const isSameGuard = guard.print() === leftInfo.base.print();
          const rightFrac = Evaluator.toFraction(rightInfo.exp);
          if (isSameGuard && rightFrac.numerator <= rightFrac.denominator) {
            continue;
          }

          denFactors[j] = guard;
          const numExp = isSameGuard
            ? this.evaluateNumericBinary(totalExp, Evaluator.ONE, "ADD")
            : totalExp;
          if (!isZero(numExp)) {
            newNumFactors.push(this.makePower(leftInfo.base, numExp));
          }
          if (!isSameGuard) newNumFactors.push(guard);
        } else {
          denUsed[j] = true;
          if (!isZero(totalExp)) {
            newNumFactors.push(this.makePower(leftInfo.base, totalExp));
          }
        }

        cancelled = matched = true;
        break;
      }

      if (!matched) newNumFactors.push(numFactor);
    }

    if (!cancelled && this.isOne(den.coeff)) return null;

    const combinedCoeff = this.evaluateNumericDivide(num.coeff, den.coeff);
    if (isZero(combinedCoeff)) return Evaluator.ZERO;

    const numNode =
      newNumFactors.length === 0
        ? combinedCoeff
        : this.withCoeff(combinedCoeff, this.multiplyAll(newNumFactors), true);

    const remainingDen = denFactors.filter((_, idx) => !denUsed[idx]);
    return remainingDen.length === 0
      ? numNode
      : this.simplify(new Divide(numNode, this.multiplyAll(remainingDen)));
  }

  private simplifyZeroNumeratorDenominator(den: DefinedNode): TreeNode {
    const { coeff, factors } = this.extractFactors(den);
    if (factors.length === 0) return den;

    let changed = !this.isOne(coeff);
    const reducedFactors: TreeNode[] = [];

    for (const factor of factors) {
      if (factor.type === "POWER" && isNumerical(factor.right)) {
        const expFrac = Evaluator.toFraction(factor.right);
        const isUnsafeEvenRoot =
          !this.options.complex &&
          !this.isPositive(factor.left) &&
          this.isEvenRoot(factor.right);

        if (!isUnsafeEvenRoot && expFrac.numerator > expFrac.denominator) {
          reducedFactors.push(factor.left);
          changed = true;
          continue;
        }
      }
      reducedFactors.push(factor);
    }

    if (!changed) return den;
    return this.multiplyAll(reducedFactors);
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
        if (this.isPositive(innerBase)) return innerBase;
        return this.options.complex
          ? null
          : this.simplify(new FunctionCall("abs", [innerBase]));
      }

      if (
        (this.options.complex &&
          !this.isPositive(innerBase) &&
          expInt === null) ||
        (!this.options.complex &&
          !this.isPositive(innerBase) &&
          this.isEvenRoot(innerExp) &&
          !this.isEvenRoot(newExp))
      ) {
        return null;
      }

      return this.simplify(new Power(innerBase, newExp));
    }

    if (left.type === "MULTIPLY" && expInt !== null && expInt !== 0n) {
      const { coeff, factors } = this.extractFactors(left);
      const single = this.singleFactor(factors);
      if (!this.isOne(coeff) && single) {
        return this.withCoeff(
          this.evaluatePower(coeff, expInt),
          this.simplify(new Power(single, right)),
          true,
        );
      }
    }

    return null;
  }

  private static alignDecimals(d1: Decimal, d2: Decimal) {
    const exp = d1.exponent < d2.exponent ? d1.exponent : d2.exponent;
    return {
      c1: d1.whole * 10n ** (d1.exponent - exp),
      c2: d2.whole * 10n ** (d2.exponent - exp),
      exp,
    };
  }

  private evalNumericPair(
    left: NumericalNode,
    right: NumericalNode,
    fracOp: (a: Fraction, b: Fraction) => [bigint, bigint],
    decOp: (d1: Decimal, d2: Decimal) => [bigint, bigint],
  ): NumericalNode {
    if (left.type === "FRACTION" || right.type === "FRACTION") {
      const [n, d] = fracOp(
        Evaluator.toFraction(left),
        Evaluator.toFraction(right),
      );
      return this.normalizeFraction(n, d);
    }
    const [coeff, exp] = decOp(
      Evaluator.toDecimal(left),
      Evaluator.toDecimal(right),
    );
    return Evaluator.normalizeDecimal(coeff, exp);
  }

  private evaluateNumericBinary(
    left: NumericalNode,
    right: NumericalNode,
    op: "ADD" | "SUBTRACT",
  ): NumericalNode {
    return this.evalNumericPair(
      left,
      right,
      (a, b) => [
        op === "ADD"
          ? a.numerator * b.denominator + b.numerator * a.denominator
          : a.numerator * b.denominator - b.numerator * a.denominator,
        a.denominator * b.denominator,
      ],
      (a, b) => {
        const { c1, c2, exp } = Evaluator.alignDecimals(a, b);
        return [op === "ADD" ? c1 + c2 : c1 - c2, exp];
      },
    );
  }

  private evaluateNumericMultiply(
    left: NumericalNode,
    right: NumericalNode,
  ): NumericalNode {
    return this.evalNumericPair(
      left,
      right,
      (a, b) => [a.numerator * b.numerator, a.denominator * b.denominator],
      (a, b) => [a.whole * b.whole, a.exponent + b.exponent],
    );
  }

  private evaluateNumericDivide(
    left: NumericalNode,
    right: NumericalNode,
  ): NumericalNode {
    const f1 = Evaluator.toFraction(left);
    const f2 = Evaluator.toFraction(right);
    return this.normalizeFraction(
      f1.numerator * f2.denominator,
      f1.denominator * f2.numerator,
    );
  }

  private evaluateNumericMod(
    left: NumericalNode,
    right: NumericalNode,
  ): NumericalNode {
    return this.evalNumericPair(
      left,
      right,
      (a, b) => {
        const n1 = a.numerator * b.denominator;
        const n2 = b.numerator * a.denominator;
        return [((n1 % n2) + n2) % n2, a.denominator * b.denominator];
      },
      (a, b) => {
        const { c1, c2, exp } = Evaluator.alignDecimals(a, b);
        return [((c1 % c2) + c2) % c2, exp];
      },
    );
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
    const fallback = () => new Power(base, new Integer(exp));

    if (exp > 0n) {
      if (base.type === "INTEGER") {
        return powBitLength(base.value, exp) > POW_BITS_THRESHOLD
          ? fallback()
          : new Integer(base.value ** exp);
      }
      if (base.type === "DECIMAL") {
        const scaledExp = base.exponent * exp;
        if (
          powBitLength(base.whole, exp) > POW_BITS_THRESHOLD ||
          scaledExp > POW_BITS_THRESHOLD ||
          scaledExp < -POW_BITS_THRESHOLD
        ) {
          return fallback();
        }
        return Evaluator.normalizeDecimal(base.whole ** exp, scaledExp);
      }
    }

    const f = Evaluator.toFraction(base);
    const [num, den, e] =
      exp > 0n
        ? [f.numerator, f.denominator, exp]
        : [f.denominator, f.numerator, -exp];

    return powBitLength(num, e) > POW_BITS_THRESHOLD ||
      powBitLength(den, e) > POW_BITS_THRESHOLD
      ? fallback()
      : this.normalizeFraction(num ** e, den ** e);
  }

  private evaluateNumericAbs(node: NumericalNode): NumericalNode {
    if (!isNegative(node)) return node;
    if (node.type === "DECIMAL") {
      return Evaluator.normalizeDecimal(-node.whole, node.exponent);
    }
    return negate(node) as NumericalNode;
  }

  private static normalizeDecimal(
    coeff: bigint,
    exp: bigint,
  ): Decimal | Integer {
    if (coeff === 0n) return Evaluator.ZERO;
    while (coeff % 10n === 0n && exp < 0n) {
      coeff /= 10n;
      exp += 1n;
    }
    return exp === 0n ? new Integer(coeff) : new Decimal(coeff, exp);
  }

  private normalizeFraction(n: bigint, d: bigint): Integer | Fraction {
    const frac = new Fraction(n, d);
    return frac.denominator === 1n ? new Integer(frac.numerator) : frac;
  }

  static toDecimal(node: Decimal | Integer): Decimal {
    return node.type === "INTEGER" ? new Decimal(node.value, 0n) : node;
  }

  static toFraction(node: NumericalNode): Fraction {
    if (node.type === "FRACTION") return node;
    if (node.type === "INTEGER") return new Fraction(node.value, 1n);
    return node.exponent >= 0n
      ? new Fraction(node.whole * 10n ** node.exponent, 1n)
      : new Fraction(node.whole, 10n ** -node.exponent);
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
    if (num === 0n) return Evaluator.ZERO;

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
    for (let i = 0n; i < targetDigits + 1n; i++) {
      coeff = coeff * 10n + num / den;
      num = (num % den) * 10n;
    }

    const extraDigit = coeff % 10n;
    coeff /= 10n;
    if (roundingMode === "round" && extraDigit >= 5n) coeff += 1n;

    const finalExp = scaleExp - (targetDigits - 1n);
    return Evaluator.normalizeDecimal(isNegative ? -coeff : coeff, finalExp);
  }
}
