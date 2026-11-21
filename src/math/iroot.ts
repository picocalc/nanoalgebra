export function iNthRoot(value: bigint, n: bigint): bigint | null {
  if (value < 0n || n <= 0n) return null;
  if (value === 0n || value === 1n || n === 1n) return value;

  // If 2^n > value, any root > 1 exceeds value (avoids huge exponentiation for large n)
  const bits = BigInt.bitLength(value);
  if (n >= bits) return null;

  const nMinus1 = n - 1n;
  let x = 1n << ((bits + nMinus1) / n);

  while (true) {
    const next = (nMinus1 * x + value / x ** nMinus1) / n;
    if (next >= x) break;
    x = next;
  }

  return x ** n === value ? x : null;
}
