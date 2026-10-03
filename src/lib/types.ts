export type PlaceStatus = "visited" | "wishlist";
export type PlaceCategory = "restaurant" | "hotel" | "attraction" | "city" | "other";

/** 'both' = together, otherwise the user id of the one person who was there */
export type Who = "both" | (string & {});

export interface ExtraCountry {
  code: string;
  who: Who;
}

export type CountryColor = "gold" | "terracotta" | "pine" | "sea" | "plum";

export interface Space {
  id: string;
  name: string;
  country_color: CountryColor;
}

/** Fill colours for visited countries (chosen per shared map in Ustawienia). */
export const COUNTRY_COLORS: Record<CountryColor, { label: string; hex: string }> = {
  gold: { label: "Złoty", hex: "#c9962b" },
  terracotta: { label: "Terakota", hex: "#b85c38" },
  pine: { label: "Sosna", hex: "#1f6b5c" },
  sea: { label: "Morski", hex: "#2f6f93" },
  plum: { label: "Śliwka", hex: "#7d4b7a" },
};

export interface Member {
  user_id: string;
  role: "owner" | "member";
  profile: { display_name: string | null; avatar_url: string | null } | null;
}

export interface Trip {
  id: string;
  space_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  who: Who;
}

export interface Place {
  id: string;
  space_id: string;
  status: PlaceStatus;
  category: PlaceCategory;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  google_place_id: string | null;
  google_maps_uri: string | null;
  rating: number | null;
  trip_id: string | null;
  visited_on: string | null;
  notes: string | null;
  who: Who;
  created_at: string;
}

export type NewPlace = Omit<Place, "id" | "space_id" | "created_at">;

export interface Photo {
  id: string;
  space_id: string;
  trip_id: string | null;
  place_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  restaurant: "Restauracja",
  hotel: "Hotel",
  attraction: "Atrakcja",
  city: "Miasto",
  other: "Inne",
};

export const STATUS_LABEL: Record<PlaceStatus, string> = {
  visited: "Byliśmy",
  wishlist: "Chcemy",
};
