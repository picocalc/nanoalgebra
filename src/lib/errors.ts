export class AlgebraError extends Error {
  pos?: number;
  constructor(name: string, message: string, pos?: number) {
    if (pos === undefined) {
      super(message);
    } else {
      super(`${message} at position ${pos}`);
    }
    this.pos = pos;
    this.name = name;
  }
}
