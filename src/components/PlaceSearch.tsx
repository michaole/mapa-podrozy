import { useEffect, useRef, useState } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { NewPlace } from "../lib/types";
import { PLACE_FIELDS, placeToNew } from "../lib/google";

type Suggestion = google.maps.places.AutocompleteSuggestion;

/** Google Places (New) autocomplete with our own list UI. */
export default function PlaceSearch({ onPick }: { onPick: (draft: Omit<NewPlace, "status">) => void }) {
  const places = useMapsLibrary("places");
  const map = useMap();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!places || query.trim().length < 2) { setItems([]); return; }
    token.current ??= new places.AutocompleteSessionToken();
    const handle = window.setTimeout(async () => {
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token.current!,
          language: "pl",
          locationBias: map?.getBounds() ?? undefined,
        });
        setItems(suggestions.filter((s) => s.placePrediction));
        setActive(0);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [places, query, map]);

  async function pick(s: Suggestion) {
    try {
      const place = s.placePrediction!.toPlace();
      await place.fetchFields({ fields: PLACE_FIELDS });
      token.current = null; // the session ends with the details call
      setQuery("");
      setItems([]);
      if (place.location) {
        map?.panTo(place.location);
        if ((map?.getZoom() ?? 0) < 12) map?.setZoom(14);
      }
      onPick(placeToNew(place));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") setItems([]);
  }

  return (
    <div className="search">
      <input
        type="search"
        className="search__input"
        placeholder="Dodaj miejsce: restauracja, hotel, miasto…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls="search-results"
        aria-autocomplete="list"
      />
      {items.length > 0 && (
        <ul className="search__list" id="search-results" role="listbox">
          {items.map((s, i) => {
            const p = s.placePrediction!;
            return (
              <li key={p.placeId} role="option" aria-selected={i === active}
                className={i === active ? "is-active" : undefined}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
                <span className="search__main">{p.mainText?.text ?? p.text.text}</span>
                <span className="search__sub">{p.secondaryText?.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="error small">Wyszukiwarka: {error}</p>}
    </div>
  );
}
