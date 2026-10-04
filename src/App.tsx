import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configMissing, supabase } from "./lib/supabase";
import { acceptInvite, mySpaces } from "./lib/data";
import type { Space } from "./lib/types";
import Login from "./components/Login";
import SpaceSetup from "./components/SpaceSetup";
import Main from "./components/Main";

import { ACTIVE_SPACE_KEY, INVITE_KEY, storage } from "./lib/invite";

/**
 * Keep an invite code until the person has signed in. It arrives as
 * '#/join/CODE' (the shared link) or '?invite=CODE' (carried through the
 * sign-in redirect, so it survives the email link opening another tab).
 */
function captureInviteFromUrl() {
  const fromHash = location.hash.match(/^#\/join\/([A-Za-z0-9]+)/)?.[1];
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("invite");
  const code = fromHash ?? fromQuery;
  if (!code) return;
  storage.set(INVITE_KEY, code);
  params.delete("invite");
  const query = params.toString();
  // keep any auth tokens in the hash; drop only our own markers
  const hash = fromHash ? "" : location.hash;
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + hash);
}
captureInviteFromUrl();

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => storage.get(ACTIVE_SPACE_KEY));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshSpaces = useCallback(async () => {
    try {
      const pending = storage.get(INVITE_KEY);
      if (pending) {
        storage.remove(INVITE_KEY);
        try {
          const joined = await acceptInvite(pending);
          storage.set(ACTIVE_SPACE_KEY, joined);
          setActiveId(joined);
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
        : <Main
            key={(spaces.find((s) => s.id === activeId) ?? spaces[0]).id}
            space={spaces.find((s) => s.id === activeId) ?? spaces[0]}
            spaces={spaces}
            onSwitchSpace={(id) => { storage.set(ACTIVE_SPACE_KEY, id); setActiveId(id); }}
            user={session.user}
            onSpacesChanged={refreshSpaces} />}
    </>
  );
}
