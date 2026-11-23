import type { BinaryOpType, DefinedNode, TreeNode } from "#lib/nodes";
import { Add, Divide, Modulo, Multiply, Power, Subtract } from "#lib/nodes";

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
