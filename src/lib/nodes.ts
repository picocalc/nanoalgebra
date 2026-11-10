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

  abstract print(): string;
  abstract toString(): string;
}

export class Integer extends BaseNode<"INTEGER"> {
  readonly value: bigint;

  constructor(value: string | number | bigint) {
    super("INTEGER");
    this.value = BigInt(value);
  }

  print(): string {
    return this.toString();
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

  print(): string {
    return this.toString();
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
  constructor(
    readonly numerator: bigint,
    readonly denominator: bigint,
  ) {
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

  print(): string {
    return `${this.numerator}/${this.denominator}`;
  }
  toString(): string {
    return `(${this.numerator}/${this.denominator})`;
  }
}

export class Add extends BaseNode<"ADD"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("ADD");
  }

  print(): string {
    return `${this.left.print()} + ${this.right.print()}`;
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

  print(): string {
    return `${this.left.print()} - ${this.right.print()}`;
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

  print(): string {
    const { left, right } = this;
    if (
      (right.type === "SYMBOL" || right.type === "POWER") &&
      left.type === "INTEGER"
    ) {
      if (left.value === -1n) {
        return `-${right.print()}`;
      }
      return `${left.print()}${right.print()}`;
    }
    if (
      (right.type === "SYMBOL" || right.type === "POWER") &&
      left.type === "FRACTION"
    ) {
      if (left.numerator === 1n) {
        return `${right.print()}/${left.denominator}`;
      }
      return `${left.numerator}${right.print()}/${left.denominator}`;
    }
    return `${left.print()} * ${right.print()}`;
  }
  toString(): string {
    return `(${this.left.toString()} * ${this.right.toString()})`;
  }
}

export class Divide extends BaseNode<"DIVIDE"> {
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("DIVIDE");
  }

  print(): string {
    return `${this.left.print()} / ${this.right.print()}`;
  }
  toString(): string {
    return `(${this.left.toString()} / ${this.right.toString()})`;
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

  print(): string {
    return `${this.left.print()} % ${this.right.print()}`;
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

  print(): string {
    const { left, right } = this;
    if (
      right.type === "POWER" ||
      right.type === "SYMBOL" ||
      right.type === "INTEGER" ||
      right.type === "DECIMAL"
    ) {
      return `${left.print()}^${right.print()}`;
    }
    return `${left.print()}^(${right.print()})`;
  }
  toString(): string {
    return `(${this.left.toString()} ^ ${this.right.toString()})`;
  }
}

export class SymbolNode extends BaseNode<"SYMBOL"> {
  constructor(readonly name: string) {
    super("SYMBOL");
  }

  print(): string {
    return this.name;
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

export type SymbolicNode =
  | SymbolNode
  | Add
  | Subtract
  | Multiply
  | Divide
  | Modulo
  | Power;

export type TreeNode = NumericalNode | SymbolicNode;
