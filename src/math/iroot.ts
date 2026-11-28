function iNthRoot(value: bigint, n: bigint): bigint | null {
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

const MAX_TRIAL_FACTOR = 10_000n;

export function extractNthRoot(
  value: bigint,
  n: bigint,
): { outside: bigint; inside: bigint } {
  if (value === 0n) return { outside: 0n, inside: 1n };
  if (value === 1n || n <= 1n || BigInt.bitLength(value) <= n) {
    return { outside: 1n, inside: value };
  }

  const exact = iNthRoot(value, n);
  if (exact !== null) return { outside: exact, inside: 1n };

  let outside = 1n;
  let inside = 1n;
  let rem = value;

  const extractFactor = (p: bigint): void => {
    if (rem % p !== 0n) return;
    let count = 0n;
    while (rem % p === 0n) {
      rem /= p;
      count += 1n;
    }
    const q = count / n;
    const r = count % n;
    if (q > 0n) outside *= p ** q;
    if (r > 0n) inside *= p ** r;

    if (rem > 1n && BigInt.bitLength(rem) > n) {
      const root = iNthRoot(rem, n);
      if (root !== null) {
        outside *= root;
        rem = 1n;
      }
    }
  };

  extractFactor(2n);
  if (rem > 1n && BigInt.bitLength(rem) > n) {
    extractFactor(3n);
  }

  for (
    let p = 5n;
    p <= MAX_TRIAL_FACTOR && p * p <= rem && BigInt.bitLength(rem) > n;
    p += 6n
  ) {
    extractFactor(p);
    const p2 = p + 2n;
    if (
      rem > 1n &&
      p2 <= MAX_TRIAL_FACTOR &&
      p2 * p2 <= rem &&
      BigInt.bitLength(rem) > n
    ) {
      extractFactor(p2);
    }
  }

  return { outside, inside: inside * rem };
}
