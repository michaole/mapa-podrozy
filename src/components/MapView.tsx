import { useEffect, useRef } from "react";
import { AdvancedMarker, InfoWindow, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import type { Place } from "../lib/types";
import { CATEGORY_LABEL, STATUS_LABEL } from "../lib/types";
import { mapsLink } from "../lib/google";
import { STATUS_COLOR } from "../lib/format";

const MAP_ID = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) || "DEMO_MAP_ID";

const GLYPH: Record<Place["category"], string> = { restaurant: "R", hotel: "H", attraction: "★", city: "●", other: "•" };

export default function MapView({ places, countryFills, selected, onSelect, onEdit }: {
  places: Place[];
  countryFills: Map<string, string>;
  selected: Place | null;
  onSelect: (id: string | null) => void;
  onEdit: (p: Place) => void;
}) {
  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={{ lat: 48, lng: 15 }}
      defaultZoom={4}
      gestureHandling="greedy"
      clickableIcons={false}
      streetViewControl={false}
      mapTypeControl={false}
      onClick={() => onSelect(null)}
    >
      <CountriesLayer fills={countryFills} />
      <FitOnce places={places} />
      {places.map((p) => (
        <AdvancedMarker key={p.id} position={{ lat: p.lat, lng: p.lng }} title={p.name}
          onClick={() => onSelect(p.id)} zIndex={selected?.id === p.id ? 1000 : undefined}>
          <Pin background={STATUS_COLOR[p.status]} borderColor="#ffffff" glyphColor="#ffffff"
            glyph={GLYPH[p.category]} scale={selected?.id === p.id ? 1.25 : 0.95} />
        </AdvancedMarker>
      ))}
      {selected && (
        <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} pixelOffset={[0, -36]}
          onCloseClick={() => onSelect(null)} headerContent={<b>{selected.name}</b>}>
          <div className="iw">
            <p className="iw__meta">
              <span className={`chip chip--${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
              {CATEGORY_LABEL[selected.category]}
              {selected.rating ? ` · ★ ${selected.rating}` : ""}
            </p>
            {selected.address && <p className="iw__addr">{selected.address}</p>}
            {selected.notes && <p className="iw__note">{selected.notes}</p>}
            <p className="iw__actions">
              <a href={mapsLink(selected)} target="_blank" rel="noopener">Otwórz w Google Maps</a>
              <button className="link" onClick={() => onEdit(selected)}>Edytuj</button>
            </p>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
}

/** Visited countries tinted via the map's data layer. */
function CountriesLayer({ fills }: { fills: Map<string, string> }) {
  const map = useMap();
  const loaded = useRef(false);

  useEffect(() => {
    if (!map || loaded.current) return;
    loaded.current = true;
    map.data.loadGeoJson(`${import.meta.env.BASE_URL}countries-110m.geojson`);
  }, [map]);

  useEffect(() => {
    if (!map) return;
    map.data.setStyle((f) => {
      const color = fills.get(String(f.getProperty("code")));
      return {
        fillColor: color ?? "#000",
        fillOpacity: color ? 0.38 : 0,
        strokeColor: color ?? "#000",
        strokeOpacity: color ? 0.8 : 0,
        strokeWeight: color ? 1 : 0,
        clickable: false,
      };
    });
  }, [map, fills]);

  return null;
}

/** Fit the map to the saved places the first time they arrive. */
function FitOnce({ places }: { places: Place[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!map || done.current || places.length === 0) return;
    done.current = true;
    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(12);
      return;
    }
    const b = new google.maps.LatLngBounds();
    places.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(b, 48);
  }, [map, places]);
  return null;
}
