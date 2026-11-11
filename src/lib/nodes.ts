import { gcd } from "#math/gcd";

import { EvaluatorError } from "./evaluator";
import { isNegative } from "./shared";

type DefinedNodeType =
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

type NodeType = DefinedNodeType | "UNDEFINED";

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
} as const satisfies Record<DefinedNodeType, number>;

function getPrecedence(node: TreeNode) {
  if (node.type === "UNDEFINED") return getPrecedence(node.node);
  return PRECEDENCE[node.type];
}

function isRightAssociative(node: BinaryNode) {
  return node.type === "POWER";
}

function printSelf(self: BinaryNode, operator: string): string {
  const { left, right } = self;
  const p = PRECEDENCE[self.type];

  const [needParenthesesLeft, needParenthesesRight] = isRightAssociative(self)
    ? [isNegative(left) || getPrecedence(left) <= p, getPrecedence(right) < p]
    : [getPrecedence(left) < p, getPrecedence(right) <= p];

  const l = needParenthesesLeft ? `(${left.print()})` : left.print();
  const r = needParenthesesRight ? `(${right.print()})` : right.print();
  return `${l}${operator}${r}`;
}

abstract class BaseNode<T extends NodeType = NodeType> {
  constructor(readonly type: T) {}
  abstract print(): string;
  abstract toString(): string;
}

export class Undefined extends BaseNode<"UNDEFINED"> {
  constructor(readonly node: DefinedNode) {
    super("UNDEFINED");
  }

  print(): string {
    return this.node.print();
  }
  toString(): string {
    return "UNDEFINED";
  }
}

export class Integer extends BaseNode<"INTEGER"> {
  readonly value: bigint;

  constructor(value: string | number | bigint) {
    super("INTEGER");
    this.value = BigInt(value);
  }

  print(): string {
    return this.value.toString();
  }
  toString(): string {
    const s = this.print();
    return isNegative(this) ? `(${s})` : s;
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
    const { whole, exponent } = this;
    const exp = Number(exponent);
    if (exp >= 0) return whole.toString() + "0".repeat(exp);
    const isNegative = whole < 0n;
    const s = (isNegative ? -whole : whole).toString();
    const padded = s.padStart(1 - exp, "0");
    const cut = padded.length + exp;
    const result = `${padded.slice(0, cut)}.${padded.slice(cut)}`;
    return isNegative ? `-${result}` : result;
  }
  toString(): string {
    const s = this.print();
    return isNegative(this) ? `(${s})` : s;
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
    return printSelf(this, " + ");
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
    return printSelf(this, " - ");
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
      left.type === "INTEGER" &&
      left.value === -1n &&
      right.type !== "INTEGER" &&
      right.type !== "DECIMAL" &&
      !isNegative(right)
    ) {
      const needsParens =
        getPrecedence(right) < getPrecedence(this) ||
        right.type === "DIVIDE" ||
        right.type === "MOD" ||
        (right.type === "MULTIPLY" &&
          right.right.type !== "SYMBOL" &&
          right.right.type !== "POWER");
      const r = needsParens ? `(${right.print()})` : right.print();
      return `-${r}`;
    }
    if (
      right.type === "SYMBOL" ||
      (right.type === "POWER" && right.left.type === "SYMBOL")
    ) {
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
  constructor(
    readonly left: TreeNode,
    readonly right: TreeNode,
  ) {
    super("MOD");
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

export type DefinedNode = NumericalNode | SymbolicNode;

export type TreeNode = DefinedNode | Undefined;
