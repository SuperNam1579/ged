import Link from "next/link";
import { BookOpen } from "lucide-react";

/**
 * Footer for the public marketing pages. Extracted from the landing page so
 * /subjects and its sub-pages end the same way instead of stopping dead after
 * their last section.
 */
export default function LandingFooter() {
  return (
    <footer
      className="px-4 py-6 md:px-[40px]"
      style={{ borderTop: "1px solid #d8e6f7", background: "var(--card)" }}
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-[9px]" aria-label="GED Prep — home">
          <span
            style={{
              width: 28,
              height: 28,
              background: "#1e90e8",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 0 #1670be",
            }}
          >
            <BookOpen className="text-white" style={{ width: 14, height: 14 }} strokeWidth={2.5} />
          </span>
          <span
            style={{
              fontFamily: "var(--font-feather)",
              fontSize: 15,
              fontWeight: 700,
              color: "#0f2748",
            }}
          >
            GED Prep
          </span>
        </Link>

        <p style={{ fontSize: 12, color: "#5b769a" }}>
          &copy; {new Date().getFullYear()} GED Prep · AI-powered adaptive learning
        </p>

        <div className="flex gap-[18px]" style={{ fontSize: 13, fontWeight: 600 }}>
          <Link href="/subjects" style={{ color: "#1e90e8", textDecoration: "none" }}>
            Syllabus
          </Link>
          <Link href="/login" style={{ color: "#1e90e8", textDecoration: "none" }}>
            Sign In
          </Link>
          <Link href="/register" style={{ color: "#1e90e8", textDecoration: "none" }}>
            Get Started
          </Link>
        </div>
      </div>
    </footer>
  );
}
