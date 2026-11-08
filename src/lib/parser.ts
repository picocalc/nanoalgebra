import { AlgebraError } from "#lib/errors";
import type { Token } from "#lib/lexer";

import { Add, Constant, Subtract, TreeNode } from "./nodes";

export class ParserError extends AlgebraError {
  constructor(message: string, pos: number) {
    super("LexerError", message, pos);
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
    return this.parseExpression();
  }

  private parsePrimary(): TreeNode {
    const token = this.consume();

    if (token.type === "NUMBER") {
      const numToken = token;
      return new Constant(numToken.whole);
    }

    throw new ParserError(`Unexpected token type '${token.type}'`, token.pos);
  }

  private parseExpression(): TreeNode {
    let left: TreeNode = this.parsePrimary();

    while (!this.isAtEnd()) {
      const token = this.peek();

      if (!token) break;

      if (token.type === "PLUS") {
        this.consume();
        const right = this.parsePrimary();
        left = new Add(left, right);
      } else if (token.type === "MINUS") {
        this.consume();
        const right = this.parsePrimary();
        left = new Subtract(left, right);
      } else {
        break;
      }
    }

    return left;
  }
}
