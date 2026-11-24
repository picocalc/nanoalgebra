import type { TreeNode } from "#lib/nodes";
import {
  isEvenInteger,
  isEvenRoot,
  isNegativeNumber,
  isNumerical,
  isZero,
  tryGetIntegerValue,
} from "#lib/shared";
import { mergeMapWithDefaults } from "#utils/merge";

export type SymbolDomain = "positive" | "negative" | "real" | "complex";

export interface DomainOptions {
  constants?: ReadonlyMap<string, SymbolDomain>;
  complex?: boolean;
}

export const constants: ReadonlyMap<string, SymbolDomain> = new Map([
  ["pi", "positive"],
  ["e", "positive"],
  ["i", "complex"],
]);

export class Domain {
  private readonly constants: ReadonlyMap<string, SymbolDomain>;
  public readonly complex: boolean;

  constructor(options: Readonly<DomainOptions> = {}) {
    this.complex = options.complex ?? false;
    this.constants = mergeMapWithDefaults(constants, options.constants);
  }

  public of(node: TreeNode): SymbolDomain | undefined {
    return node.type === "SYMBOL" ? this.constants.get(node.name) : undefined;
  }

  public isReal(node: TreeNode): boolean {
    if (!this.complex || isNumerical(node)) return true;
    const domain = this.of(node);
    return domain === "positive" || domain === "negative" || domain === "real";
  }

  public isPositive(node: TreeNode): boolean {
    if (isNumerical(node)) return !isNegativeNumber(node) && !isZero(node);
    if (this.of(node) === "positive") return true;
    if (node.type === "FUNCTION") {
      if (node.name === "abs") return true;
      if (node.name === "floor" || node.name === "ceil") {
        return this.isPositive(node.args[0]);
      }
    }
    if (node.type === "POWER") {
      if (
        this.isReal(node.left) &&
        (isEvenInteger(node.right) ||
          (isEvenRoot(node.right) && !this.isNegative(node.left)))
      ) {
        return true;
      }
      return this.isPositive(node.left) && this.isReal(node.right);
    }
    if (node.type === "ADD") {
      return this.isPositive(node.left) && this.isPositive(node.right);
    }
    if (node.type === "SUBTRACT") {
      return this.isPositive(node.left) && this.isNegative(node.right);
    }
    if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
      return (
        (this.isPositive(node.left) && this.isPositive(node.right)) ||
        (this.isNegative(node.left) && this.isNegative(node.right))
      );
    }
    return false;
  }

  public isNegative(node: TreeNode): boolean {
    if (isNegativeNumber(node)) return true;
    if (this.of(node) === "negative") return true;
    if (node.type === "POWER") {
      const exp = tryGetIntegerValue(node.right);
      return exp !== null && exp % 2n !== 0n && this.isNegative(node.left);
    }
    if (node.type === "ADD") {
      return this.isNegative(node.left) && this.isNegative(node.right);
    }
    if (node.type === "SUBTRACT") {
      return this.isNegative(node.left) && this.isPositive(node.right);
    }
    if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
      return (
        (this.isPositive(node.left) && this.isNegative(node.right)) ||
        (this.isNegative(node.left) && this.isPositive(node.right))
      );
    }
    return false;
  }

  public isInteger(node: TreeNode): boolean {
    if (node.type === "INTEGER") return true;
    if (node.type === "DECIMAL") return node.exponent >= 0n;
    if (
      node.type === "FUNCTION" &&
      node.args.length === 1 &&
      (node.name === "floor" ||
        node.name === "ceil" ||
        (node.name === "abs" && this.isInteger(node.args[0])))
    ) {
      return true;
    }
    if (
      node.type === "ADD" ||
      node.type === "SUBTRACT" ||
      node.type === "MULTIPLY"
    ) {
      return this.isInteger(node.left) && this.isInteger(node.right);
    }
    if (node.type === "POWER") {
      return (
        this.isInteger(node.left) &&
        this.isInteger(node.right) &&
        this.isPositive(node.right)
      );
    }
    return false;
  }

  public losesEvenRoot(
    base: TreeNode,
    newExp: TreeNode,
    exp1: TreeNode,
    exp2?: TreeNode,
  ): boolean {
    return (
      !this.complex &&
      !this.isPositive(base) &&
      (isEvenRoot(exp1) || (!!exp2 && isEvenRoot(exp2))) &&
      !isEvenRoot(newExp)
    );
  }
}
