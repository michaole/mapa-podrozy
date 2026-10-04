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

/**
 * Codes the browser names but that are not current countries: groupings and
 * test regions, sub-territories, and withdrawn codes that browsers map onto a
 * modern name (DD → "Niemcy", SU → "Rosja", YU/CS → "Serbia", UK → "Wielka
 * Brytania"…), which would show up as duplicates and save a code the map
 * cannot draw. XK (Kosovo) stays: Google uses it.
 */
const SKIP = new Set([
  "EU", "EZ", "UN", "QO", "XA", "XB", "ZZ",
  "AC", "CP", "CQ", "DG", "EA", "IC", "TA",
  "AN", "BU", "CS", "DD", "DY", "FX", "HV", "NH", "NT", "RH", "SU", "TP", "UK", "VD", "YD", "YU", "ZR",
]);

/** All current ISO 3166-1 alpha-2 codes the browser can name, sorted by Polish name. */
export function allCountries(): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      if (name && name !== code && !/^[A-Z]{2}$/.test(name)) out.push({ code, name });
    }
  }
  return out.filter((c) => !SKIP.has(c.code)).sort((x, y) => x.name.localeCompare(y.name, "pl"));
}
