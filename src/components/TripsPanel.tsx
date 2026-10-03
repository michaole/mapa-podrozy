import { useState } from "react";
import { deleteTrip, saveTrip } from "../lib/data";
import type { Place, Trip } from "../lib/types";
import { CATEGORY_LABEL } from "../lib/types";
import { flag } from "../lib/countries";
import Photos from "./Photos";

const fmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });
const range = (t: Trip) =>
  t.start_date
    ? `${fmt.format(new Date(t.start_date))}${t.end_date && t.end_date !== t.start_date ? ` – ${fmt.format(new Date(t.end_date))}` : ""}`
    : "bez daty";

type Draft = Omit<Trip, "id" | "space_id">;
const EMPTY: Draft = { title: "", start_date: null, end_date: null, notes: null };

export default function TripsPanel({ spaceId, trips, places, focusTripId, setFocusTripId, onChanged, onEditPlace }: {
  spaceId: string;
  trips: Trip[];
  places: Place[];
  focusTripId: string | null;
  setFocusTripId: (id: string | null) => void;
  onChanged: () => void;
  onEditPlace: (p: Place) => void;
}) {
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      const saved = await saveTrip(spaceId, { ...editing.draft, notes: editing.draft.notes?.trim() || null }, editing.id);
      setEditing(null);
      setOpenId(saved.id);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(t: Trip) {
    if (!confirm(`Usunąć podróż „${t.title}”? Miejsca zostaną, tylko bez przypisania.`)) return;
    try {
      await deleteTrip(t.id);
      if (focusTripId === t.id) setFocusTripId(null);
      setOpenId(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (editing) {
    const d = editing.draft;
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing({ ...editing, draft: { ...d, [k]: v } });
    return (
      <form className="editor stack" onSubmit={submit}>
        <h2 className="editor__title">{editing.id ? "Edytuj podróż" : "Nowa podróż"}</h2>
        <label className="field">
          <span>Nazwa</span>
          <input required value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="np. Portugalia, maj 2025" />
        </label>
        <div className="row">
          <label className="field"><span>Od</span>
            <input type="date" value={d.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></label>
          <label className="field"><span>Do</span>
            <input type="date" value={d.end_date ?? ""} min={d.start_date ?? undefined} onChange={(e) => set("end_date", e.target.value || null)} /></label>
        </div>
        <label className="field"><span>Notatki</span>
          <textarea rows={3} value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button className="btn btn--primary">Zapisz</button>
          <button type="button" className="btn" onClick={() => setEditing(null)}>Anuluj</button>
        </div>
      </form>
    );
  }

  return (
    <div className="stack">
      <button className="btn btn--primary" onClick={() => setEditing({ draft: EMPTY })}>+ Nowa podróż</button>
      {error && <p className="error">{error}</p>}
      {trips.length === 0 && (
        <p className="muted">Podróż grupuje miejsca i zdjęcia z jednego wyjazdu. Po jej założeniu przypisz do niej odwiedzone miejsca w ich edycji.</p>
      )}
      <ul className="trip-list">
        {trips.map((t) => {
          const inTrip = places.filter((p) => p.trip_id === t.id);
          const countries = [...new Set(inTrip.map((p) => p.country_code).filter(Boolean))] as string[];
          const isOpen = openId === t.id;
          return (
            <li key={t.id} className={`trip${isOpen ? " is-open" : ""}`}>
              <button className="trip__head" onClick={() => setOpenId(isOpen ? null : t.id)} aria-expanded={isOpen}>
                <span className="trip__title">{t.title}</span>
                <span className="trip__meta">
                  {range(t)} · {inTrip.length} {inTrip.length === 1 ? "miejsce" : "miejsc"}
                  {countries.length > 0 && <span aria-hidden="true"> {countries.map(flag).join(" ")}</span>}
                </span>
              </button>
              {isOpen && (
                <div className="trip__body stack">
                  {t.notes && <p className="note">{t.notes}</p>}
                  <div className="actions">
                    <button className="btn" onClick={() => setFocusTripId(focusTripId === t.id ? null : t.id)}>
                      {focusTripId === t.id ? "Pokaż wszystko na mapie" : "Pokaż na mapie"}
                    </button>
                    <button className="btn" onClick={() => setEditing({ id: t.id, draft: { title: t.title, start_date: t.start_date, end_date: t.end_date, notes: t.notes } })}>Edytuj</button>
                    <button className="btn btn--danger" onClick={() => remove(t)}>Usuń</button>
                  </div>
                  {inTrip.length > 0 && (
                    <ul className="place-list place-list--compact">
                      {inTrip.map((p) => (
                        <li key={p.id}>
                          <button className="place-row" onClick={() => onEditPlace(p)}>
                            <span className={`dot dot--${p.status}`} />
                            <span className="place-row__main">
                              <span className="place-row__name">{p.name}</span>
                              <span className="place-row__sub">{CATEGORY_LABEL[p.category]}{p.city ? ` · ${p.city}` : ""}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="field"><span>Zdjęcia z podróży</span><Photos spaceId={spaceId} target={{ tripId: t.id }} /></div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
