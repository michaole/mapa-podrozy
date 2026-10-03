import type { Member, Place, Trip, Who } from "./types";

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
