import { gcd } from "#math/gcd";

type NodeType =
  | "INTEGER"
  | "DECIMAL"
  | "FRACTION"
  | "ADD"
  | "SUBTRACT"
  | "MULTIPLY"
  | "DIVIDE";

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
    const s = this.whole.toString();
    const exp = Number(this.exponent);
    if (exp === 0) return s;
    if (exp > 0) return s + "0".repeat(exp);

    const absExp = -exp;
    if (s.length <= absExp) {
      return `0.${s.padStart(absExp, "0")}`;
    }
    const idx = s.length - absExp;
    return `${s.slice(0, idx)}.${s.slice(idx)}`;
  }
}

export class Fraction extends BaseNode<"FRACTION"> {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint, denominator: bigint) {
    super("FRACTION");
    if (denominator === 0n) throw new Error("Division by zero");

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

export type TreeNode =
  | Integer
  | Decimal
  | Fraction
  | Add
  | Subtract
  | Multiply
  | Divide;
