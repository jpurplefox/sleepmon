/**
 * Floor-down formatter: displays an integer always floored (never rounded up),
 * formatted with the en-US locale (comma thousands separator).
 */
export const fdown = (n: number) => Math.floor(n).toLocaleString("en-US");

/** Ceiling formatter, for shortfalls: any fraction still missing counts as one more. */
export const fup = (n: number) => Math.ceil(n).toLocaleString("en-US");

/** Compact formatter for figures that must fit a narrow column: exact below 10,000
 * (where "1.23K" would save no room over "1,227" and only lose precision), then three
 * significant digits with K/M (15.1K, 535K, 1.14M). */
export const fcompact = (n: number) =>
  Math.abs(n) < 10_000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { notation: "compact", maximumSignificantDigits: 3 });
