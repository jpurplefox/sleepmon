/**
 * Floor-down formatter: displays an integer always floored (never rounded up),
 * formatted with the en-US locale (comma thousands separator).
 */
export const fdown = (n: number) => Math.floor(n).toLocaleString("en-US");

/** Ceiling formatter, for shortfalls: any fraction still missing counts as one more. */
export const fup = (n: number) => Math.ceil(n).toLocaleString("en-US");
