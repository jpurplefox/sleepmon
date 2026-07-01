/**
 * Floor-down formatter: displays an integer always floored (never rounded up),
 * formatted with the en-US locale (comma thousands separator).
 */
export const fdown = (n: number) => Math.floor(n).toLocaleString("en-US");
