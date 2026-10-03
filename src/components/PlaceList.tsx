import { useMemo, useState } from "react";
import type { Place, PlaceCategory, PlaceStatus } from "../lib/types";
import { CATEGORY_LABEL, STATUS_LABEL } from "../lib/types";
import { flag } from "../lib/countries";
import { PencilSimple } from "@phosphor-icons/react";

export default function PlaceList({ places, show, setShow, selectedId, onSelect, onEdit }: {
  places: Place[];
  show: Record<PlaceStatus, boolean>;
  setShow: (s: Record<PlaceStatus, boolean>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (p: Place) => void;
}) {
  const [category, setCategory] = useState<PlaceCategory | "">("");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("pl");
    return places.filter((p) =>
      show[p.status] &&
      (!category || p.category === category) &&
      (!needle || `${p.name} ${p.city ?? ""} ${p.country_name ?? ""} ${p.notes ?? ""}`.toLocaleLowerCase("pl").includes(needle)));
  }, [places, show, category, q]);

  // group by country, then city — matches how you think about a trip
  const groups = useMemo(() => {
    const m = new Map<string, Place[]>();
    for (const p of shown) {
      const key = p.country_code ?? "??";
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => (a[1][0].country_name ?? "").localeCompare(b[1][0].country_name ?? "", "pl"));
  }, [shown]);

  return (
    <div className="stack">
      <div className="filters">
        {(["visited", "wishlist"] as PlaceStatus[]).map((s) => (
          <button key={s} type="button" className={`chip-toggle chip-toggle--${s}`} aria-pressed={show[s]}
            onClick={() => setShow({ ...show, [s]: !show[s] })}>
            <span className={`dot dot--${s}`} aria-hidden="true" />
            {STATUS_LABEL[s]} <span className="chip-toggle__count">{places.filter((p) => p.status === s).length}</span>
          </button>
        ))}
        <select value={category} onChange={(e) => setCategory(e.target.value as PlaceCategory | "")} aria-label="Kategoria">
          <option value="">Wszystkie kategorie</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="search" placeholder="Szukaj na liście…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj na liście" />
      </div>

      {places.length === 0 && (
        <div className="empty">
          <p className="empty__title">Tu zaczyna się wasza mapa</p>
          <p className="muted">Wpisz w wyszukiwarkę nazwę restauracji, hotelu albo miasta i zapisz je jako „Byliśmy” albo „Chcemy”. Odwiedzone kraje zaznaczą się na mapie same.</p>
        </div>
      )}
      {places.length > 0 && shown.length === 0 && <p className="muted">Nic nie pasuje do filtrów.</p>}

      {groups.map(([code, list]) => (
        <section key={code}>
          <h3 className="group-title">
            {code !== "??" && <span aria-hidden="true">{flag(code)}</span>} {list[0].country_name ?? "Bez kraju"}
            <span className="muted"> · {list.length}</span>
          </h3>
          <ul className="place-list">
            {list.map((p) => (
              <li key={p.id} className={p.id === selectedId ? "is-selected" : undefined}>
                <button className="place-row" onClick={() => onSelect(p.id)}>
                  <span className={`dot dot--${p.status}`} aria-label={STATUS_LABEL[p.status]} />
                  <span className="place-row__main">
                    <span className="place-row__name">{p.name}</span>
                    <span className="place-row__sub">
                      {CATEGORY_LABEL[p.category]}{p.city ? ` · ${p.city}` : ""}{p.rating ? ` · ★ ${p.rating}` : ""}
                    </span>
                  </span>
                </button>
                <button className="icon-btn" onClick={() => onEdit(p)} aria-label={`Edytuj: ${p.name}`} title="Edytuj">
                  <PencilSimple size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
