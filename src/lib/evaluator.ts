import { lcm } from "#math/lcm";
import { mergeMapWithDefaults } from "#utils/merge";

import { AlgebraError } from "./errors";
import type {
  BinaryNode,
  BinaryOpType,
  DefinedNode,
  NumericalNode,
  SymbolNode,
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
  isAbovePowThreshold,
  isEqual,
  isEvenInteger,
  isNegativeNumber,
  isNumerical,
  isOne,
  isZero,
  isInteger,
  negate,
  tryGetIntegerValue,
  isNegativeOne,
} from "./shared";

export class EvaluatorError extends AlgebraError {
  constructor(message: string) {
    super("EvaluatorError", message);
  }
}

type Term = { coeff: NumericalNode; body: TreeNode };

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
  ["i", "complex"],
]);

export class Evaluator {
  private static readonly ZERO = new Integer(0);
  private static readonly ONE = new Integer(1);

  private readonly constants: ReadonlyMap<string, SymbolDomain>;
  private readonly complex: boolean;

  constructor(options: Readonly<EvaluatorOptions> = {}) {
    this.complex = options.complex ?? false;
    this.constants = mergeMapWithDefaults(constants, options.constants);
  }

  public simplify(node: TreeNode): TreeNode {
    switch (node.type) {
      case "INTEGER":
      case "DECIMAL":
      case "FRACTION":
      case "UNDEFINED":
        return node;

      case "SYMBOL": {
        if (this.symbolDomain(node) === "complex" && !this.complex) {
          return new Undefined(node);
        }
        return node;
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
        const simplified = new FunctionCall(name, args);
        if (args.some((arg) => arg.type === "UNDEFINED")) {
          return new Undefined(simplified);
        }
        if (args.length !== 1) return simplified;
        if (name === "abs") return this.evaluateAbs(args[0]);
        if (name === "sqrt") {
          return this.simplify(new Power(args[0], new Fraction(1n, 2n)));
        }
        if (name === "floor" || name === "ceil") {
          return this.evaluateFloorCeil(args[0], name);
        }
        return simplified;
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
        if (isZero(left)) {
          return node.type === "ADD" ? right : this.simplify(negate(right));
        }
        if (isZero(right)) return left;
        return (
          this.tryAddSubtractSymbolic(left, right, node.type) ?? simplified
        );
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
        const unpacked = this.unpackBase(left);
        if (unpacked.abs && isOne(unpacked.exp) && isEvenInteger(right)) {
          return this.simplify(new Power(unpacked.base, right));
        }
        if (isOne(right)) return left;
        if (isZero(right) || isOne(left)) return Evaluator.ONE;
        if (isZero(left)) {
          return isNegativeNumber(right) ? new Undefined(simplified) : left;
        }
        if (
          !this.complex &&
          this.isEvenRoot(right) &&
          (isNegativeNumber(left) || this.symbolDomain(left) === "negative")
        ) {
          return new Undefined(simplified);
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
    if (isNumerical(node)) return isNegativeNumber(node) ? negate(node) : node;
    if (this.isPositive(node)) return node;
    if (this.isNegative(node)) return this.simplify(negate(node));
    if (node.type === "MULTIPLY") {
      const { coeff, body } = this.extractFactors(node);
      if (!isOne(coeff)) {
        return this.withCoeff(this.evaluateAbs(coeff), this.evaluateAbs(body));
      }
    }
    return new FunctionCall("abs", [node]);
  }

  private evaluateFloorCeil(node: TreeNode, op: "floor" | "ceil"): TreeNode {
    if (isInteger(node)) {
      return node;
    }
    if (isNumerical(node)) {
      return this.evaluateNumericFloorCeil(node, op);
    }
    if (node.type === "ADD" || node.type === "SUBTRACT") {
      const terms = this.extractTerms(node);
      const nonIntTerms: Term[] = [];
      const intTerms: Term[] = [];

      for (const term of terms) {
        if (isInteger(term.coeff) && isInteger(term.body)) {
          intTerms.push(term);
        } else {
          nonIntTerms.push(term);
        }
      }

      if (intTerms.length > 0) {
        if (nonIntTerms.length === 0) return node;
        return this.simplify(
          this.appendTerms(
            new FunctionCall(op, [this.buildSum(nonIntTerms)]),
            intTerms,
          ),
        );
      }
    }
    return new FunctionCall(op, [node]);
  }

  private buildSum(terms: readonly Term[]): TreeNode {
    const [first, ...rest] = terms;
    if (!first) return Evaluator.ZERO;
    return this.appendTerms(this.withCoeff(first.coeff, first.body), rest);
  }

  private appendTerms(initial: TreeNode, terms: readonly Term[]): TreeNode {
    let acc = initial;
    for (const term of terms) {
      if (isNegativeNumber(term.coeff)) {
        acc = new Subtract(acc, this.withCoeff(negate(term.coeff), term.body));
      } else {
        acc = new Add(acc, this.withCoeff(term.coeff, term.body));
      }
    }
    return acc;
  }

  private evaluateNumericFloorCeil(
    node: NumericalNode,
    op: "floor" | "ceil",
  ): Integer {
    const { numerator, denominator } = Evaluator.toFraction(node);
    const q = numerator / denominator;
    const r = numerator % denominator;
    if (op === "floor") return new Integer(r < 0n ? q - 1n : q);
    return new Integer(r > 0n ? q + 1n : q);
  }

  private symbolDomain(node: TreeNode): SymbolDomain | undefined {
    return node.type === "SYMBOL" ? this.constants.get(node.name) : undefined;
  }

  private isReal(node: TreeNode): boolean {
    if (!this.complex || isNumerical(node)) return true;
    const domain = this.symbolDomain(node);
    return domain === "positive" || domain === "negative" || domain === "real";
  }

  private isPositive(node: TreeNode): boolean {
    if (isNumerical(node)) return !isNegativeNumber(node);
    if (this.symbolDomain(node) === "positive") return true;
    if (node.type === "FUNCTION" && node.name === "abs") return true;
    if (node.type === "POWER") {
      if (isEvenInteger(node.right) && this.isReal(node.left)) {
        return true;
      }
      return this.isPositive(node.left) && this.isReal(node.right);
    }
    if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
      return (
        (this.isPositive(node.left) && this.isPositive(node.right)) ||
        (this.isNegative(node.left) && this.isNegative(node.right))
      );
    }
    return false;
  }

  private isNegative(node: TreeNode): boolean {
    if (isNegativeNumber(node)) return true;
    if (this.symbolDomain(node) === "negative") return true;
    if (node.type === "POWER") {
      const exp = tryGetIntegerValue(node.right);
      return exp !== null && exp % 2n !== 0n && this.isNegative(node.left);
    }
    if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
      return (
        (this.isPositive(node.left) && this.isNegative(node.right)) ||
        (this.isNegative(node.left) && this.isPositive(node.right))
      );
    }
    return false;
  }

  private evaluateImaginaryPower(i: SymbolNode, exp: bigint): TreeNode {
    const rem = ((exp % 4n) + 4n) % 4n;
    switch (rem) {
      case 0n:
        return Evaluator.ONE;
      case 1n:
        return i;
      case 2n:
        return new Integer(-1n);
      default:
        return negate(i);
    }
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
      !this.complex &&
      !this.isPositive(base) &&
      (this.isEvenRoot(exp1) ||
        (exp2 !== undefined && this.isEvenRoot(exp2))) &&
      !this.isEvenRoot(newExp)
    );
  }

  private extractTerms(node: TreeNode, isSubtract = false): Term[] {
    if (node.type === "ADD") {
      return [
        ...this.extractTerms(node.left, isSubtract),
        ...this.extractTerms(node.right, isSubtract),
      ];
    }
    if (node.type === "SUBTRACT") {
      return [
        ...this.extractTerms(node.left, isSubtract),
        ...this.extractTerms(node.right, !isSubtract),
      ];
    }
    const { coeff, body } = this.extractFactors(node);
    return [{ coeff: isSubtract ? negate(coeff) : coeff, body }];
  }

  private tryAddSubtractSymbolic(
    left: DefinedNode,
    right: DefinedNode,
    op: "ADD" | "SUBTRACT",
  ): TreeNode | null {
    const rawTerms = [
      ...this.extractTerms(left, false),
      ...this.extractTerms(right, op === "SUBTRACT"),
    ];

    const terms: Term[] = [];
    let changed = false;

    for (const term of rawTerms) {
      const existing = terms.find((t) => isEqual(t.body, term.body));
      if (existing) {
        existing.coeff = this.evaluateNumericBinary(
          existing.coeff,
          term.coeff,
          "ADD",
        );
        changed = true;
      } else {
        terms.push(term);
      }
    }

    if (!changed) return null;

    return this.buildSum(terms.filter((t) => !isZero(t.coeff)));
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
      // Invariant: extractFactors is only called on simplified nodes, and
      // tryMultiplySymbolic always merges pairs where both sides have a non-1
      // coeff. Thus at most one side can have a non-1 coeff here.
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

  private unpackBase(node: TreeNode) {
    const { base, exp } = this.getBaseAndExp(node);
    const abs =
      base.type === "FUNCTION" &&
      base.name === "abs" &&
      base.args.length === 1 &&
      this.isReal(base.args[0]);
    return { base: abs ? base.args[0] : base, exp, abs };
  }

  private packBase(base: TreeNode, exp: NumericalNode, abs: boolean): TreeNode {
    if (isZero(exp)) return Evaluator.ONE;
    const target =
      abs &&
      !this.isPositive(base) &&
      !(this.isReal(base) && isEvenInteger(exp))
        ? new FunctionCall("abs", [base])
        : base;
    return this.simplify(new Power(target, exp));
  }

  private combineFactors(
    leftFactors: readonly TreeNode[],
    rightFactors: readonly TreeNode[],
    isDivide: boolean = false,
  ): { factors: TreeNode[]; remainingDen: TreeNode[]; changed: boolean } {
    const used = Array.from<boolean>({ length: rightFactors.length }).fill(
      false,
    );
    const factors: TreeNode[] = [];
    let changed = false;

    for (const leftFactor of leftFactors) {
      const a = this.unpackBase(leftFactor);
      let matched = false;

      for (const [j, rightFactor] of rightFactors.entries()) {
        if (used[j]) continue;
        const b = this.unpackBase(rightFactor);
        if (!isEqual(a.base, b.base)) continue;

        const bExp = isDivide ? negate(b.exp) : b.exp;

        if (a.abs === b.abs) {
          const totalExp = this.evaluateNumericBinary(a.exp, bExp, "ADD");
          used[j] = true;
          if (!a.abs && this.losesEvenRoot(a.base, totalExp, a.exp, b.exp)) {
            const f1 = Evaluator.toFraction(a.exp);
            const f2 = Evaluator.toFraction(b.exp);
            const fTotal = Evaluator.toFraction(totalExp);
            const rootDenom = lcm(f1.denominator, f2.denominator);
            const outerExp =
              (fTotal.numerator * rootDenom) / fTotal.denominator;
            const rootNode = this.simplify(
              new Power(a.base, new Fraction(1n, rootDenom)),
            );
            factors.push(new Power(rootNode, new Integer(outerExp)));
          } else if (!isZero(totalExp)) {
            factors.push(this.packBase(a.base, totalExp, a.abs));
          }
          changed = matched = true;
          break;
        }

        const [uExp, absExp] = a.abs ? [bExp, a.exp] : [a.exp, bExp];
        const n = tryGetIntegerValue(uExp);
        const rem = n !== null ? n % 2n : 0n;
        const even = n !== null ? n - rem : 0n;
        if (even === 0n) continue;

        used[j] = true;
        const totalAbs = this.evaluateNumericBinary(
          new Integer(even),
          absExp,
          "ADD",
        );
        if (rem !== 0n) {
          factors.push(this.packBase(a.base, new Integer(rem), false));
        }
        if (!isZero(totalAbs)) {
          factors.push(this.packBase(a.base, totalAbs, true));
        }
        changed = matched = true;
        break;
      }

      if (!matched) factors.push(leftFactor);
    }

    const remainingDen: TreeNode[] = [];
    for (const [j, rightFactor] of rightFactors.entries()) {
      if (!used[j]) (isDivide ? remainingDen : factors).push(rightFactor);
    }
    return { factors, remainingDen, changed };
  }

  private tryMultiplySymbolic(
    left: DefinedNode,
    right: DefinedNode,
  ): TreeNode | null {
    if (left.type === "DIVIDE" || right.type === "DIVIDE") {
      const [n1, d1] =
        left.type === "DIVIDE" ? [left.left, left.right] : [left];
      const [n2, d2] =
        right.type === "DIVIDE" ? [right.left, right.right] : [right];
      const den = d1 && d2 ? new Multiply(d1, d2) : (d1 ?? d2)!;
      return this.simplify(new Divide(new Multiply(n1, n2), den));
    }

    const t1 = this.extractFactors(left);
    const t2 = this.extractFactors(right);

    if (t1.factors.length === 0 || t2.factors.length === 0) {
      const coeff = this.evaluateNumericMultiply(t1.coeff, t2.coeff);
      const body = isOne(t1.body) ? t2.body : t1.body;
      if (
        isNegativeOne(coeff) &&
        (body.type === "ADD" || body.type === "SUBTRACT")
      ) {
        return this.buildSum(this.extractTerms(body, true));
      }
      return this.makeTerm(coeff, body);
    }

    const { factors, changed } = this.combineFactors(t1.factors, t2.factors);
    if (!changed && (isOne(t1.coeff) || isOne(t2.coeff))) return null;

    return this.withCoeff(
      this.evaluateNumericMultiply(t1.coeff, t2.coeff),
      this.multiplyAll(factors),
    );
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

      return this.withCoeff(
        this.evaluateNumericDivide(num.coeff, den.coeff),
        this.simplify(new Power(rightInfo.base, negate(rightInfo.exp))),
      );
    }

    if (den.factors.length === 0) {
      return this.withCoeff(
        this.evaluateNumericDivide(num.coeff, den.coeff),
        num.body,
      );
    }

    const { factors, remainingDen, changed } = this.combineFactors(
      num.factors,
      den.factors,
      true,
    );
    if (!changed && isOne(den.coeff)) return null;

    const combinedCoeff = this.evaluateNumericDivide(num.coeff, den.coeff);
    if (isZero(combinedCoeff)) return combinedCoeff;

    const numNode = this.withCoeff(combinedCoeff, this.multiplyAll(factors));
    return this.simplify(new Divide(numNode, this.multiplyAll(remainingDen)));
  }

  private tryExponentiateSymbolic(
    left: DefinedNode,
    right: DefinedNode,
    expInt: bigint | null,
  ): TreeNode | null {
    if (left.type === "SYMBOL" && left.name === "i" && expInt !== null) {
      return this.evaluateImaginaryPower(left, expInt);
    }

    if (left.type === "POWER") {
      const innerBase = left.left;
      const innerExp = left.right;
      const newExp = this.simplify(new Multiply(innerExp, right));

      if (isOne(newExp) && isEvenInteger(innerExp) && this.isEvenRoot(right)) {
        if (this.isPositive(innerBase)) return innerBase;
        return this.complex
          ? null
          : this.simplify(new FunctionCall("abs", [innerBase]));
      }

      if (
        (this.complex && !this.isPositive(innerBase) && !expInt) ||
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
        return isAbovePowThreshold(base.value, exp)
          ? new Power(base, new Integer(exp))
          : new Integer(base.value ** exp);
      }
      if (base.type === "DECIMAL") {
        if (isAbovePowThreshold(base.whole, exp)) {
          return new Power(base, new Integer(exp));
        }
        return Evaluator.normalizeDecimal(
          base.whole ** exp,
          base.exponent * exp,
        );
      }
    }

    const f = Evaluator.toFraction(base);
    const [num, den, e] =
      exp > 0n
        ? [f.numerator, f.denominator, exp]
        : [f.denominator, f.numerator, -exp];

    return isAbovePowThreshold(num, e) || isAbovePowThreshold(den, e)
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
