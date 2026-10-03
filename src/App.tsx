import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configMissing, supabase } from "./lib/supabase";
import { acceptInvite, mySpaces } from "./lib/data";
import type { Space } from "./lib/types";
import Login from "./components/Login";
import SpaceSetup from "./components/SpaceSetup";
import Main from "./components/Main";

const INVITE_KEY = "mapa.pendingInvite";

/** '#/join/ABC123' → keep the code across the Google sign-in redirect */
function captureInviteFromUrl() {
  const m = location.hash.match(/^#\/join\/([A-Za-z0-9]+)/);
  if (m) {
    sessionStorage.setItem(INVITE_KEY, m[1]);
    history.replaceState(null, "", location.pathname + location.search);
  }
}
captureInviteFromUrl();

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshSpaces = useCallback(async () => {
    try {
      const pending = sessionStorage.getItem(INVITE_KEY);
      if (pending) {
        sessionStorage.removeItem(INVITE_KEY);
        try {
          await acceptInvite(pending);
        } catch (e) {
          setError(`Nie udało się dołączyć z zaproszenia: ${(e as Error).message}`);
        }
      }
      setSpaces(await mySpaces());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (session) refreshSpaces();
    else setSpaces(null);
  }, [session, refreshSpaces]);

  if (configMissing) {
    return (
      <div className="center-card">
        <h1>Brak konfiguracji</h1>
        <p>Ustaw <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> i <code>VITE_GOOGLE_MAPS_API_KEY</code> w pliku <code>.env.local</code>.</p>
      </div>
    );
  }
  if (session === undefined) return <div className="center-card muted">Ładowanie…</div>;
  if (!session) return <Login />;
  if (spaces === null) return <div className="center-card muted">Ładowanie map…</div>;

  return (
    <>
      {error && (
        <div className="toast toast--error" role="alert">
          {error} <button className="link" onClick={() => setError(null)}>Zamknij</button>
        </div>
      )}
      {spaces.length === 0
        ? <SpaceSetup onReady={refreshSpaces} />
        : <Main space={spaces[0]} user={session.user} onSpacesChanged={refreshSpaces} />}
    </>
  );
}
