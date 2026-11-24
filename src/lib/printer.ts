import type { BinaryNode, Decimal, DefinedNodeType, TreeNode } from "./nodes";
import { isAbovePowThreshold, isNegativeNumber, isNumerical } from "./shared";

const PRECEDENCE = {
  INTEGER: 4,
  DECIMAL: 4,
  SYMBOL: 4,
  FUNCTION: 4,
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

function startsWithNegSign(node: TreeNode): boolean {
  if (node.type === "UNDEFINED") return startsWithNegSign(node.node);
  if (isNegativeNumber(node)) return true;
  if (node.type === "MULTIPLY" || node.type === "DIVIDE") {
    return startsWithNegSign(node.left);
  }
  return false;
}

function printBinary(self: BinaryNode, operator: string): string {
  const { left, right } = self;
  const p = PRECEDENCE[self.type];

  const [needParenthesesLeft, needParenthesesRight] = isRightAssociative(self)
    ? [
        startsWithNegSign(left) || getPrecedence(left) <= p,
        getPrecedence(right) < p,
      ]
    : [getPrecedence(left) < p, getPrecedence(right) <= p];

  const l = needParenthesesLeft ? `(${printNode(left)})` : printNode(left);
  const r = needParenthesesRight ? `(${printNode(right)})` : printNode(right);
  return `${l}${operator}${r}`;
}

function printNode(node: TreeNode): string {
  switch (node.type) {
    case "UNDEFINED":
      return printNode(node.node);

    case "INTEGER":
      return node.value.toString();

    case "DECIMAL":
      return formatDecimal(node);

    case "FRACTION":
      return `${node.numerator}/${node.denominator}`;

    case "ADD":
      return printBinary(node, " + ");

    case "SUBTRACT":
      return printBinary(node, " - ");

    case "MULTIPLY": {
      const { left, right } = node;
      if (
        left.type === "INTEGER" &&
        left.value === -1n &&
        right.type !== "INTEGER" &&
        right.type !== "DECIMAL" &&
        right.type !== "UNDEFINED" &&
        !startsWithNegSign(right)
      ) {
        const needsParens =
          right.type === "ADD" ||
          right.type === "SUBTRACT" ||
          right.type === "DIVIDE" ||
          right.type === "MOD" ||
          (right.type === "MULTIPLY" &&
            !(
              isNumerical(right.left) &&
              (right.right.type === "SYMBOL" ||
                right.right.type === "FUNCTION" ||
                (right.right.type === "POWER" &&
                  right.right.left.type === "SYMBOL"))
            ));
        const r = needsParens ? `(${printNode(right)})` : printNode(right);
        return `-${r}`;
      }
      if (
        right.type === "SYMBOL" ||
        right.type === "FUNCTION" ||
        (right.type === "POWER" && right.left.type === "SYMBOL")
      ) {
        if (left.type === "INTEGER" || left.type === "DECIMAL") {
          return `${printNode(left)}${printNode(right)}`;
        }
        if (left.type === "FRACTION") {
          const coeff =
            left.numerator === 1n
              ? ""
              : left.numerator === -1n
                ? "-"
                : `${left.numerator}`;
          return `${coeff}${printNode(right)}/${left.denominator}`;
        }
      }
      return printBinary(node, " * ");
    }

    case "DIVIDE":
      return printBinary(node, " / ");

    case "MOD":
      return printBinary(node, " % ");

    case "POWER":
      return printBinary(node, "^");

    case "SYMBOL":
      return node.name;

    case "FUNCTION":
      return `${node.name}(${node.args.map((n) => printNode(n)).join(", ")})`;
  }
}

function formatDecimal({ whole, exponent }: Decimal): string {
  if (whole === 0n) return "0";
  const isNegative = whole < 0n;
  const s = (isNegative ? -whole : whole).toString();
  if (isAbovePowThreshold(10n, exponent)) {
    const exp = exponent + BigInt(s.length - 1);
    const trimmed = s.replace(/0+$/, "");
    const mantissa =
      trimmed.length > 1 ? `${trimmed[0]}.${trimmed.slice(1)}` : trimmed;
    const result = `${mantissa}e${exp}`;
    return isNegative ? `-${result}` : result;
  }
  const exp = Number(exponent);
  if (exp >= 0) return whole.toString() + "0".repeat(exp);
  const padded = s.padStart(1 - exp, "0");
  const cut = padded.length + exp;
  const result = `${padded.slice(0, cut)}.${padded.slice(cut)}`;
  return isNegative ? `-${result}` : result;
}

export { printNode, formatDecimal };
