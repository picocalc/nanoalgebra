import { negate } from "./convert";
import type { TreeNode } from "./nodes";

function flattenAdditive(
  node: TreeNode,
  neg = false,
  out: TreeNode[] = [],
): TreeNode[] {
  if (node.type === "ADD") {
    flattenAdditive(node.left, neg, out);
    flattenAdditive(node.right, neg, out);
    return out;
  }
  if (node.type === "SUBTRACT") {
    flattenAdditive(node.left, neg, out);
    flattenAdditive(node.right, !neg, out);
    return out;
  }
  out.push(neg ? negate(node) : node);
  return out;
}

function flattenMultiply(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  if (node.type !== "MULTIPLY") {
    out.push(node);
    return out;
  }
  flattenMultiply(node.left, out);
  flattenMultiply(node.right, out);
  return out;
}

function areOperandListsEqual(left: TreeNode[], right: TreeNode[]): boolean {
  if (left.length !== right.length) return false;

  const matched = Array.from<boolean>({ length: right.length }).fill(false);
  return left.every((l) => {
    const i = right.findIndex((r, i) => !matched[i] && isEqual(l, r));
    if (i === -1) return false;
    matched[i] = true;
    return true;
  });
}

export function isEqual(left: TreeNode, right: TreeNode): boolean {
  if (left.type === "SYMBOL" && right.type === "SYMBOL") {
    return left.name === right.name;
  }
  if (left.type === "INTEGER" && right.type === "INTEGER") {
    return left.value === right.value;
  }
  if (left.type === "DECIMAL" && right.type === "DECIMAL") {
    return left.whole === right.whole && left.exponent === right.exponent;
  }
  if (left.type === "FRACTION" && right.type === "FRACTION") {
    return (
      left.numerator === right.numerator &&
      left.denominator === right.denominator
    );
  }
  if (left.type === "POWER" && right.type === "POWER") {
    return isEqual(left.left, right.left) && isEqual(left.right, right.right);
  }
  if (left.type === "MULTIPLY" && right.type === "MULTIPLY") {
    return areOperandListsEqual(flattenMultiply(left), flattenMultiply(right));
  }
  if (
    (left.type === "ADD" || left.type === "SUBTRACT") &&
    (right.type === "ADD" || right.type === "SUBTRACT")
  ) {
    return areOperandListsEqual(flattenAdditive(left), flattenAdditive(right));
  }
  if (left.type === "FUNCTION" && right.type === "FUNCTION") {
    return (
      left.name === right.name &&
      left.args.length === right.args.length &&
      left.args.every((val, i) => right.args[i] && isEqual(val, right.args[i]))
    );
  }
  return false;
}
