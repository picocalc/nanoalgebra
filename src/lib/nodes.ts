import { gcd } from "#math/gcd";

import { EvaluatorError } from "./evaluator";

type NodeType =
  | "INTEGER"
  | "DECIMAL"
  | "FRACTION"
  | "SYMBOL"
  | "ADD"
  | "SUBTRACT"
  | "MULTIPLY"
  | "DIVIDE"
  | "MOD"
  | "POWER";

abstract class BaseNode<T extends NodeType = NodeType> {
  constructor(readonly type: T) {}

  abstract toString(): string;
}

export class Integer extends BaseNode<"INTEGER"> {
  readonly value: bigint;

  constructor(value: string | number | bigint) {
    super("INTEGER");
    this.value = BigInt(value);
  }

  toString(): string {
    return this.value.toString();
  }
}

export class Decimal extends BaseNode<"DECIMAL"> {
  constructor(
    readonly whole: bigint,
    readonly exponent: bigint,
  ) {
    super("DECIMAL");
  }

  toString(): string {
    let s = this.whole.toString();
    const isNegative = s.startsWith("-");
    if (isNegative) {
      s = s.slice(1);
    }

    const exp = Number(this.exponent);
    let result: string;

    if (exp === 0) {
      result = s;
    } else if (exp > 0) {
      result = s + "0".repeat(exp);
    } else {
      const absExp = -exp;
      if (s.length <= absExp) {
        result = `0.${s.padStart(absExp, "0")}`;
      } else {
        const idx = s.length - absExp;
        result = `${s.slice(0, idx)}.${s.slice(idx)}`;
      }
    }

    return isNegative ? `-${result}` : result;
  }
}

export class Fraction extends BaseNode<"FRACTION"> {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint, denominator: bigint) {
    super("FRACTION");
    if (denominator === 0n) throw new EvaluatorError("Division by zero");

    let n = numerator;
    let d = denominator;
    if (d < 0n) {
      n = -n;
      d = -d;
    }

    const g = gcd(n < 0n ? -n : n, d);
    this.numerator = n / g;
    this.denominator = d / g;
  }

  toString(): string {
    if (this.denominator === 1n) return this.numerator.toString();
    return `${this.numerator}/${this.denominator}`;
  }
}

export class Add extends BaseNode<"ADD"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("ADD");
  }

  toString(): string {
    return `(${this.left.toString()} + ${this.right.toString()})`;
  }
}

export class Subtract extends BaseNode<"SUBTRACT"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("SUBTRACT");
  }

  toString(): string {
    return `(${this.left.toString()} - ${this.right.toString()})`;
  }
}

export class Multiply extends BaseNode<"MULTIPLY"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("MULTIPLY");
  }

  toString(): string {
    const { left, right } = this;
    if (
      (right.type === "SYMBOL" || right.type === "POWER") &&
      left.type !== "SYMBOL" &&
      left.type !== "POWER"
    ) {
      if (left.type === "INTEGER" && left.value === -1n) {
        return `-${right.toString()}`;
      }
      return `${left.toString()}${right.toString()}`;
    }
    return `(${left.toString()} * ${right.toString()})`;
  }
}

export class Divide extends BaseNode<"DIVIDE"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("DIVIDE");
  }

  toString(): string {
    const { left, right } = this;
    return `(${left.toString()} / ${right.toString()})`;
  }
}

export class Modulo extends BaseNode<"MOD"> {
  readonly left: TreeNode;
  readonly right: TreeNode;

  constructor(left: TreeNode, right: TreeNode) {
    super("MOD");
    this.left = left;
    this.right = right;
  }

  toString(): string {
    return `(${this.left.toString()} % ${this.right.toString()})`;
  }
}

export class Power extends BaseNode<"POWER"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("POWER");
  }

  toString(): string {
    const { left, right } = this;
    if (left.type === "SYMBOL" || right.type === "SYMBOL") {
      return `${left.toString()}^${right.toString()}`;
    }
    return `(${left.toString()} ^ ${right.toString()})`;
  }
}

export class SymbolNode extends BaseNode<"SYMBOL"> {
  constructor(readonly name: string) {
    super("SYMBOL");
  }

  toString(): string {
    return this.name;
  }
}

export function isNumerical(node: TreeNode): node is NumericalNode {
  return (
    node.type === "INTEGER" ||
    node.type === "DECIMAL" ||
    node.type === "FRACTION"
  );
}

export type NumericalNode = Integer | Decimal | Fraction;

export type TreeNode =
  | NumericalNode
  | SymbolNode
  | Add
  | Subtract
  | Multiply
  | Divide
  | Modulo
  | Power;
