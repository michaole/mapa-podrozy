import { useState } from "react";
import { addPlace, deletePlace, updatePlace } from "../lib/data";
import type { NewPlace, Place, PlaceCategory, PlaceStatus, Trip } from "../lib/types";
import { CATEGORY_LABEL, STATUS_LABEL } from "../lib/types";
import { mapsLink } from "../lib/google";
import type { Editing } from "./Main";
import Photos from "./Photos";

export default function PlaceEditor({ spaceId, editing, trips, existing, onDone, onCancel }: {
  spaceId: string;
  editing: Editing;
  trips: Trip[];
  existing: Place[];
  onDone: (placeId?: string) => void;
  onCancel: () => void;
}) {
  const base: NewPlace = editing.kind === "existing"
    ? editing.place
    : { ...editing.draft, status: "wishlist" };
  const [form, setForm] = useState<NewPlace>(base);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof NewPlace>(k: K, v: NewPlace[K]) => setForm((f) => ({ ...f, [k]: v }));

  const duplicate = editing.kind === "new" && form.google_place_id
    ? existing.find((p) => p.google_place_id === form.google_place_id && p.status === form.status)
    : undefined;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clean: NewPlace = {
        ...form,
        trip_id: form.status === "visited" ? form.trip_id : null,
        visited_on: form.status === "visited" ? form.visited_on || null : null,
        notes: form.notes?.trim() || null,
      };
      if (editing.kind === "existing") {
        await updatePlace(editing.place.id, clean);
        onDone(editing.place.id);
      } else {
        const created = await addPlace(spaceId, clean);
        onDone(created.id);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (editing.kind !== "existing" || !confirm(`Usunąć „${editing.place.name}”?`)) return;
    setBusy(true);
    try {
      await deletePlace(editing.place.id);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="editor stack" onSubmit={save}>
      <div>
        <h2 className="editor__title">{form.name}</h2>
        {form.address && <p className="muted small">{form.address}</p>}
        <p className="small">
          <a href={mapsLink(form)} target="_blank" rel="noopener">Otwórz w Google Maps</a>
          {form.rating ? <span className="muted"> · ★ {form.rating} w Google</span> : null}
        </p>
      </div>

      <fieldset className="segmented">
        <legend className="visually-hidden">Status</legend>
        {(["visited", "wishlist"] as PlaceStatus[]).map((s) => (
          <label key={s} className={`segmented__opt segmented__opt--${s}`}>
            <input type="radio" name="status" checked={form.status === s} onChange={() => set("status", s)} />
            {STATUS_LABEL[s]}
          </label>
        ))}
      </fieldset>

      {duplicate && <p className="warn small">To miejsce jest już na liście „{STATUS_LABEL[duplicate.status]}”.</p>}

      <label className="field">
        <span>Kategoria</span>
        <select value={form.category} onChange={(e) => set("category", e.target.value as PlaceCategory)}>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      {form.status === "visited" && (
        <div className="row">
          <label className="field">
            <span>Kiedy</span>
            <input type="date" value={form.visited_on ?? ""} onChange={(e) => set("visited_on", e.target.value || null)} />
          </label>
          <label className="field field--grow">
            <span>Podróż</span>
            <select value={form.trip_id ?? ""} onChange={(e) => set("trip_id", e.target.value || null)}>
              <option value="">— bez podróży —</option>
              {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        </div>
      )}

      <label className="field">
        <span>Notatka</span>
        <textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
          placeholder={form.status === "wishlist" ? "np. polecił Tomek, rezerwacja z wyprzedzeniem" : "np. najlepsze pastéis de nata"} />
      </label>

      {editing.kind === "existing" && (
        <div className="field">
          <span>Zdjęcia</span>
          <Photos spaceId={spaceId} target={{ placeId: editing.place.id }} />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="btn btn--primary" disabled={busy || !!duplicate}>
          {editing.kind === "existing" ? "Zapisz" : `Zapisz jako „${STATUS_LABEL[form.status]}”`}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Anuluj</button>
        {editing.kind === "existing" && (
          <button type="button" className="btn btn--danger" onClick={remove} disabled={busy}>Usuń</button>
        )}
      </div>
    </form>
  );
}
