import { useState } from "react";
import { supabase } from "../lib/supabase";

const redirectTo = () => location.origin + location.pathname;

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError(error.message);
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    if (error) setError(error.message);
    else setSent(true);
  }

  const invited = !!sessionStorage.getItem("mapa.pendingInvite");

  return (
    <div className="center-card">
      <h1 className="brand">Mapa podróży</h1>
      <p className="muted">
        {invited ? "Masz zaproszenie do wspólnej mapy — zaloguj się, żeby dołączyć." : "Gdzie byliśmy i dokąd chcemy jechać."}
      </p>
      <button className="btn btn--primary btn--wide" onClick={google}>Zaloguj przez Google</button>
      <div className="divider"><span>albo</span></div>
      {sent ? (
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
