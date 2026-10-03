import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { createInvite, members, renameSpace, setCountryColor } from "../lib/data";
import type { CountryColor, Member, Space } from "../lib/types";
import { COUNTRY_COLORS } from "../lib/types";

export default function SettingsPanel({ space, user, onSpacesChanged }: {
  space: Space; user: User; onSpacesChanged: () => void;
}) {
  const [list, setList] = useState<Member[]>([]);
  const [name, setName] = useState(space.name);
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { members(space.id).then(setList).catch((e) => setError(e.message)); }, [space.id]);

  const link = invite ? `${location.origin}${location.pathname}#/join/${invite}` : "";

  async function makeInvite() {
    setError(null);
    try {
      setInvite(await createInvite(space.id));
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack">
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        try { await renameSpace(space.id, name.trim() || space.name); onSpacesChanged(); } catch (err) { setError((err as Error).message); }
      }}>
        <label className="field field--grow"><span>Nazwa mapy</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
        <button className="btn" disabled={name.trim() === space.name}>Zmień</button>
      </form>

      <fieldset className="swatches">
        <legend className="group-title">Kolor odwiedzonych krajów</legend>
        <div className="swatches__row">
          {(Object.keys(COUNTRY_COLORS) as CountryColor[]).map((c) => (
            <label key={c} className="swatch" style={{ "--swatch": COUNTRY_COLORS[c].hex } as React.CSSProperties}>
              <input type="radio" name="country-color" checked={space.country_color === c}
                onChange={async () => {
                  try { await setCountryColor(space.id, c); onSpacesChanged(); } catch (e) { setError((e as Error).message); }
                }} />
              <span className="swatch__chip" aria-hidden="true" />
              <span className="swatch__label">{COUNTRY_COLORS[c].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="stack">
        <h3 className="group-title">Kto ma dostęp</h3>
        <ul className="member-list">
          {list.map((m) => (
            <li key={m.user_id}>
              {m.profile?.avatar_url
                ? <img src={m.profile.avatar_url} alt="" referrerPolicy="no-referrer" />
                : <span className="avatar">{(m.profile?.display_name ?? "?").slice(0, 1)}</span>}
              <span>{m.profile?.display_name ?? "Bez nazwy"}{m.user_id === user.id ? " (Ty)" : ""}</span>
              <span className="muted small">{m.role === "owner" ? "założyciel" : "członek"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h3 className="group-title">Zaproś</h3>
        <p className="muted small">Link działa raz i wygasa po 7 dniach. Osoba zapraszana loguje się swoim kontem.</p>
        {!invite && <button className="btn btn--primary" onClick={makeInvite}>Utwórz zaproszenie</button>}
        {invite && (
          <div className="invite">
            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link zaproszenia" />
            <div className="actions">
              <button className="btn btn--primary" onClick={copy}>{copied ? "Skopiowano" : "Kopiuj link"}</button>
              <span className="muted small">kod: <b>{invite}</b></span>
            </div>
          </div>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <p className="muted small">Zalogowano jako {user.email}. <button className="link" onClick={() => supabase.auth.signOut()}>Wyloguj</button></p>
    </div>
  );
}
