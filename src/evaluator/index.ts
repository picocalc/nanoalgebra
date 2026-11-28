import { ONE, ZERO } from "#lib/constants";
import { negate, normalizeDecimal, tryToFraction } from "#lib/convert";
import { isEqual } from "#lib/equality";
import type { DefinedNode, Modulo, TreeNode } from "#lib/nodes";
import {
  Add,
  Divide,
  Fraction,
  FunctionCall,
  Integer,
  Multiply,
  Power,
  Subtract,
  SymbolNode,
  Undefined,
} from "#lib/nodes";
import {
  isAbovePowThreshold,
  isEvenInteger,
  isEvenRoot,
  isI,
  isNegativeNumber,
  isNegativeOne,
  isNumerical,
  isOne,
  isZero,
  tryGetIntegerValue,
} from "#lib/shared";
import { lcm } from "#math/lcm";

import type { Term } from "./ast";
import {
  extractFactors,
  extractTerms,
  getBaseAndExp,
  rebuildBinary,
} from "./ast";
import type { DomainOptions } from "./domain";
import { Domain } from "./domain";
import {
  evaluateNumericBinary,
  evaluateNumericDivide,
  evaluateNumericFloorCeil,
  evaluateNumericMod,
  evaluateNumericMultiply,
  evaluateNumericPower,
  evaluatePowerMod,
} from "./numeric";

export { constants } from "./domain";
export type EvaluatorOptions = DomainOptions;

export class Evaluator {
  private readonly domain: Domain;

  constructor(options: Readonly<EvaluatorOptions> = {}) {
    this.domain = new Domain(options);
  }

  public simplify(node: TreeNode): TreeNode {
    switch (node.type) {
      case "INTEGER":
      case "FRACTION":
      case "UNDEFINED":
        return node;

      case "DECIMAL": {
        if (node.whole === 0n) return ZERO;
        if (node.exponent <= 0n) {
          return normalizeDecimal(node.whole, node.exponent);
        }
        if (isAbovePowThreshold(10n, node.exponent)) return node;
        return new Integer(node.whole * 10n ** node.exponent);
      }

      case "SYMBOL": {
        if (this.domain.of(node) === "complex" && !this.domain.complex) {
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
          return this.power(args[0], new Fraction(1n, 2n));
        }
        if (name === "floor" || name === "ceil") {
          return this.evaluateFloorCeil(args[0], name);
        }
        return simplified;
      }

      case "MULTIPLY":
        return this.multiply(
          this.simplify(node.left),
          this.simplify(node.right),
        );

      case "POWER":
        return this.power(this.simplify(node.left), this.simplify(node.right));

      default:
        return this.simplifyBinary(node);
    }
  }

  private simplifyBinary(node: Add | Subtract | Divide | Modulo): TreeNode {
    const left = this.simplify(node.left);
    const right = this.simplify(node.right);
    const simplified = rebuildBinary(node.type, left, right);

    if (left.type === "UNDEFINED" || right.type === "UNDEFINED") {
      return new Undefined(simplified);
    }

    switch (node.type) {
      case "ADD":
      case "SUBTRACT": {
        if (isNumerical(left) && isNumerical(right)) {
          const evaluated = evaluateNumericBinary(left, right, node.type);
          if (evaluated) return evaluated;
        }
        if (isZero(left)) {
          return node.type === "ADD" ? right : this.simplify(negate(right));
        }
        if (isZero(right)) return left;
        return this.tryAddSubtractSymbolic(left, right, node.type);
      }

      case "DIVIDE": {
        if (isZero(right)) return new Undefined(simplified);
        if (isOne(right)) return left;
        if (isZero(left)) return ZERO;
        if (isNumerical(left) && isNumerical(right)) {
          const evaluated = evaluateNumericDivide(left, right);
          if (evaluated) return evaluated;
        }
        return this.tryDivideSymbolic(left, right) ?? simplified;
      }

      case "MOD": {
        if (isZero(right)) return new Undefined(simplified);
        if (isZero(left)) return ZERO;
        if (isNumerical(left) && isNumerical(right)) {
          const evaluated = evaluateNumericMod(left, right);
          if (evaluated) return evaluated;
        }
        if (left.type === "POWER" && isNumerical(right)) {
          const evaluated = evaluatePowerMod(left, right);
          if (evaluated) return evaluated;
        }
        return simplified;
      }
    }
  }

  private multiply(left: TreeNode, right: TreeNode): TreeNode {
    const simplified = rebuildBinary("MULTIPLY", left, right);

    if (left.type === "UNDEFINED" || right.type === "UNDEFINED") {
      return new Undefined(simplified);
    }

    if (isZero(left) || isZero(right)) return ZERO;
    if (isOne(left)) return right;
    if (isOne(right)) return left;
    if (isNumerical(left) && isNumerical(right)) {
      const evaluated = evaluateNumericMultiply(left, right);
      if (evaluated) return evaluated;
    }
    return this.tryMultiplySymbolic(left, right) ?? simplified;
  }

  private power(left: TreeNode, right: TreeNode): TreeNode {
    const simplified = rebuildBinary("POWER", left, right);

    if (left.type === "UNDEFINED" || right.type === "UNDEFINED") {
      return new Undefined(simplified);
    }
    const unpacked = this.unpackBase(left);
    if (unpacked.abs && isOne(unpacked.exp) && isEvenInteger(right)) {
      return this.power(unpacked.base, right);
    }
    if (isOne(right)) return left;
    if (isZero(right) || isOne(left)) return ONE;
    if (isZero(left)) {
      if (this.domain.isPositive(right)) return left;
      if (this.domain.isNegative(right)) return new Undefined(simplified);
      return simplified;
    }
    if (
      !this.domain.complex &&
      isEvenRoot(right) &&
      (isNegativeNumber(left) || this.domain.of(left) === "negative")
    ) {
      return new Undefined(simplified);
    }
    if (isNumerical(left) && isNumerical(right)) {
      if (this.domain.complex && isNegativeNumber(left)) {
        const exp = tryToFraction(right);
        if (exp && exp.denominator !== 1n) {
          const mag = this.power(negate(left), right);
          if (exp.denominator === 2n) {
            const c = (exp.numerator & 3n) === 3n ? negate(mag) : mag;
            return this.multiply(c, new SymbolNode("i"));
          }
          if (isNegativeOne(left)) return simplified;
          return this.multiply(mag, new Power(new Integer(-1n), right));
        }
      }
      const evaluated = evaluateNumericPower(left, right);
      if (evaluated) return evaluated;
    }
    const expInt = tryGetIntegerValue(right);
    return this.tryExponentiateSymbolic(left, right, expInt) ?? simplified;
  }

  private evaluateAbs(node: TreeNode): TreeNode {
    if (isNumerical(node)) return isNegativeNumber(node) ? negate(node) : node;
    if (isI(node)) return ONE;
    if (this.domain.isPositive(node)) return node;
    if (this.domain.isNegative(node)) return this.simplify(negate(node));
    if (node.type === "MULTIPLY") {
      const { coeff, factors } = extractFactors(node);
      const nonUnitFactors = factors.filter((f) => !isI(f));
      if (!isOne(coeff) || nonUnitFactors.length < factors.length) {
        if (nonUnitFactors.length === 0) return this.evaluateAbs(coeff);
        return this.multiply(
          this.evaluateAbs(coeff),
          this.evaluateAbs(this.multiplyAll(nonUnitFactors)),
        );
      }
    }
    return new FunctionCall("abs", [node]);
  }

  private evaluateFloorCeil(node: TreeNode, op: "floor" | "ceil"): TreeNode {
    if (this.domain.isInteger(node)) return node;
    if (isNumerical(node)) return evaluateNumericFloorCeil(node, op);
    if (node.type === "MULTIPLY" && isNegativeNumber(node.left)) {
      return this.simplify(
        negate(
          new FunctionCall(op === "floor" ? "ceil" : "floor", [
            this.multiply(negate(node.left), node.right),
          ]),
        ),
      );
    }
    if (node.type === "ADD" || node.type === "SUBTRACT") {
      const terms = extractTerms(node);
      const nonIntTerms: Term[] = [];
      const intTerms: Term[] = [];

      for (const term of terms) {
        if (
          this.domain.isInteger(term.coeff) &&
          this.domain.isInteger(term.body)
        ) {
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
    return this.appendTerms(this.multiply(first.coeff, first.body), rest);
  }

  private appendTerms(initial: TreeNode, terms: readonly Term[]): TreeNode {
    let acc = initial;
    for (const term of terms) {
      if (isNegativeNumber(term.coeff)) {
        acc = new Subtract(acc, this.multiply(negate(term.coeff), term.body));
      } else {
        acc = new Add(acc, this.multiply(term.coeff, term.body));
      }
    }
    return acc;
  }

  private tryAddSubtractSymbolic(
    left: DefinedNode,
    right: DefinedNode,
    op: "ADD" | "SUBTRACT",
  ): TreeNode {
    const rawTerms = [
      ...extractTerms(left, false),
      ...extractTerms(right, op === "SUBTRACT"),
    ];

    const terms: Term[] = [];

    for (const term of rawTerms) {
      const existing = terms.find((t) => isEqual(t.body, term.body));
      if (!existing) {
        terms.push(term);
        continue;
      }
      const merged = evaluateNumericBinary(existing.coeff, term.coeff, "ADD");
      if (!merged) {
        terms.push(term);
        continue;
      }
      existing.coeff = merged;
    }

    return this.buildSum(terms.filter((t) => !isZero(t.coeff)));
  }

  private multiplyAll(nodes: readonly TreeNode[]): TreeNode {
    return nodes.reduce((acc, f) => this.multiply(acc, f), ONE);
  }

  private unpackBase(node: TreeNode) {
    const { base, exp } = getBaseAndExp(node);
    const abs =
      base.type === "FUNCTION" &&
      base.name === "abs" &&
      base.args.length === 1 &&
      this.domain.isReal(base.args[0]);
    return { base: abs ? base.args[0] : base, exp, abs };
  }

  private packBase(base: TreeNode, exp: TreeNode, abs: boolean): TreeNode {
    if (isZero(exp)) return ONE;
    const target =
      abs &&
      !this.domain.isPositive(base) &&
      !(this.domain.isReal(base) && isEvenInteger(exp))
        ? new FunctionCall("abs", [base])
        : base;
    return this.power(target, exp);
  }

  private combineFactors(
    leftFactors: readonly TreeNode[],
    rightFactors: readonly TreeNode[],
    isDivide = false,
  ): { factors: TreeNode[]; remainingDen: TreeNode[]; changed: boolean } {
    const used = Array.from<boolean>({ length: rightFactors.length }).fill(
      false,
    );
    const factors: TreeNode[] = [];
    let changed = false;

    for (const leftFactor of leftFactors) {
      let matched = false;
      for (const [j, rightFactor] of rightFactors.entries()) {
        if (used[j]) continue;
        const merged = this.tryMergeFactorPair(
          leftFactor,
          rightFactor,
          isDivide,
        );
        if (!merged) continue;
        used[j] = true;
        factors.push(...merged);
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

  private tryMergeFactorPair(
    leftFactor: TreeNode,
    rightFactor: TreeNode,
    isDivide: boolean,
  ): TreeNode[] | null {
    const a = this.unpackBase(leftFactor);
    const b = this.unpackBase(rightFactor);

    if (isEqual(a.base, b.base)) {
      const bExp = isDivide ? negate(b.exp) : b.exp;

      if (a.abs === b.abs) {
        if (
          !a.abs &&
          (isZero(a.base) ||
            (!this.domain.complex &&
              !this.domain.isPositive(a.base) &&
              (!isNumerical(a.exp) || !isNumerical(b.exp))))
        ) {
          return null;
        }
        const totalExp = this.simplify(new Add(a.exp, bExp));
        if (isZero(totalExp)) return [];
        if (
          !a.abs &&
          this.domain.losesEvenRoot(a.base, totalExp, a.exp, b.exp)
        ) {
          if (
            !isNumerical(a.exp) ||
            !isNumerical(b.exp) ||
            !isNumerical(totalExp)
          ) {
            return null;
          }
          const f1 = tryToFraction(a.exp);
          const f2 = tryToFraction(b.exp);
          const fTotal = tryToFraction(totalExp);
          if (!f1 || !f2 || !fTotal) return null;
          const rootDenom = lcm(f1.denominator, f2.denominator);
          const outerExp = (fTotal.numerator * rootDenom) / fTotal.denominator;
          const rootNode = this.power(a.base, new Fraction(1n, rootDenom));
          return [new Power(rootNode, new Integer(outerExp))];
        }
        return isZero(totalExp) ? [] : [this.packBase(a.base, totalExp, a.abs)];
      }

      const [uExp, absExp] = a.abs ? [bExp, a.exp] : [a.exp, bExp];
      const n = tryGetIntegerValue(uExp);
      const rem = n !== null ? n % 2n : 0n;
      const even = n !== null ? n - rem : 0n;
      if (even === 0n) return null;

      const totalAbs = this.simplify(new Add(new Integer(even), absExp));
      const merged: TreeNode[] = [];
      if (rem !== 0n) {
        merged.push(this.packBase(a.base, new Integer(rem), false));
      }
      if (!isZero(totalAbs)) {
        merged.push(this.packBase(a.base, totalAbs, true));
      }
      return merged;
    }

    if (
      isNumerical(a.base) &&
      isNumerical(b.base) &&
      (!this.domain.isInteger(a.exp) || isOne(a.exp)) &&
      isEqual(a.exp, b.exp) &&
      !(isDivide && isZero(b.base)) &&
      (isOne(a.exp) ||
        (!isNegativeNumber(a.base) && !isNegativeNumber(b.base)) ||
        (!this.domain.complex && isNumerical(a.exp) && !isEvenRoot(a.exp)))
    ) {
      const combinedBase = isDivide
        ? evaluateNumericDivide(a.base, b.base)
        : evaluateNumericMultiply(a.base, b.base);
      if (!combinedBase) return null;
      return [this.power(combinedBase, a.exp)];
    }

    return null;
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

    const t1 = extractFactors(left);
    const t2 = extractFactors(right);

    const { factors, changed } = this.combineFactors(
      isOne(t1.coeff) ? t1.factors : [t1.coeff, ...t1.factors],
      isOne(t2.coeff) ? t2.factors : [t2.coeff, ...t2.factors],
    );
    if (changed) return this.multiplyAll(factors);

    if (t1.factors.length !== 0 && t2.factors.length !== 0) return null;

    const coeff = evaluateNumericMultiply(t1.coeff, t2.coeff);
    if (!coeff) return null;

    const body = isOne(t1.body) ? t2.body : t1.body;
    if (
      isNegativeOne(coeff) &&
      (body.type === "ADD" || body.type === "SUBTRACT")
    ) {
      return this.buildSum(extractTerms(body, true));
    }
    return new Multiply(coeff, body);
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

    const num = extractFactors(left);
    const den = extractFactors(right);

    const iFactor = den.factors.find((f) => {
      const { base, exp } = getBaseAndExp(f);
      return isI(base) && tryGetIntegerValue(exp) !== null;
    });
    if (iFactor) {
      const { base, exp } = getBaseAndExp(iFactor);
      const invI = this.power(base, this.simplify(negate(exp)));
      const restDen = den.factors.filter((f) => f !== iFactor);
      const newDen = this.multiply(den.coeff, this.multiplyAll(restDen));
      return this.simplify(new Divide(this.multiply(left, invI), newDen));
    }

    if (num.factors.length === 0) {
      const factor = den.factors.length === 1 ? den.factors[0] : undefined;
      if (!factor) return null;

      const coeff = evaluateNumericDivide(num.coeff, den.coeff);
      if (!coeff) return null;

      const { base, exp } = getBaseAndExp(factor);
      return this.multiply(coeff, this.power(base, this.simplify(negate(exp))));
    }

    if (den.factors.length === 0) {
      const coeff = evaluateNumericDivide(num.coeff, den.coeff);
      if (!coeff) return null;

      return this.multiply(coeff, num.body);
    }

    const { factors, remainingDen, changed } = this.combineFactors(
      num.factors,
      den.factors,
      true,
    );
    if (!changed && isOne(den.coeff)) return null;

    const combined = evaluateNumericDivide(num.coeff, den.coeff);
    if (!combined) return null;
    if (isZero(combined)) return ZERO;

    const numNode = this.multiply(combined, this.multiplyAll(factors));
    return this.simplify(new Divide(numNode, this.multiplyAll(remainingDen)));
  }

  private tryExponentiateSymbolic(
    left: DefinedNode,
    right: DefinedNode,
    expInt: bigint | null,
  ): TreeNode | null {
    if (isI(left) && expInt !== null) {
      switch (expInt & 3n) {
        case 0n:
          return ONE;
        case 1n:
          return left;
        case 2n:
          return new Integer(-1n);
        default:
          return negate(left);
      }
    }

    if (left.type === "POWER") {
      const innerBase = left.left;
      const innerExp = left.right;
      const newExp = this.multiply(innerExp, right);

      if (
        this.domain.isReal(innerBase) &&
        isEvenInteger(innerExp) &&
        isEvenRoot(right)
      ) {
        const base = this.domain.isPositive(innerBase)
          ? innerBase
          : this.simplify(new FunctionCall("abs", [innerBase]));
        return this.power(base, newExp);
      }

      if (
        (this.domain.complex &&
          !this.domain.isPositive(innerBase) &&
          !expInt) ||
        this.domain.losesEvenRoot(innerBase, newExp, innerExp)
      ) {
        return null;
      }

      return this.power(innerBase, newExp);
    }

    if (left.type === "MULTIPLY" && isNumerical(right)) {
      const { coeff, factors } = extractFactors(left);
      const isUnrestricted =
        expInt !== null || (!this.domain.complex && !isEvenRoot(right));

      const allFactors = isOne(coeff) ? factors : [coeff, ...factors];
      const splittable: TreeNode[] = [];
      const remaining: TreeNode[] = [];

      for (const factor of allFactors) {
        const canSplit = isUnrestricted || this.domain.isPositive(factor);
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
          const res = this.power(f, right);
          if (!isEqual(res, raw)) simplifiedAny = true;
          return res;
        });

        if (simplifiedAny) {
          if (remaining.length > 0) {
            powered.push(this.power(this.multiplyAll(remaining), right));
          }
          return this.multiplyAll(powered);
        }
      }
    }

    return null;
  }
}
