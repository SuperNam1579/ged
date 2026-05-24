import { handlers } from "@/auth";

// NextAuth catch-all route.
// Handles: GET/POST /api/auth/session, /api/auth/callback/google,
//          /api/auth/callback/credentials, /api/auth/csrf, /api/auth/providers
// The specific custom routes under /api/auth/* (login, register, etc.) take
// precedence over this catch-all in Next.js App Router routing.
export const { GET, POST } = handlers;
