import { useMemo, useState } from "react";
import { setExtraCountry } from "../lib/data";
import type { Place } from "../lib/types";
import { allCountries, countryName, flag } from "../lib/countries";
import { plural } from "../lib/format";

export default function CountriesPanel({ spaceId, places, extra, onChanged }: {
  spaceId: string; places: Place[]; extra: string[]; onChanged: () => void;
}) {
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byCode = new Map<string, number>();
    for (const p of places) {
      if (p.status === "visited" && p.country_code) {
        const c = p.country_code.toUpperCase();
        byCode.set(c, (byCode.get(c) ?? 0) + 1);
      }
    }
    for (const c of extra) if (!byCode.has(c)) byCode.set(c, 0);
    return [...byCode.entries()]
      .map(([code, count]) => ({ code, count, manual: extra.includes(code), name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [places, extra]);

  const options = useMemo(() => {
    const have = new Set(rows.map((r) => r.code));
    return allCountries().filter((c) => !have.has(c.code));
  }, [rows]);

  async function toggle(code: string, on: boolean) {
    setError(null);
    try {
      await setExtraCountry(spaceId, code, on);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <p className="big-count">
        <b>{rows.length}</b> {plural(rows.length, "kraj", "kraje", "krajów")}
        <span className="muted"> · {Math.round((rows.length / 195) * 100)}% świata</span>
      </p>

      <form className="row" onSubmit={(e) => { e.preventDefault(); if (adding) { toggle(adding, true); setAdding(""); } }}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Dodaj kraj" className="field--grow">
          <option value="">Dodaj kraj bez zapisanych miejsc…</option>
          {options.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <button className="btn" disabled={!adding}>Dodaj</button>
      </form>
      {error && <p className="error">{error}</p>}

      <ul className="country-list">
        {rows.map((r) => (
          <li key={r.code}>
            <span className="country-list__flag" aria-hidden="true">{flag(r.code)}</span>
            <span className="country-list__name">{r.name}</span>
            <span className="muted small">
              {r.count > 0 ? `${r.count} ${plural(r.count, "miejsce", "miejsca", "miejsc")}` : "dodany ręcznie"}
            </span>
            {r.manual && (
              <button className="link small" onClick={() => toggle(r.code, false)} aria-label={`Usuń ${r.name}`}>usuń</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
