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

const PRECEDENCE = {
  INTEGER: 4,
  DECIMAL: 4,
  SYMBOL: 4,
  POWER: 3,
  MULTIPLY: 2,
  FRACTION: 2,
  DIVIDE: 2,
  MOD: 2,
  ADD: 1,
  SUBTRACT: 1,
} as const satisfies Record<NodeType, number>;

function getPrecedence(node: TreeNode): number {
  return PRECEDENCE[node.type];
}

function printSelf(self: BinaryNode, operator: string): string {
  const { left, right } = self;
  const p = getPrecedence(self);
  const l = getPrecedence(left) < p ? `(${left.print()})` : left.print();
  const r = getPrecedence(right) < p ? `(${right.print()})` : right.print();
  return `${l}${operator}${r}`;
}

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
    if (right.type === "SYMBOL" || right.type === "POWER") {
      if (left.type === "INTEGER" && left.value === -1n) {
        return `-${right.print()}`;
      }
      if (left.type === "INTEGER" || left.type === "DECIMAL") {
        return `${left.print()}${right.print()}`;
      }
      if (left.type === "FRACTION") {
        const coeff = left.numerator === 1n ? "" : `${left.numerator}`;
        return `${coeff}${right.print()}/${left.denominator}`;
      }
    }
    return printSelf(this, " * ");
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
    return printSelf(this, " / ");
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
    return printSelf(this, " % ");
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
    return printSelf(this, "^");
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

export type BinaryNode = Add | Subtract | Multiply | Divide | Modulo | Power;

export type SymbolicNode = SymbolNode | BinaryNode;

export type TreeNode = NumericalNode | SymbolicNode;
