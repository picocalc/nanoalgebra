export function mergeMapWithDefaults<K, V>(
  defaults: ReadonlyMap<K, V>,
  overrides?: ReadonlyMap<K, V | undefined>,
): ReadonlyMap<K, V> {
  if (!overrides?.size) return defaults;

  const result = new Map(defaults);
  for (const [key, value] of overrides) {
    if (value === undefined) {
      result.delete(key);
    } else {
      result.set(key, value);
    }
  }
  return result;
}

export function mergeSetWithDefaults<T>(
  defaults: ReadonlySet<T>,
  overrides?: ReadonlySet<T>,
): ReadonlySet<T> {
  if (!overrides?.size) return defaults;
  return new Set([...defaults, ...overrides]); // TODO(Roman): use `Set.union`
}
