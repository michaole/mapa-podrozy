import { useMemo, useState } from "react";
import { setExtraCountry } from "../lib/data";
import type { ExtraCountry, Member, Place, Trip, Who } from "../lib/types";
import { allCountries, countryName, flag } from "../lib/countries";
import { plural } from "../lib/format";
import { effectiveWho, memberName } from "../lib/people";

/**
 * Countries per "who": Razem = together, or one person's solo travel.
 * A country can appear under several filters. The map always shows all.
 */
export default function CountriesPanel({ spaceId, places, trips, members, extra, onChanged }: {
  spaceId: string;
  places: Place[];
  trips: Trip[];
  members: Member[];
  extra: ExtraCountry[];
  onChanged: () => void;
}) {
  const [who, setWho] = useState<Who>("both");
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filters: [Who, string][] = [["both", "Razem"], ...members.map((m) => [m.user_id, `Tylko ${memberName(m)}`] as [Who, string])];

  const rows = useMemo(() => {
    const byCode = new Map<string, number>();
    for (const p of places) {
      if (p.status === "visited" && p.country_code && effectiveWho(p, trips) === who) {
        const c = p.country_code.toUpperCase();
        byCode.set(c, (byCode.get(c) ?? 0) + 1);
      }
    }
    const manual = new Set(extra.filter((e) => e.who === who).map((e) => e.code));
    for (const c of manual) if (!byCode.has(c)) byCode.set(c, 0);
    return [...byCode.entries()]
      .map(([code, count]) => ({ code, count, manual: manual.has(code), name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [places, trips, extra, who]);

  const options = useMemo(() => {
    const have = new Set(rows.map((r) => r.code));
    return allCountries().filter((c) => !have.has(c.code));
  }, [rows]);

  async function toggle(code: string, on: boolean) {
    setError(null);
    try {
      await setExtraCountry(spaceId, code, who, on);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const solo = who !== "both";
  return (
    <div className="stack">
      <div className="segmented segmented--plain" role="radiogroup" aria-label="Czyje kraje">
        {filters.map(([id, label]) => (
          <label key={id} className="segmented__opt segmented__opt--neutral">
            <input type="radio" name="countries-who" checked={who === id} onChange={() => setWho(id)} />
            {label}
          </label>
        ))}
      </div>
      {members.length < 2 && (
        <p className="muted small">Filtr drugiej osoby pojawi się, gdy dołączy do mapy z zaproszenia.</p>
      )}

      <p className="big-count">
        <b>{rows.length}</b> {plural(rows.length, "kraj", "kraje", "krajów")}
        <span className="muted"> {solo ? "w pojedynkę" : "razem"} · {Math.round((rows.length / 195) * 100)}% świata</span>
      </p>

      <form className="row" onSubmit={(e) => { e.preventDefault(); if (adding) { toggle(adding, true); setAdding(""); } }}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Dodaj kraj" className="field--grow">
          <option value="">{solo ? "Dodaj kraj do tej listy…" : "Dodaj kraj bez zapisanych miejsc…"}</option>
          {options.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <button className="btn" disabled={!adding}>Dodaj</button>
      </form>
      {error && <p className="error">{error}</p>}

      {rows.length === 0 && (
        <p className="muted">
          {solo
            ? "Brak krajów na tej liście. Oznacz podróż lub miejsce jako tylko tej osoby albo dodaj kraj ręcznie."
            : "Brak krajów. Zapisz odwiedzone miejsca albo dodaj kraj ręcznie."}
        </p>
      )}

      <ul className="country-list">
        {rows.map((r) => (
          <li key={r.code}>
            <span className="country-list__flag" aria-hidden="true">{flag(r.code)}</span>
            <span className="country-list__name">{r.name}</span>
            <span className="muted small">
              {r.count > 0 ? `${r.count} ${plural(r.count, "miejsce", "miejsca", "miejsc")}` : "dodany ręcznie"}
            </span>
            {r.manual && (
              <button className="link small" onClick={() => toggle(r.code, false)} aria-label={`Usuń ${r.name} z tej listy`}>usuń</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
