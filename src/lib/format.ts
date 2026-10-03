export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
}

export const STATUS_COLOR = { visited: "#1f6b5c", wishlist: "#c8673a" } as const;
