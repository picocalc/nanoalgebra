import { Decimal, Integer, type TreeNode } from "./nodes";

export class Evaluator {
  constructor() {}

  public evaluate(node: TreeNode): Decimal | Integer {
    switch (node.type) {
      case "INTEGER":
        return node;

      case "DECIMAL":
        return node;

      case "ADD":
      case "SUBTRACT": {
        const left = this.toDecimal(this.evaluate(node.left));
        const right = this.toDecimal(this.evaluate(node.right));

        let c1 = left.whole;
        let e1 = left.exponent;
        let c2 = right.whole;
        let e2 = right.exponent;

        if (e1 > e2) {
          c1 *= 10n ** (e1 - e2);
          e1 = e2;
        } else if (e2 > e1) {
          c2 *= 10n ** (e2 - e1);
          e2 = e1;
        }

        const coeff = node.type === "ADD" ? c1 + c2 : c1 - c2;

        return this.normalize(coeff, e1);
      }

      case "MULTIPLY": {
        const left = this.toDecimal(this.evaluate(node.left));
        const right = this.toDecimal(this.evaluate(node.right));

        const coeff = left.whole * right.whole;
        const exp = left.exponent + right.exponent;

        return this.normalize(coeff, exp);
      }

      default:
        throw new Error(`Unknown node type during evaluation`);
    }
  }

  public toDecimal(node: Decimal | Integer): Decimal {
    if (node.type === "INTEGER") {
      return new Decimal(node.value, 0n);
    }
    return node;
  }

  private normalize(coeff: bigint, exp: bigint): Decimal | Integer {
    if (coeff === 0n) {
      return new Integer(0);
    }

    while (coeff % 10n === 0n && exp < 0n) {
      coeff /= 10n;
      exp += 1n;
    }

    if (exp === 0n) {
      return new Integer(coeff);
    }
    return new Decimal(coeff, exp);
  }
}
