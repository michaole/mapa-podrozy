import type { CountryColor, ExtraCountry, Member, Place, Trip, Who } from "./types";
import { COUNTRY_COLORS } from "./types";

export const memberName = (m: Member) => m.profile?.display_name?.trim() || "Bez imienia";

export function whoLabel(who: Who, members: Member[]): string {
  if (who === "both") return "Razem";
  const m = members.find((x) => x.user_id === who);
  return m ? memberName(m) : "Ktoś, kto opuścił mapę";
}

/** A place on a trip takes "who" from the trip; otherwise its own. */
export function effectiveWho(place: Place, trips: Trip[]): Who {
  const trip = place.trip_id ? trips.find((t) => t.id === place.trip_id) : undefined;
  return trip ? trip.who : place.who;
}

/** A person's colour for solo countries: their choice, else sea (owner) / plum (others). */
export function memberColor(m: Member): CountryColor {
  return m.profile?.color ?? (m.role === "owner" ? "sea" : "plum");
}

/**
 * Who each visited country belongs to on the map: 'both' when you were
 * there together (wins over solo visits) or when each of you went
 * separately; otherwise the one person who went.
 */
export function countryOwners(places: Place[], trips: Trip[], extra: ExtraCountry[]): Map<string, Who> {
  const seen = new Map<string, Set<Who>>();
  const add = (code: string, who: Who) => {
    const c = code.toUpperCase();
    if (!seen.has(c)) seen.set(c, new Set());
    seen.get(c)!.add(who);
  };
  for (const p of places) if (p.status === "visited" && p.country_code) add(p.country_code, effectiveWho(p, trips));
  for (const e of extra) add(e.code, e.who);
  const out = new Map<string, Who>();
  for (const [code, whos] of seen) out.set(code, whos.has("both") || whos.size > 1 ? "both" : [...whos][0]);
  return out;
}

export function colorHex(c: CountryColor) {
  return (COUNTRY_COLORS[c] ?? COUNTRY_COLORS.gold).hex;
}
