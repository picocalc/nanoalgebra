export type NodeType = "CONSTANT" | "ADD" | "SUBTRACT" | "MULTIPLY";

export abstract class TreeNode<T extends NodeType = NodeType> {
  readonly type: T;

  constructor(type: T) {
    this.type = type;
  }

  abstract evaluate(env?: Record<string, bigint>): bigint;
  abstract toString(): string;
}

export class Constant extends TreeNode<"CONSTANT"> {
  readonly value: bigint;

  constructor(value: string | number | bigint) {
    super("CONSTANT");
    this.value = BigInt(value);
  }

  evaluate(): bigint {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }
}

export class Add extends TreeNode<"ADD"> {
  readonly left: TreeNode;
  readonly right: TreeNode;

  constructor(left: TreeNode, right: TreeNode) {
    super("ADD");
    this.left = left;
    this.right = right;
  }

  evaluate(env?: Record<string, bigint>): bigint {
    return this.left.evaluate(env) + this.right.evaluate(env);
  }

  toString(): string {
    return `(${this.left.toString()} + ${this.right.toString()})`;
  }
}

export class Subtract extends TreeNode<"SUBTRACT"> {
  readonly left: TreeNode;
  readonly right: TreeNode;

  constructor(left: TreeNode, right: TreeNode) {
    super("SUBTRACT");
    this.left = left;
    this.right = right;
  }

  evaluate(env?: Record<string, bigint>): bigint {
    return this.left.evaluate(env) - this.right.evaluate(env);
  }

  toString(): string {
    return `(${this.left.toString()} - ${this.right.toString()})`;
  }
}

export class Multiply extends TreeNode<"MULTIPLY"> {
  readonly left: TreeNode;
  readonly right: TreeNode;

  constructor(left: TreeNode, right: TreeNode) {
    super("MULTIPLY");
    this.left = left;
    this.right = right;
  }

  evaluate(env?: Record<string, bigint>): bigint {
    return this.left.evaluate(env) * this.right.evaluate(env);
  }

  toString(): string {
    return `(${this.left.toString()} * ${this.right.toString()})`;
  }
}
