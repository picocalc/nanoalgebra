type NodeType = "INTEGER" | "DECIMAL" | "ADD" | "SUBTRACT" | "MULTIPLY";

abstract class BaseNode<T extends NodeType = NodeType> {
  readonly type: T;

  constructor(type: T) {
    this.type = type;
  }

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
  readonly whole: bigint;
  readonly exponent: bigint;

  constructor(whole: bigint, exponent: bigint) {
    super("DECIMAL");
    this.whole = whole;
    this.exponent = exponent;
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

export type TreeNode = Integer | Decimal | Add | Subtract | Multiply;
