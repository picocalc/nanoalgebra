import { AlgebraError } from "#lib/errors";
import type { Token } from "#lib/lexer";

import type { DefinedNode } from "./nodes";
import {
  Add,
  Decimal,
  Divide,
  Integer,
  Modulo,
  Multiply,
  Power,
  Subtract,
  SymbolNode,
} from "./nodes";

export class ParserError extends AlgebraError {
  constructor(message: string, pos: number) {
    super("ParserError", message, pos);
  }
}

export function negate(node: DefinedNode): DefinedNode {
  if (node.type === "INTEGER") return new Integer(-node.value);
  if (node.type === "DECIMAL") return new Decimal(-node.whole, node.exponent);
  return new Multiply(new Integer(-1), node);
}

export class Parser {
  private current: number = 0;

  constructor(readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.current];
  }

  private consume(token: Token): Token {
    this.current++;
    return token;
  }

  public parse(): DefinedNode {
    if (this.tokens.length === 0) {
      throw new ParserError("Empty expression", 0);
    }
    const node = this.parseExpression();
    const token = this.peek();
    if (token) {
      throw new ParserError(`Unexpected token '${token.type}'`, token.pos);
    }
    return node;
  }

  private parseFactor(): DefinedNode {
    const token = this.peek();

    if (!token) {
      throw new ParserError(
        "Unexpected end of expression",
        this.tokens.at(-1)?.pos ?? 0,
      );
    }

    if (token.type === "NUMBER") {
      this.consume(token);

      if (token.fraction !== undefined || token.exponent !== undefined) {
        const wholePart = token.whole === "" ? "0" : token.whole;
        const fracPart = token.fraction ?? "";
        const combinedCoeff = BigInt(wholePart + fracPart);

        let exp = -BigInt(fracPart.length);
        if (token.exponent !== undefined) {
          exp += BigInt(token.exponent);
        }

        return new Decimal(combinedCoeff, exp);
      }

      return new Integer(token.whole);
    }

    if (token.type === "IDENTIFIER") {
      this.consume(token);
      return new SymbolNode(token.id);
    }

    if (token.type === "LPAREN") {
      this.consume(token);
      const node = this.parseExpression();
      const nextToken = this.peek();
      if (nextToken?.type !== "RPAREN") {
        throw new ParserError(
          "Expected closing parenthesis",
          nextToken?.pos ?? this.tokens.at(-1)?.pos ?? 0,
        );
      }
      this.consume(nextToken);
      return node;
    }

    throw new ParserError(`Unexpected token type '${token.type}'`, token.pos);
  }

  private parseExponent(): DefinedNode {
    let left = this.parseFactor();

    const token = this.peek();
    if (token?.type === "POW") {
      this.consume(token);
      const right = this.parseUnary();
      left = new Power(left, right);
    }

    return left;
  }

  private parseImplicitMul(prev?: Token): DefinedNode {
    let left = this.parseExponent();

    let token;
    while ((token = this.peek())) {
      const canImplicitMultiply =
        token.type === "LPAREN" ||
        token.type === "IDENTIFIER" ||
        (token.type === "NUMBER" &&
          (prev?.type === "RPAREN" || prev?.type === "LPAREN"));

      if (canImplicitMultiply) {
        const right = this.parseExponent();
        prev = undefined;
        left = new Multiply(left, right);
      } else {
        break;
      }
    }

    return left;
  }

  private parseUnary(): DefinedNode {
    const token = this.peek();

    if (token?.type === "PLUS") {
      this.consume(token);
      return this.parseUnary();
    }

    if (token?.type === "MINUS") {
      this.consume(token);
      return negate(this.parseUnary());
    }

    return this.parseImplicitMul(token);
  }

  private parseTerm(): DefinedNode {
    let left = this.parseUnary();

    let token;
    while ((token = this.peek())) {
      if (token.type === "MUL") {
        this.consume(token);
        const right = this.parseUnary();
        left = new Multiply(left, right);
      } else if (token.type === "DIV") {
        this.consume(token);
        const right = this.parseUnary();
        left = new Divide(left, right);
      } else if (token.type === "MOD") {
        this.consume(token);
        const right = this.parseUnary();
        left = new Modulo(left, right);
      } else {
        break;
      }
    }

    return left;
  }

  private parseExpression(): DefinedNode {
    let left = this.parseTerm();

    let token;
    while ((token = this.peek())) {
      if (token.type === "PLUS") {
        this.consume(token);
        const right = this.parseTerm();
        left = new Add(left, right);
      } else if (token.type === "MINUS") {
        this.consume(token);
        const right = this.parseTerm();
        left = new Subtract(left, right);
      } else {
        break;
      }
    }

    return left;
  }
}
