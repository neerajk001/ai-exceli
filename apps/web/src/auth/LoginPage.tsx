import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "./AuthContext";
import { isSupabaseConfigured, supabase } from "./supabase";

type Mode = "signin" | "signup";

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const client = supabase;

  if (!isSupabaseConfigured || !client) {
    return (
      <main className="page">
        <div className="auth-card">
          <h1 className="page-title">AI Whiteboard</h1>
          <p className="page-error">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page">
        <p className="page-muted">Loading...</p>
      </main>
    );
  }

  if (user) {
    return <Navigate to="/boards" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signin") {
        const { error: authError } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }

        navigate("/boards", { replace: true });
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }

        if (data.session) {
          navigate("/boards", { replace: true });
        } else {
          setNotice(
            "Check your email to confirm your account, then sign in here.",
          );
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <div className="auth-card">
        <h1 className="page-title">AI Whiteboard</h1>
        <p className="page-muted">
          {mode === "signin"
            ? "Sign in to open your boards."
            : "Create an account to start drawing."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="ai-field">
            <span className="ai-field-label">Email</span>
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="ai-field">
            <span className="ai-field-label">Password</span>
            <input
              className="auth-input"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <p className="page-error" role="alert">
              {error}
            </p>
          ) : null}

          {notice ? <p className="page-notice">{notice}</p> : null}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy
              ? "Working..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          disabled={busy}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
