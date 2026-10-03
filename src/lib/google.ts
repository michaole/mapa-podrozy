import type { NewPlace, PlaceCategory } from "./types";

const CATEGORY_TYPES: [PlaceCategory, string[]][] = [
  ["hotel", ["lodging", "hotel", "resort_hotel", "hostel", "bed_and_breakfast", "guest_house", "motel", "inn"]],
  ["restaurant", ["restaurant", "cafe", "bar", "bakery", "food", "meal_takeaway", "coffee_shop", "wine_bar", "pub"]],
  ["city", ["locality", "administrative_area_level_3", "postal_town", "sublocality"]],
  ["attraction", ["tourist_attraction", "museum", "park", "natural_feature", "point_of_interest", "church",
    "historical_landmark", "beach", "art_gallery", "zoo", "aquarium", "national_park"]],
];

export function guessCategory(types: string[] = []): PlaceCategory {
  for (const [category, keys] of CATEGORY_TYPES) {
    if (types.some((t) => keys.includes(t) || keys.some((k) => t.endsWith(`_${k}`)))) return category;
  }
  return "other";
}

/** Fields fetched for a chosen suggestion (Places API New, billed per field set). */
export const PLACE_FIELDS = [
  "id", "displayName", "formattedAddress", "location", "addressComponents",
  "rating", "googleMapsURI", "types",
];

export function placeToNew(place: google.maps.places.Place): Omit<NewPlace, "status"> {
  const comps = place.addressComponents ?? [];
  const find = (type: string) => comps.find((c) => c.types.includes(type));
  const country = find("country");
  const city = find("locality") ?? find("postal_town") ?? find("administrative_area_level_2");
  const loc = place.location!;
  return {
    category: guessCategory(place.types ?? []),
    name: place.displayName ?? "Bez nazwy",
    address: place.formattedAddress ?? null,
    lat: loc.lat(),
    lng: loc.lng(),
    country_code: country?.shortText?.toUpperCase() ?? null,
    country_name: country?.longText ?? null,
    city: city?.longText ?? null,
    google_place_id: place.id,
    google_maps_uri: place.googleMapsURI ?? null,
    rating: place.rating ?? null,
    trip_id: null,
    visited_on: null,
    notes: null,
  };
}

export const mapsLink = (p: { google_maps_uri: string | null; google_place_id: string | null; lat: number; lng: number; name: string }) =>
  p.google_maps_uri ??
  (p.google_place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.google_place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`);
