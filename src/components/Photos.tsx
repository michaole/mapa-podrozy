import { useCallback, useEffect, useState } from "react";
import { deletePhoto, listPhotos, uploadPhoto } from "../lib/data";
import type { Photo } from "../lib/types";
import ConfirmButton from "./ConfirmButton";
import { ImageSquare } from "@phosphor-icons/react";

type Target = { tripId?: string; placeId?: string };

export default function Photos({ spaceId, target }: { spaceId: string; target: Target }) {
  const [photos, setPhotos] = useState<(Photo & { url: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { tripId, placeId } = target;
  const load = useCallback(async () => {
    try {
      setPhotos(await listPhotos({ tripId, placeId }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tripId, placeId]);

  useEffect(() => { load(); }, [load]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) await uploadPhoto(spaceId, f, { tripId, placeId });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Photo) {
    try {
      await deletePhoto(p);
      setOpen(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const opened = photos.find((p) => p.id === open);

  return (
    <div className="photos">
      <div className="photos__grid">
        {photos.map((p) => (
          <button type="button" key={p.id} className="photos__thumb" onClick={() => setOpen(p.id)} aria-label="Powiększ zdjęcie">
            <img src={p.url} alt="" loading="lazy" />
          </button>
        ))}
        <label className={`photos__add${busy ? " is-busy" : ""}`}>
          <input type="file" accept="image/*" multiple onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} disabled={busy} />
          <ImageSquare size={20} aria-hidden="true" />
          {busy ? "Wysyłam…" : "Dodaj"}
        </label>
      </div>
      {error && <p className="error small">{error}</p>}
      {opened && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <img src={opened.url} alt="" />
          <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
            <button className="btn" onClick={() => setOpen(null)}>Zamknij</button>
            <ConfirmButton onConfirm={() => remove(opened)} confirmLabel="Na pewno usunąć zdjęcie?" />
          </div>
        </div>
      )}
    </div>
  );
}
