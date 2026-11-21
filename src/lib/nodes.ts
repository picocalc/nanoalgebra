import { gcd } from "#math/gcd";

import { EvaluatorError } from "./errors";
import { formatDecimal } from "./shared";

export type BinaryOpType =
  | "ADD"
  | "SUBTRACT"
  | "MULTIPLY"
  | "DIVIDE"
  | "MOD"
  | "POWER";
export type DefinedNodeType =
  | "INTEGER"
  | "DECIMAL"
  | "FRACTION"
  | "SYMBOL"
  | "FUNCTION"
  | BinaryOpType;

type NodeType = DefinedNodeType | "UNDEFINED";

abstract class BaseNode<T extends NodeType = NodeType> {
  constructor(readonly type: T) {}
  abstract toString(): string;
}

export class Undefined extends BaseNode<"UNDEFINED"> {
  constructor(readonly node: DefinedNode) {
    super("UNDEFINED");
  }

  toString(): string {
    return "undefined";
  }
}

export class Integer extends BaseNode<"INTEGER"> {
  readonly value: bigint;

  constructor(value: string | number | bigint) {
    super("INTEGER");
    this.value = BigInt(value);
  }

  toString(): string {
    const s = this.value.toString();
    return this.value < 0n ? `(${s})` : s;
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
    const s = formatDecimal(this);
    return this.whole < 0n ? `(${s})` : s;
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
    return `(${this.left.toString()} ^ ${this.right.toString()})`;
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

export class FunctionCall extends BaseNode<"FUNCTION"> {
  constructor(
    readonly name: string,
    readonly args: readonly [TreeNode, ...TreeNode[]],
  ) {
    super("FUNCTION");
  }

  toString(): string {
    return `${this.name}(${this.args.map((n) => n.toString()).join(", ")})`;
  }
}

export type NumericalNode = Integer | Decimal | Fraction;

export type BinaryNode = Add | Subtract | Multiply | Divide | Modulo | Power;

export type SymbolicNode = SymbolNode | FunctionCall | BinaryNode;

export type DefinedNode = NumericalNode | SymbolicNode;

export type TreeNode = DefinedNode | Undefined;
