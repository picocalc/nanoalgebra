import { AlgebraError } from "#lib/errors";
import type { Token } from "#lib/lexer";

import { Add, Constant, Multiply, Subtract, TreeNode } from "./nodes";

export class ParserError extends AlgebraError {
  constructor(message: string, pos: number) {
    super("ParserError", message, pos);
  }
}

export class Parser {
  private readonly tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.current];
  }

  private consume(): Token {
    const token = this.peek();
    if (!token) {
      throw new ParserError(
        "Unexpected end of expression",
        this.tokens.at(-1)?.pos ?? 0,
      );
    }
    this.current++;
    return token;
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length;
  }

  public parse(): TreeNode {
    if (this.tokens.length === 0) {
      throw new ParserError("Empty expression", 0);
    }
    const node = this.parseExpression();
    if (!this.isAtEnd()) {
      const token = this.peek()!;
      throw new ParserError(`Unexpected token '${token.type}'`, token.pos);
    }
    return node;
  }

  private parseFactor(): TreeNode {
    const token = this.peek();

    if (!token) {
      throw new ParserError(
        "Unexpected end of expression",
        this.tokens.at(-1)?.pos ?? 0,
      );
    }

    if (token.type === "PLUS") {
      this.consume();
      return this.parseFactor();
    }

    if (token.type === "MINUS") {
      this.consume();
      const operand = this.parseFactor();
      return new Subtract(new Constant(0), operand);
    }

    if (token.type === "NUMBER") {
      this.consume();
      return new Constant(token.whole);
    }

    if (token.type === "LPAREN") {
      this.consume();
      const node = this.parseExpression();
      const nextToken = this.peek();
      if (nextToken?.type !== "RPAREN") {
        throw new ParserError(
          "Expected closing parenthesis",
          nextToken?.pos ?? this.tokens.at(-1)?.pos ?? 0,
        );
      }
      this.consume();
      return node;
    }

    throw new ParserError(`Unexpected token type '${token.type}'`, token.pos);
  }

  private parseImplicitMul(): TreeNode {
    let left: TreeNode = this.parseFactor();

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (!token) break;

      if (token.type === "NUMBER" || token.type === "LPAREN") {
        const right = this.parseFactor();
        left = new Multiply(left, right);
      } else {
        break;
      }
    }

    return left;
  }

  private parseTerm(): TreeNode {
    let left: TreeNode = this.parseImplicitMul();

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token?.type !== "MUL") break;

      this.consume();
      const right = this.parseImplicitMul();
      left = new Multiply(left, right);
    }

    return left;
  }

  private parseExpression(): TreeNode {
    let left: TreeNode = this.parseTerm();

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (!token) break;

      if (token.type === "PLUS") {
        this.consume();
        const right = this.parseTerm();
        left = new Add(left, right);
      } else if (token.type === "MINUS") {
        this.consume();
        const right = this.parseTerm();
        left = new Subtract(left, right);
      } else {
        break;
      }
    }

    return left;
  }
}
