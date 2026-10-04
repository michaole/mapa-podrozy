import { useState } from "react";
import { acceptInvite, createSpace } from "../lib/data";
import { supabase } from "../lib/supabase";

export default function SpaceSetup({ onReady }: { onReady: () => void }) {
  const [name, setName] = useState("Nasza mapa");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onReady();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-card">
      <h1 className="brand">Witaj!</h1>
      <p className="muted">
        <b>Jeśli druga osoba już założyła mapę, nie zakładaj nowej</b> — otwórz link z zaproszenia albo wpisz kod poniżej.
        Inaczej będziecie mieć dwie osobne mapy.
      </p>

      <form className="stack" onSubmit={(e) => { e.preventDefault(); run(() => createSpace(name.trim() || "Nasza mapa")); }}>
        <label className="field">
          <span>Nazwa mapy</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <button className="btn btn--primary btn--wide" disabled={busy}>Załóż mapę</button>
      </form>

      <div className="divider"><span>albo</span></div>

      <form className="stack" onSubmit={(e) => { e.preventDefault(); run(() => acceptInvite(code)); }}>
        <label className="field">
          <span>Kod zaproszenia</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="np. 7F3A9C21B0" autoCapitalize="characters" />
        </label>
        <button className="btn btn--wide" disabled={busy || !code.trim()}>Dołącz</button>
      </form>

      {error && <p className="error">{error}</p>}
      <button className="link small" onClick={() => supabase.auth.signOut()}>Wyloguj</button>
    </div>
  );
}
