import { powBitLength } from "bigint.bitlength";

import { gcd } from "#math/gcd";

import { AlgebraError } from "./errors";
import type {
  BinaryNode,
  BinaryOpType,
  DefinedNode,
  NumericalNode,
  TreeNode,
} from "./nodes";
import {
  Add,
  Decimal,
  Divide,
  Fraction,
  FunctionCall,
  Integer,
  Modulo,
  Multiply,
  Power,
  Subtract,
  Undefined,
} from "./nodes";
import {
  isEqual,
  isEvenInteger,
  isNegative,
  isNumerical,
  isOne,
  isZero,
  negate,
  POW_BITS_THRESHOLD,
  tryGetIntegerValue,
} from "./shared";

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

        if (name === "abs" && args.length === 1) {
          return this.evaluateAbs(args[0]);
        }
        if (name === "sqrt" && args.length === 1) {
          return this.simplify(new Power(args[0], new Fraction(1n, 2n)));
        }
        return new FunctionCall(name, args);
      }

      default:
        return this.simplifyBinary(node);
    }
  }

  private simplifyBinary(node: BinaryNode): TreeNode {
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
        const t1 = this.extractFactors(left);
        const t2 = this.extractFactors(right);
        if (isEqual(t1.body, t2.body)) {
          return this.withCoeff(
            this.evaluateNumericBinary(t1.coeff, t2.coeff, node.type),
            t1.body,
          );
        }
        if (isZero(left)) {
          return node.type === "ADD" ? right : this.simplify(negate(right));
        }
        return isZero(right) ? left : simplified;
      }

      case "MULTIPLY": {
        if (isZero(left) || isZero(right)) return Evaluator.ZERO;
        if (isOne(left)) return right;
        if (isOne(right)) return left;
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericMultiply(left, right);
        }
        return this.tryMultiplySymbolic(left, right) ?? simplified;
      }

      case "DIVIDE": {
        if (isZero(right)) return new Undefined(simplified);
        if (isOne(right)) return left;
        if (isZero(left)) return left;
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericDivide(left, right);
        }
        return this.tryDivideSymbolic(left, right) ?? simplified;
      }

      case "MOD": {
        if (isZero(right)) return new Undefined(simplified);
        if (isZero(left)) return left;
        return isNumerical(left) && isNumerical(right)
          ? this.evaluateNumericMod(left, right)
          : simplified;
      }

      case "POWER": {
        if (
          left.type === "FUNCTION" &&
          left.name === "abs" &&
          isEvenInteger(right) &&
          this.isReal(left.args[0])
        ) {
          return this.simplify(new Power(left.args[0], right));
        }

        if (isOne(right)) return left;
        if (isZero(right) || isOne(left)) return Evaluator.ONE;
        if (isZero(left)) {
          return isNumerical(right) && isNegative(right)
            ? new Undefined(simplified)
            : Evaluator.ZERO;
        }
        const expInt = tryGetIntegerValue(right);
        if (expInt && isNumerical(left) && isNumerical(right)) {
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
    if (isNumerical(node)) return isNegative(node) ? negate(node) : node;
    if (this.isPositive(node)) return node;
    if (node.type === "MULTIPLY") {
      const { coeff, body } = this.extractFactors(node);
      if (!isOne(coeff)) {
        return this.withCoeff(this.evaluateAbs(coeff), this.evaluateAbs(body));
      }
    }
    return new FunctionCall("abs", [node]);
  }

  private symbolDomain(node: TreeNode): SymbolDomain | undefined {
    return node.type === "SYMBOL"
      ? this.options.constants?.get(node.name)
      : undefined;
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
    if (node.type === "POWER") {
      if (isEvenInteger(node.right) && this.isReal(node.left)) {
        return true;
      }
      return this.isPositive(node.left) && this.isReal(node.right);
    }
    return false;
  }

  private isEvenRoot(exp: TreeNode): boolean {
    return (
      isNumerical(exp) && Evaluator.toFraction(exp).denominator % 2n === 0n
    );
  }

  private losesEvenRoot(
    base: TreeNode,
    newExp: TreeNode,
    exp1: TreeNode,
    exp2?: TreeNode,
  ): boolean {
    return (
      !this.options.complex &&
      !this.isPositive(base) &&
      (this.isEvenRoot(exp1) ||
        (exp2 !== undefined && this.isEvenRoot(exp2))) &&
      !this.isEvenRoot(newExp)
    );
  }

  private withCoeff(coeff: TreeNode, body: TreeNode): TreeNode {
    return this.simplify(this.makeTerm(coeff, body));
  }

  private makeTerm(coeff: TreeNode, body: TreeNode): TreeNode {
    if (isZero(coeff)) return coeff;
    if (isOne(coeff)) return body;
    if (isOne(body)) return coeff;
    return new Multiply(coeff, body);
  }

  private multiplyAll(nodes: readonly TreeNode[]): TreeNode {
    return nodes.reduce(
      (acc, f) => this.simplify(new Multiply(acc, f)),
      Evaluator.ONE,
    );
  }

  private extractFactors(node: TreeNode): {
    coeff: NumericalNode;
    factors: TreeNode[];
    body: TreeNode;
  } {
    if (isNumerical(node)) {
      return { coeff: node, factors: [], body: Evaluator.ONE };
    }
    if (node.type === "MULTIPLY") {
      const left = this.extractFactors(node.left);
      const right = this.extractFactors(node.right);
      const coeff = isOne(left.coeff) ? right.coeff : left.coeff;
      const body = isOne(left.body)
        ? right.body
        : new Multiply(left.body, right.body);
      return { coeff, factors: [...left.factors, ...right.factors], body };
    }
    return { coeff: Evaluator.ONE, factors: [node], body: node };
  }

  private singleFactor(factors: readonly TreeNode[]): TreeNode | undefined {
    return factors.length === 1 ? factors[0] : undefined;
  }

  private getBaseAndExp(node: TreeNode): {
    base: TreeNode;
    exp: NumericalNode;
  } {
    if (node.type === "POWER" && isNumerical(node.right)) {
      return { base: node.left, exp: node.right };
    }
    return { base: node, exp: Evaluator.ONE };
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
      return this.makeTerm(
        this.evaluateNumericMultiply(t1.coeff, t2.coeff),
        isOne(t1.body) ? t2.body : t1.body,
      );
    }

    const used = Array.from<boolean>({ length: t2.factors.length }).fill(false);
    const newFactors: TreeNode[] = [];
    let merged = false;

    for (const leftFactor of t1.factors) {
      const leftInfo = this.getBaseAndExp(leftFactor);

      let matched = false;
      for (const [j, rightFactor] of t2.factors.entries()) {
        if (used[j]) continue;
        const rightInfo = this.getBaseAndExp(rightFactor);
        if (!isEqual(leftInfo.base, rightInfo.base)) {
          continue;
        }

        const totalExp = this.evaluateNumericBinary(
          leftInfo.exp,
          rightInfo.exp,
          "ADD",
        );

        used[j] = true;
        if (
          this.losesEvenRoot(
            leftInfo.base,
            totalExp,
            leftInfo.exp,
            rightInfo.exp,
          )
        ) {
          const f1 = Evaluator.toFraction(leftInfo.exp);
          const f2 = Evaluator.toFraction(rightInfo.exp);
          const fTotal = Evaluator.toFraction(totalExp);
          const rootDenom =
            (f1.denominator / gcd(f1.denominator, f2.denominator)) *
            f2.denominator;
          const outerExp = (fTotal.numerator * rootDenom) / fTotal.denominator;
          const rootNode = this.simplify(
            new Power(leftInfo.base, new Fraction(1n, rootDenom)),
          );
          newFactors.push(new Power(rootNode, new Integer(outerExp)));
        } else if (!isZero(totalExp)) {
          newFactors.push(this.simplify(new Power(leftInfo.base, totalExp)));
        }
        merged = matched = true;
        break;
      }

      if (!matched) newFactors.push(leftFactor);
    }

    for (const [j, rightFactor] of t2.factors.entries()) {
      if (!used[j]) {
        newFactors.push(rightFactor);
      }
    }

    if (!merged && (isOne(t1.coeff) || isOne(t2.coeff))) {
      return null;
    }

    const combinedCoeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);
    return this.withCoeff(combinedCoeff, this.multiplyAll(newFactors));
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

    if (num.factors.length === 0) {
      const single = this.singleFactor(den.factors);
      if (!single) return null;
      const rightInfo = this.getBaseAndExp(single);

      const totalExp = this.evaluateNumericBinary(
        Evaluator.ZERO,
        rightInfo.exp,
        "SUBTRACT",
      );

      return this.withCoeff(
        this.evaluateNumericDivide(num.coeff, den.coeff),
        this.simplify(new Power(rightInfo.base, totalExp)),
      );
    }

    if (den.factors.length === 0) {
      return this.makeTerm(
        this.evaluateNumericDivide(num.coeff, den.coeff),
        num.body,
      );
    }

    const used = Array.from<boolean>({ length: den.factors.length }).fill(
      false,
    );
    const newFactors: TreeNode[] = [];
    let cancelled = false;

    for (const numFactor of num.factors) {
      const leftInfo = this.getBaseAndExp(numFactor);

      let matched = false;
      for (const [j, denFactor] of den.factors.entries()) {
        if (used[j]) continue;
        const rightInfo = this.getBaseAndExp(denFactor);
        if (!isEqual(leftInfo.base, rightInfo.base)) {
          continue;
        }

        const totalExp = this.evaluateNumericBinary(
          leftInfo.exp,
          rightInfo.exp,
          "SUBTRACT",
        );

        used[j] = true;
        if (!isZero(totalExp)) {
          newFactors.push(this.simplify(new Power(leftInfo.base, totalExp)));
        }
        cancelled = matched = true;
        break;
      }

      if (!matched) newFactors.push(numFactor);
    }

    if (!cancelled && isOne(den.coeff)) return null;

    const combinedCoeff = this.evaluateNumericDivide(num.coeff, den.coeff);
    if (isZero(combinedCoeff)) return combinedCoeff;

    const numNode = this.withCoeff(combinedCoeff, this.multiplyAll(newFactors));
    const remainingDen = den.factors.filter((_, idx) => !used[idx]);
    return this.simplify(new Divide(numNode, this.multiplyAll(remainingDen)));
  }

  private tryExponentiateSymbolic(
    left: DefinedNode,
    right: DefinedNode,
    expInt: bigint | null,
  ): TreeNode | null {
    if (left.type === "POWER") {
      const innerBase = left.left;
      const innerExp = left.right;
      const newExp = this.simplify(new Multiply(innerExp, right));

      if (isOne(newExp) && isEvenInteger(innerExp) && this.isEvenRoot(right)) {
        if (this.isPositive(innerBase)) return innerBase;
        return this.options.complex
          ? null
          : this.simplify(new FunctionCall("abs", [innerBase]));
      }

      if (
        (this.options.complex && !this.isPositive(innerBase) && !expInt) ||
        this.losesEvenRoot(innerBase, newExp, innerExp)
      ) {
        return null;
      }

      return this.simplify(new Power(innerBase, newExp));
    }

    if (left.type === "MULTIPLY" && expInt) {
      const { coeff, factors } = this.extractFactors(left);
      const single = this.singleFactor(factors);
      if (!isOne(coeff) && single) {
        return this.withCoeff(
          this.evaluatePower(coeff, expInt),
          this.simplify(new Power(single, right)),
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

  private evaluatePower(
    base: NumericalNode,
    exp: bigint,
  ): NumericalNode | Power {
    if (exp > 0n) {
      if (base.type === "INTEGER") {
        return powBitLength(base.value, exp) > POW_BITS_THRESHOLD
          ? new Power(base, new Integer(exp))
          : new Integer(base.value ** exp);
      }
      if (base.type === "DECIMAL") {
        const scaledExp = base.exponent * exp;
        if (
          powBitLength(base.whole, exp) > POW_BITS_THRESHOLD ||
          scaledExp > POW_BITS_THRESHOLD ||
          scaledExp < -POW_BITS_THRESHOLD
        ) {
          return new Power(base, new Integer(exp));
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
      ? new Power(base, new Integer(exp))
      : this.normalizeFraction(num ** e, den ** e);
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
