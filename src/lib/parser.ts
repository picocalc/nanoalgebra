import { AlgebraError } from "#lib/errors";
import type { Token } from "#lib/lexer";

import type { TreeNode } from "./nodes";
import {
  Add,
  Decimal,
  Divide,
  FunctionCall,
  Integer,
  Modulo,
  Multiply,
  Power,
  Subtract,
  SymbolNode,
  Undefined,
} from "./nodes";
import { negate } from "./shared";

export class ParserError extends AlgebraError {
  constructor(message: string, pos: number) {
    super("ParserError", message, pos);
  }
}

export interface ParserOptions {
  functions?: ReadonlySet<string>;
}

export class Parser {
  private current: number = 0;

  constructor(
    readonly tokens: Token[],
    readonly options: Readonly<ParserOptions>,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.current];
  }

  private consume(token: Token): Token {
    this.current++;
    return token;
  }

  public parse(): TreeNode {
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

  private parseFunctionCall(name: string, pos: number): FunctionCall {
    const openParen = this.peek();
    if (openParen?.type !== "LPAREN") {
      throw new ParserError(
        `Expected '(' after function '${name}'`,
        openParen?.pos ?? this.tokens.at(-1)?.pos ?? pos,
      );
    }
    this.consume(openParen);

    const firstToken = this.peek();
    if (firstToken?.type === "RPAREN") {
      throw new ParserError(
        `Expected at least one argument for function '${name}'`,
        firstToken.pos,
      );
    }

    const args: [TreeNode, ...TreeNode[]] = [this.parseExpression()];

    let token;
    while ((token = this.peek())) {
      if (token.type !== "COMMA") break;
      this.consume(token);
      args.push(this.parseExpression());
    }

    const closeParen = this.peek();
    if (closeParen?.type !== "RPAREN") {
      throw new ParserError(
        "Expected closing parenthesis",
        closeParen?.pos ?? this.tokens.at(-1)?.pos ?? 0,
      );
    }
    this.consume(closeParen);

    return new FunctionCall(name, args);
  }

  private parseFactor(): TreeNode {
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

      if (token.id === "undefined") {
        return new Undefined(new SymbolNode(token.id));
      }

      if (this.options.functions?.has(token.id)) {
        return this.parseFunctionCall(token.id, token.pos);
      }

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

  private parseExponent(): TreeNode {
    let left = this.parseFactor();

    const token = this.peek();
    if (token?.type === "POW") {
      this.consume(token);
      const right = this.parseUnary();
      left = new Power(left, right);
    }

    return left;
  }

  private parseImplicitMul(prev?: Token): TreeNode {
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

  private parseUnary(): TreeNode {
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

  private parseTerm(): TreeNode {
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

  private parseExpression(): TreeNode {
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
