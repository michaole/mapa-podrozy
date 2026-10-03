import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { loadSpace } from "../lib/data";
import type { NewPlace, Place, PlaceStatus, Space, Trip } from "../lib/types";
import MapView from "./MapView";
import PlaceSearch from "./PlaceSearch";
import PlaceList from "./PlaceList";
import PlaceEditor from "./PlaceEditor";
import TripsPanel from "./TripsPanel";
import CountriesPanel from "./CountriesPanel";
import SettingsPanel from "./SettingsPanel";
import { plural } from "../lib/format";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

type Tab = "places" | "trips" | "countries" | "settings";
export type Editing = { kind: "new"; draft: Omit<NewPlace, "status"> } | { kind: "existing"; place: Place };

export interface SpaceData {
  places: Place[];
  trips: Trip[];
  extraCountries: string[];
}

export default function Main({ space, user, onSpacesChanged }: {
  space: Space; user: User; onSpacesChanged: () => void;
}) {
  const [data, setData] = useState<SpaceData>({ places: [], trips: [], extraCountries: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("places");
  const [show, setShow] = useState<Record<PlaceStatus, boolean>>({ visited: true, wishlist: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [focusTripId, setFocusTripId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadSpace(space.id));
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [space.id]);

  useEffect(() => { reload(); }, [reload]);

  // live updates when the other person edits (debounced: bursts → one reload)
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const channel = supabase.channel(`space-${space.id}`);
    for (const table of ["places", "trips", "extra_countries"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `space_id=eq.${space.id}` }, () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(reload, 300);
      });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [space.id, reload]);

  const visibleOnMap = useMemo(() => {
    const trip = focusTripId;
    return data.places.filter((p) => show[p.status] && (!trip || p.trip_id === trip));
  }, [data.places, show, focusTripId]);

  const visitedCountries = useMemo(() => {
    const set = new Set(data.extraCountries);
    for (const p of data.places) if (p.status === "visited" && p.country_code) set.add(p.country_code.toUpperCase());
    return set;
  }, [data]);

  const selected = data.places.find((p) => p.id === selectedId) ?? null;

  const openEditor = (place: Place) => { setSelectedId(place.id); setEditing({ kind: "existing", place }); };

  return (
    <APIProvider apiKey={MAPS_KEY} language="pl" region="PL">
      <div className="layout">
        <aside className="panel">
          <header className="panel__head">
            <h1 className="brand">{space.name}</h1>
            <p className="muted small">
              {visitedCountries.size} {plural(visitedCountries.size, "kraj", "kraje", "krajów")} ·{" "}
              {data.places.filter((p) => p.status === "visited").length} odwiedzonych ·{" "}
              {data.places.filter((p) => p.status === "wishlist").length} na liście
            </p>
          </header>

          <PlaceSearch onPick={(draft) => { setEditing({ kind: "new", draft }); setTab("places"); }} />

          <nav className="tabs" role="tablist">
            {([["places", "Miejsca"], ["trips", "Podróże"], ["countries", "Kraje"], ["settings", "Ustawienia"]] as [Tab, string][])
              .map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => { setTab(id); setEditing(null); }}>
                  {label}
                </button>
              ))}
          </nav>

          <div className="panel__body">
            {error && <p className="error">{error}</p>}
            {!loaded && !error && <p className="muted">Ładowanie…</p>}

            {loaded && editing && (
              <PlaceEditor
                key={editing.kind === "existing" ? editing.place.id : editing.draft.google_place_id ?? "new"}
                spaceId={space.id}
                editing={editing}
                trips={data.trips}
                existing={data.places}
                onDone={(placeId) => { setEditing(null); if (placeId) setSelectedId(placeId); reload(); }}
                onCancel={() => setEditing(null)}
              />
            )}

            {loaded && !editing && tab === "places" && (
              <PlaceList places={data.places} show={show} setShow={setShow}
                selectedId={selectedId} onSelect={setSelectedId} onEdit={openEditor} />
            )}
            {loaded && !editing && tab === "trips" && (
              <TripsPanel spaceId={space.id} trips={data.trips} places={data.places}
                focusTripId={focusTripId} setFocusTripId={setFocusTripId}
                onChanged={reload} onEditPlace={openEditor} />
            )}
            {loaded && !editing && tab === "countries" && (
              <CountriesPanel spaceId={space.id} places={data.places} extra={data.extraCountries} onChanged={reload} />
            )}
            {loaded && !editing && tab === "settings" && (
              <SettingsPanel space={space} user={user} onSpacesChanged={onSpacesChanged} />
            )}
          </div>
        </aside>

        <main className="map">
          <MapView
            places={visibleOnMap}
            visitedCountries={visitedCountries}
            selected={selected}
            onSelect={setSelectedId}
            onEdit={openEditor}
          />
          {focusTripId && (
            <div className="map__banner">
              Pokazuję jedną podróż · <button className="link" onClick={() => setFocusTripId(null)}>pokaż wszystko</button>
            </div>
          )}
        </main>
      </div>
    </APIProvider>
  );
}
