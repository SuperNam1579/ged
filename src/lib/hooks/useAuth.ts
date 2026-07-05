"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearExistingSession } from "@/lib/auth-client";

interface User {
  id: string;
  email: string;
  name: string;
  preferences: Record<string, unknown> | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled) return;

        // 401 = no valid session. 404 = the session resolves to a user that no
        // longer exists (e.g. an account deleted during testing left a stale
        // cookie behind). Either way, self-heal: clear the stale cookies and
        // send the user to login — no manual cookie clearing required.
        if (res.status === 401 || res.status === 404) {
          await clearExistingSession();
          if (!cancelled) router.replace("/login?expired=1");
          return;
        }
        if (!res.ok) {
          setError(`Failed to load user (${res.status})`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) setError("Network error — please check your connection");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, loading, error };
}
