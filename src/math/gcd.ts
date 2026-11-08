export function gcd(a: bigint, b: bigint): bigint {
  if (a === b) return a;
  if (a === 1n || b === 1n) return 1n;
  if (a === 0n) return b;
  if (b === 0n) return a;

  a = a < 0 ? -a : a;
  b = b < 0 ? -b : b;

  while (b > 0) {
    a %= b;
    [a, b] = [b, a];
  }
  return a;
}
