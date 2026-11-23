import { ONE } from "#lib/constants";
import { negate } from "#lib/convert";
import type {
  BinaryOpType,
  DefinedNode,
  NumericalNode,
  TreeNode,
} from "#lib/nodes";
import { Add, Divide, Modulo, Multiply, Power, Subtract } from "#lib/nodes";
import { isNumerical, isOne } from "#lib/shared";

export function rebuildBinary(
  type: BinaryOpType,
  left: TreeNode,
  right: TreeNode,
): DefinedNode {
  switch (type) {
    case "ADD":
      return new Add(left, right);
    case "SUBTRACT":
      return new Subtract(left, right);
    case "MULTIPLY":
      return new Multiply(left, right);
    case "DIVIDE":
      return new Divide(left, right);
    case "MOD":
      return new Modulo(left, right);
    case "POWER":
      return new Power(left, right);
  }
}

export function extractFactors(node: TreeNode): {
  coeff: NumericalNode;
  factors: TreeNode[];
  body: TreeNode;
} {
  if (isNumerical(node)) {
    return { coeff: node, factors: [], body: ONE };
  }
  if (node.type === "MULTIPLY") {
    const left = extractFactors(node.left);
    const right = extractFactors(node.right);
    // Invariant: extractFactors is only called on simplified nodes, and
    // tryMultiplySymbolic always merges pairs where both sides have a non-1
    // coeff. Thus at most one side can have a non-1 coeff here.
    const coeff = isOne(left.coeff) ? right.coeff : left.coeff;
    const body = isOne(left.body)
      ? right.body
      : new Multiply(left.body, right.body);
    return { coeff, factors: [...left.factors, ...right.factors], body };
  }
  return { coeff: ONE, factors: [node], body: node };
}

export type Term = { coeff: NumericalNode; body: TreeNode };

export function extractTerms(node: TreeNode, isSubtract = false): Term[] {
  if (node.type === "ADD") {
    return [
      ...extractTerms(node.left, isSubtract),
      ...extractTerms(node.right, isSubtract),
    ];
  }
  if (node.type === "SUBTRACT") {
    return [
      ...extractTerms(node.left, isSubtract),
      ...extractTerms(node.right, !isSubtract),
    ];
  }
  const { coeff, body } = extractFactors(node);
  return [{ coeff: isSubtract ? negate(coeff) : coeff, body }];
}
