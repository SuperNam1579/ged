"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

        if (res.status === 401) {
          router.push("/login");
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
