import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setAuthToken } from "../api-client/client";
import { supabase } from "./supabase";

export type AuthUser = { id: string; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEV_TOKEN = import.meta.env.DEV
  ? (import.meta.env.VITE_DEV_AUTH_TOKEN ?? null)
  : null;

const DEV_USER: AuthUser = { id: "dev-user", email: "dev@local" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_TOKEN) {
      setAuthToken(DEV_TOKEN);
      setLoading(false);
      return undefined;
    }

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      setSession(data.session);
      setAuthToken(data.session?.access_token ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setAuthToken(nextSession?.access_token ?? null);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user: AuthUser | null = DEV_TOKEN
      ? DEV_USER
      : session
        ? {
            id: session.user.id,
            email: session.user.email ?? "",
          }
        : null;

    return {
      user,
      session,
      loading,
      signOut: async () => {
        if (DEV_TOKEN) {
          return;
        }

        await supabase?.auth.signOut();
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
