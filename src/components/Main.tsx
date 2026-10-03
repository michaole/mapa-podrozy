import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { loadSpace, members as loadMembers } from "../lib/data";
import type { ExtraCountry, Member, NewPlace, Place, PlaceStatus, Space, Trip } from "../lib/types";
import MapView from "./MapView";
import PlaceSearch from "./PlaceSearch";
import PlaceList from "./PlaceList";
import PlaceEditor from "./PlaceEditor";
import TripsPanel from "./TripsPanel";
import CountriesPanel from "./CountriesPanel";
import SettingsPanel from "./SettingsPanel";
import { plural } from "../lib/format";
import { colorHex, countryOwners, memberColor, memberName } from "../lib/people";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

type Tab = "places" | "trips" | "countries" | "settings";
export type Editing = { kind: "new"; draft: Omit<NewPlace, "status"> } | { kind: "existing"; place: Place };

export interface SpaceData {
  places: Place[];
  trips: Trip[];
  extraCountries: ExtraCountry[];
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
  const [people, setPeople] = useState<Member[]>([]);

  const reload = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([loadSpace(space.id), loadMembers(space.id)]);
      setData(d);
      setPeople(m);
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
    // map settings (e.g. country colour) changed by the other person
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${space.id}` },
      () => onSpacesChanged());
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [space.id, reload, onSpacesChanged]);

  const visibleOnMap = useMemo(() => {
    const trip = focusTripId;
    return data.places.filter((p) => show[p.status] && (!trip || p.trip_id === trip));
  }, [data.places, show, focusTripId]);

  const visitedCountries = useMemo(() => {
    const set = new Set(data.extraCountries.map((c) => c.code));
    for (const p of data.places) if (p.status === "visited" && p.country_code) set.add(p.country_code.toUpperCase());
    return set;
  }, [data]);

  // map tint per country: shared colour for together, each person's colour for solo
  const { countryFills, legend } = useMemo(() => {
    const together = colorHex(space.country_color);
    const owners = countryOwners(data.places, data.trips, data.extraCountries);
    const fills = new Map<string, string>();
    const used = new Set<string>();
    for (const [code, who] of owners) {
      const m = who === "both" ? undefined : people.find((x) => x.user_id === who);
      fills.set(code, m ? colorHex(memberColor(m)) : together);
      used.add(m ? m.user_id : "both");
    }
    const entries = [{ label: "Razem", hex: together }, ...people
      .filter((m) => used.has(m.user_id))
      .map((m) => ({ label: `Tylko ${memberName(m)}`, hex: colorHex(memberColor(m)) }))];
    return { countryFills: fills, legend: entries.length > 1 ? entries : [] };
  }, [data, people, space.country_color]);

  const selected = data.places.find((p) => p.id === selectedId) ?? null;

  const openEditor = (place: Place) => { setSelectedId(place.id); setEditing({ kind: "existing", place }); };

  return (
    <APIProvider apiKey={MAPS_KEY} language="pl" region="PL">
      <div className="layout">
        <aside className="panel">
          <header className="panel__head">
            <h1 className="brand">{space.name}</h1>
            <dl className="stats">
              <div><dt>{plural(visitedCountries.size, "kraj", "kraje", "krajów")}</dt><dd>{visitedCountries.size}</dd></div>
              <div><dt>odwiedzonych</dt><dd>{data.places.filter((p) => p.status === "visited").length}</dd></div>
              <div className="stats--wish"><dt>do odwiedzenia</dt><dd>{data.places.filter((p) => p.status === "wishlist").length}</dd></div>
            </dl>
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
            {!loaded && !error && (
              <div className="skeleton" aria-busy="true" aria-label="Ładowanie">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton__row" />)}
              </div>
            )}

            {loaded && editing && (
              <PlaceEditor
                key={editing.kind === "existing" ? editing.place.id : editing.draft.google_place_id ?? "new"}
                spaceId={space.id}
                editing={editing}
                trips={data.trips}
                members={people}
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
              <TripsPanel spaceId={space.id} trips={data.trips} places={data.places} members={people}
                focusTripId={focusTripId} setFocusTripId={setFocusTripId}
                onChanged={reload} onEditPlace={openEditor} />
            )}
            {loaded && !editing && tab === "countries" && (
              <CountriesPanel spaceId={space.id} places={data.places} trips={data.trips} members={people}
                extra={data.extraCountries} onChanged={reload} />
            )}
            {loaded && !editing && tab === "settings" && (
              <SettingsPanel space={space} user={user} onSpacesChanged={onSpacesChanged} onPeopleChanged={reload} />
            )}
          </div>
        </aside>

        <main className="map">
          <MapView
            places={visibleOnMap}
            countryFills={countryFills}
            selected={selected}
            onSelect={setSelectedId}
            onEdit={openEditor}
          />
          {legend.length > 0 && (
            <ul className="map__legend" aria-label="Legenda krajów">
              {legend.map((l) => (
                <li key={l.label}><span className="map__swatch" style={{ background: l.hex }} />{l.label}</li>
              ))}
            </ul>
          )}
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
