import { useState } from "react";
import { supabase } from "../lib/supabase";
import { INVITE_KEY, authRedirectUrl, isStandalone, storage } from "../lib/invite";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: authRedirectUrl() } });
    if (error) setError(error.message);
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl() } });
    if (error) setError(error.message);
    else setSent(true);
  }

  const invited = !!storage.get(INVITE_KEY);
  // the home-screen app has its own storage: an email link would sign in Safari instead
  const standalone = isStandalone();
  const [showEmail, setShowEmail] = useState(!standalone);

  return (
    <div className="center-card">
      <h1 className="brand">Mapa podróży</h1>
      <p className="muted">
        {invited ? "Masz zaproszenie do wspólnej mapy — zaloguj się, żeby dołączyć." : "Gdzie byliśmy i dokąd chcemy jechać."}
      </p>
      <button className="btn btn--primary btn--wide" onClick={google}>Zaloguj przez Google</button>
      <div className="divider"><span>albo</span></div>
      {!showEmail ? (
        <p className="muted small">
          W aplikacji na ekranie początkowym zaloguj się przez Google: link z maila otworzyłby się w Safari, a nie tutaj.{" "}
          <button className="link" onClick={() => setShowEmail(true)}>Mimo to użyj e-maila</button>
        </p>
      ) : sent ? (
        <p>Wysłaliśmy link logowania na <b>{email}</b>. Otwórz go na tym urządzeniu.</p>
      ) : (
        <form onSubmit={magicLink} className="stack">
          <label className="field">
            <span>E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <button className="btn btn--wide">Wyślij link logowania</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
