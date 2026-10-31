const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Removes keys that enable NoSQL operator injection (`$ne`, `$gt`...), dotted
 * path injection (`a.b`), and prototype pollution - in place, recursively.
 * Works on `req.body`, `req.query` and `req.params`.
 */
export const stripDangerousKeys = (value: unknown, depth = 0): void => {
  if (depth > 20 || value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) stripDangerousKeys(item, depth + 1);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
      delete record[key];
    } else {
      stripDangerousKeys(record[key], depth + 1);
    }
  }
};

/** Copies `source` without the listed keys (non-mutating). */
export const omitKeys = <T extends Record<string, unknown>>(source: T, keys: readonly string[]): Partial<T> => {
  const copy: Record<string, unknown> = { ...source };
  for (const key of keys) delete copy[key];
  return copy as Partial<T>;
};
