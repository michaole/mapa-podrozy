const names = new Intl.DisplayNames(["pl"], { type: "region" });

export function countryName(code: string): string {
  try {
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function flag(code: string): string {
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

/** All ISO 3166-1 alpha-2 codes the browser can name, sorted by Polish name. */
export function allCountries(): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      if (name && name !== code && !/^[A-Z]{2}$/.test(name)) out.push({ code, name });
    }
  }
  // drop non-country regions the API also names
  const skip = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "XK", "ZZ", "AC", "CP", "DG", "EA", "IC", "TA"]);
  return out.filter((c) => !skip.has(c.code)).sort((x, y) => x.name.localeCompare(y.name, "pl"));
}
