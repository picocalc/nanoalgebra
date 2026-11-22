import { iNthRoot } from "#math/iroot";
import { lcm } from "#math/lcm";
import { mergeMapWithDefaults } from "#utils/merge";

import { ONE, ZERO } from "./constants";
import { negate, toFraction } from "./convert";
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
  SymbolNode,
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
  tryGetIntegerValue,
  isNegativeOne,
} from "./shared";

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
        return this.tryAddSubtractSymbolic(left, right, node.type);
      }

      case "MULTIPLY": {
        if (isZero(left) || isZero(right)) return ZERO;
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
        if (isZero(left)) return ZERO;
        if (isNumerical(left) && isNumerical(right)) {
          return this.evaluateNumericDivide(left, right);
        }
        return this.tryDivideSymbolic(left, right) ?? simplified;
      }

      case "MOD": {
        if (isZero(right)) return new Undefined(simplified);
        if (isZero(left)) return ZERO;
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
        if (isZero(right) || isOne(left)) return ONE;
        if (isZero(left)) {
          if (this.isPositive(right)) return left;
          if (this.isNegative(right)) return new Undefined(simplified);
          return simplified;
        }
        if (
          !this.complex &&
          this.isEvenRoot(right) &&
          (isNegativeNumber(left) || this.symbolDomain(left) === "negative")
        ) {
          return new Undefined(simplified);
        }
        if (isNumerical(left) && isNumerical(right)) {
          const evaluated = this.evaluateNumericPower(left, right);
          if (evaluated) return evaluated;
        }
        const expInt = tryGetIntegerValue(right);
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
    if (node.type === "SYMBOL" && node.name === "i") return ONE;
    if (this.isPositive(node)) return node;
    if (this.isNegative(node)) return this.simplify(negate(node));
    if (node.type === "MULTIPLY") {
      const { coeff, factors } = this.extractFactors(node);
      const nonUnitFactors = factors.filter(
        (f) => !(f.type === "SYMBOL" && f.name === "i"),
      );
      if (!isOne(coeff) || nonUnitFactors.length < factors.length) {
        if (nonUnitFactors.length === 0) return this.evaluateAbs(coeff);
        return this.withCoeff(
          this.evaluateAbs(coeff),
          this.evaluateAbs(this.multiplyAll(nonUnitFactors)),
        );
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
    if (!first) return ZERO;
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
    const { numerator, denominator } = toFraction(node);
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
    if (isNumerical(node)) return !isNegativeNumber(node) && !isZero(node);
    if (this.symbolDomain(node) === "positive") return true;
    if (node.type === "FUNCTION" && node.name === "abs") return true;
    if (node.type === "POWER") {
      if (
        this.isReal(node.left) &&
        (isEvenInteger(node.right) ||
          (this.isEvenRoot(node.right) && !this.isNegative(node.left)))
      ) {
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
    const rem = exp & 3n;
    switch (rem) {
      case 0n:
        return ONE;
      case 1n:
        return i;
      case 2n:
        return new Integer(-1n);
      default:
        return negate(i);
    }
  }

  private isEvenRoot(exp: TreeNode): boolean {
    return isNumerical(exp) && toFraction(exp).denominator % 2n === 0n;
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
  ): TreeNode {
    const rawTerms = [
      ...this.extractTerms(left, false),
      ...this.extractTerms(right, op === "SUBTRACT"),
    ];

    const terms: Term[] = [];

    for (const term of rawTerms) {
      const existing = terms.find((t) => isEqual(t.body, term.body));
      if (existing) {
        existing.coeff = this.evaluateNumericBinary(
          existing.coeff,
          term.coeff,
          "ADD",
        );
      } else {
        terms.push(term);
      }
    }

    return this.buildSum(terms.filter((t) => !isZero(t.coeff)));
  }

  private withCoeff(coeff: TreeNode, body: TreeNode): TreeNode {
    return this.simplify(this.makeTerm(coeff, body));
  }

  private makeTerm(coeff: TreeNode, body: TreeNode): TreeNode {
    if (isZero(coeff)) return ZERO;
    if (isOne(coeff)) return body;
    if (isOne(body)) return coeff;
    return new Multiply(coeff, body);
  }

  private multiplyAll(nodes: readonly TreeNode[]): TreeNode {
    return nodes.reduce((acc, f) => this.simplify(new Multiply(acc, f)), ONE);
  }

  private extractFactors(node: TreeNode): {
    coeff: NumericalNode;
    factors: TreeNode[];
    body: TreeNode;
  } {
    if (isNumerical(node)) {
      return { coeff: node, factors: [], body: ONE };
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
    return { coeff: ONE, factors: [node], body: node };
  }

  private singleFactor(factors: readonly TreeNode[]): TreeNode | undefined {
    return factors.length === 1 ? factors[0] : undefined;
  }

  private getBaseAndExp(node: TreeNode): { base: TreeNode; exp: TreeNode } {
    if (node.type === "POWER") {
      return { base: node.left, exp: node.right };
    }
    return { base: node, exp: ONE };
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

  private packBase(base: TreeNode, exp: TreeNode, abs: boolean): TreeNode {
    if (isZero(exp)) return ONE;
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

        if (isEqual(a.base, b.base)) {
          const bExp = isDivide ? negate(b.exp) : b.exp;

          if (a.abs === b.abs) {
            if (
              !a.abs &&
              (isZero(a.base) ||
                (!this.complex &&
                  !this.isPositive(a.base) &&
                  (!isNumerical(a.exp) || !isNumerical(b.exp))))
            ) {
              continue;
            }
            const totalExp = this.simplify(new Add(a.exp, bExp));
            if (!a.abs && this.losesEvenRoot(a.base, totalExp, a.exp, b.exp)) {
              if (
                !isNumerical(a.exp) ||
                !isNumerical(b.exp) ||
                !isNumerical(totalExp)
              ) {
                continue;
              }
              used[j] = true;
              const f1 = toFraction(a.exp);
              const f2 = toFraction(b.exp);
              const fTotal = toFraction(totalExp);
              const rootDenom = lcm(f1.denominator, f2.denominator);
              const outerExp =
                (fTotal.numerator * rootDenom) / fTotal.denominator;
              const rootNode = this.simplify(
                new Power(a.base, new Fraction(1n, rootDenom)),
              );
              factors.push(new Power(rootNode, new Integer(outerExp)));
            } else {
              used[j] = true;
              if (!isZero(totalExp)) {
                factors.push(this.packBase(a.base, totalExp, a.abs));
              }
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
          const totalAbs = this.simplify(new Add(new Integer(even), absExp));
          if (rem !== 0n) {
            factors.push(this.packBase(a.base, new Integer(rem), false));
          }
          if (!isZero(totalAbs)) {
            factors.push(this.packBase(a.base, totalAbs, true));
          }
          changed = matched = true;
          break;
        } else if (
          isNumerical(a.base) &&
          isNumerical(b.base) &&
          (!isInteger(a.exp) || isOne(a.exp)) &&
          isEqual(a.exp, b.exp) &&
          !(isDivide && isZero(b.base)) &&
          (isOne(a.exp) ||
            (!isNegativeNumber(a.base) && !isNegativeNumber(b.base)) ||
            (!this.complex && isNumerical(a.exp) && !this.isEvenRoot(a.exp)))
        ) {
          used[j] = true;
          const combinedBase = isDivide
            ? this.evaluateNumericDivide(a.base, b.base)
            : this.evaluateNumericMultiply(a.base, b.base);
          factors.push(this.simplify(new Power(combinedBase, a.exp)));
          changed = matched = true;
          break;
        }
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

    const { factors, changed } = this.combineFactors(
      isOne(t1.coeff) ? t1.factors : [t1.coeff, ...t1.factors],
      isOne(t2.coeff) ? t2.factors : [t2.coeff, ...t2.factors],
    );
    if (changed) return this.multiplyAll(factors);

    if (t1.factors.length !== 0 && t2.factors.length !== 0) return null;

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
    if (isZero(combinedCoeff)) return ZERO;

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

      if (
        this.isReal(innerBase) &&
        isEvenInteger(innerExp) &&
        this.isEvenRoot(right)
      ) {
        const base = this.isPositive(innerBase)
          ? innerBase
          : this.simplify(new FunctionCall("abs", [innerBase]));
        return this.simplify(new Power(base, newExp));
      }

      if (
        (this.complex && !this.isPositive(innerBase) && !expInt) ||
        this.losesEvenRoot(innerBase, newExp, innerExp)
      ) {
        return null;
      }

      return this.simplify(new Power(innerBase, newExp));
    }

    if (left.type === "MULTIPLY" && isNumerical(right)) {
      const { coeff, factors } = this.extractFactors(left);
      const isUnrestricted =
        expInt !== null || (!this.complex && !this.isEvenRoot(right));

      const allFactors = isOne(coeff) ? factors : [coeff, ...factors];
      const splittable: TreeNode[] = [];
      const remaining: TreeNode[] = [];

      for (const factor of allFactors) {
        const canSplit = isUnrestricted || this.isPositive(factor);
        if (canSplit) {
          splittable.push(factor);
        } else {
          remaining.push(factor);
        }
      }

      // At most one non-positive factor can still be split safely (e.g. (4x)^(1/2) -> 2x^(1/2))
      if (remaining.length === 1) {
        splittable.push(remaining.pop()!);
      }

      if (splittable.length > 0) {
        let simplifiedAny = expInt !== null;
        const powered = splittable.map((f) => {
          const raw = new Power(f, right);
          const res = this.simplify(raw);
          if (!isEqual(res, raw)) simplifiedAny = true;
          return res;
        });

        if (simplifiedAny) {
          if (remaining.length > 0) {
            powered.push(
              this.simplify(new Power(this.multiplyAll(remaining), right)),
            );
          }
          return this.multiplyAll(powered);
        }
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
      const [n, d] = fracOp(toFraction(left), toFraction(right));
      return this.normalizeFraction(n, d);
    }
    const [coeff, exp] = decOp(
      left.type === "INTEGER" ? new Decimal(left.value, 0n) : left,
      right.type === "INTEGER" ? new Decimal(right.value, 0n) : right,
    );
    return this.normalizeDecimal(coeff, exp);
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
    const f1 = toFraction(left);
    const f2 = toFraction(right);
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

  private evaluateNumericPower(
    left: NumericalNode,
    right: NumericalNode,
  ): TreeNode | null {
    const exp = toFraction(right);
    if (exp.denominator === 1n) {
      return this.evaluatePower(left, exp.numerator);
    }

    const base = toFraction(left);
    const isNegBase = base.numerator < 0n;
    if (isNegBase) {
      if (!this.complex) {
        if (exp.denominator % 2n === 0n) return null;
      } else {
        if (exp.denominator === 2n) {
          const mag = this.simplify(new Power(negate(left), right));
          const rem = exp.numerator & 3n;
          const signedMag = rem === 3n ? this.simplify(negate(mag)) : mag;
          return this.withCoeff(signedMag, new SymbolNode("i"));
        }

        if (isNegativeOne(left)) return null;
        const mag = this.simplify(new Power(negate(left), right));
        return this.withCoeff(mag, new Power(new Integer(-1n), right));
      }
    }

    const absNum = isNegBase ? -base.numerator : base.numerator;
    const rootNum = iNthRoot(absNum, exp.denominator);
    if (rootNum === null) return null;

    const rootDen = iNthRoot(base.denominator, exp.denominator);
    if (rootDen === null) return null;

    const root = this.normalizeFraction(
      isNegBase ? -rootNum : rootNum,
      rootDen,
    );
    return exp.numerator === 1n
      ? root
      : this.evaluatePower(root, exp.numerator);
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
        return this.normalizeDecimal(base.whole ** exp, base.exponent * exp);
      }
    }

    const f = toFraction(base);
    const [num, den, e] =
      exp > 0n
        ? [f.numerator, f.denominator, exp]
        : [f.denominator, f.numerator, -exp];

    return isAbovePowThreshold(num, e) || isAbovePowThreshold(den, e)
      ? new Power(base, new Integer(exp))
      : this.normalizeFraction(num ** e, den ** e);
  }

  private normalizeDecimal(coeff: bigint, exp: bigint): Decimal | Integer {
    if (coeff === 0n) return ZERO;
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
}
