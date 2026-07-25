"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// Legacy route. Email verification moved from a magic link to a 6-digit code,
// so anything that still points here is forwarded to the code-entry page.
function CheckEmailRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  useEffect(() => {
    router.replace(`/verify-email${email ? `?email=${encodeURIComponent(email)}` : ""}`);
  }, [router, email]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailRedirect />
    </Suspense>
  );
}
